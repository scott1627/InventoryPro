#!/bin/bash

# InventoryPro Setup & Deployment Script
# This script automates the installation and setup of the InventoryPro system.

set -e

echo "--------------------------------------------------------"
echo "   InventoryPro - Modern Parts Management System        "
echo "--------------------------------------------------------"

# Define color codes for better UI
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Helper Functions
install_docker() {
    echo -e "${GREEN}Attempting to install Docker and Docker Compose (Ubuntu/Debian)...${NC}"
    # Cleanup any previous incorrect file if it exists
    [ -f /etc/apt/defaults.list ] && sudo rm /etc/apt/defaults.list || true
    
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    echo -e "${GREEN}Adding $USER to the docker group...${NC}"
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker installed successfully.${NC}"
    echo -e "${YELLOW}NOTE: You may need to log out and back in for group changes to take effect.${NC}"
}

# 2. Check for Prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: docker is not installed.${NC}"
    if command -v apt-get &> /dev/null; then
        read -p "Would you like to attempt to install Docker automatically? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker
        else
            exit 1
        fi
    else
        echo "Please install Docker manually for your OS."
        exit 1
    fi
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: docker compose (V2) is not installed.${NC}"
    if command -v apt-get &> /dev/null; then
        read -p "Would you like to attempt to install Docker Compose plugin? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo apt-get update && sudo apt-get install -y docker-compose-plugin
        else
            exit 1
        fi
    else
        echo "Please install Docker Compose V2 manually."
        exit 1
    fi
fi

echo "✓ Docker and Docker Compose are installed."

# 2. Setup Environment Variables
if [ ! -f .env ]; then
    echo "Creating default .env file..."
    # For remote access, change localhost to your server's IP or hostname
    NEXTAUTH_URL_DEFAULT="http://localhost:3000"
    cat > .env <<EOL
NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "default_secret_$(date +%s)")
NEXTAUTH_URL=${NEXTAUTH_URL:-$NEXTAUTH_URL_DEFAULT}
EOL
    echo "✓ Created .env with generated NEXTAUTH_SECRET."
else
    echo "✓ .env file already exists."
fi

# 3. Build and Start Containers
echo "Building and starting containers (this may take a few minutes)..."

PROJECT_NAME="inventory-pro"
# Check if we can run docker without sudo
DOCKER_CMD="docker"
if ! docker ps &> /dev/null; then
    if docker ps 2>&1 | grep -q "permission denied"; then
        echo -e "${YELLOW}Warning: Permission denied for docker.sock. Group changes might not have taken effect.${NC}"
        echo "Using sudo for docker commands in this session..."
        DOCKER_CMD="sudo docker"
    fi
fi

# 3. Check for Existing active deployment and perform Automated Backup
HAS_EXISTING_DB=false
if $DOCKER_CMD compose -p $PROJECT_NAME ps db 2>/dev/null | grep -q "Up"; then
    HAS_EXISTING_DB=true
fi

if [ "$HAS_EXISTING_DB" = true ]; then
    echo -e "${YELLOW}Existing active deployment detected. Performing automated backup before migration...${NC}"
    # Ensure temp dir is clean
    rm -rf /tmp/inventory_auto_backup.sql /tmp/inventory_auto_uploads /tmp/inventory_auto_migration.tar.gz || true
    
    # Dump Database
    if $DOCKER_CMD compose -p $PROJECT_NAME exec db pg_isready -U user -d inventory_db &>/dev/null; then
        echo "Dumping database..."
        $DOCKER_CMD compose -p $PROJECT_NAME exec -T db pg_dump -U user -d inventory_db > /tmp/inventory_auto_backup.sql 2>/dev/null || echo "Database dump skipped (no data or empty schema)."
    fi
    
    # Copy Uploads
    if $DOCKER_CMD compose -p $PROJECT_NAME ps app 2>/dev/null | grep -q "Up"; then
        echo "Backing up uploaded datasheets and images..."
        APP_CONTAINER_ID=$($DOCKER_CMD compose -p $PROJECT_NAME ps -q app 2>/dev/null)
        if [ -n "$APP_CONTAINER_ID" ]; then
            $DOCKER_CMD cp "$APP_CONTAINER_ID":/app/public/uploads /tmp/inventory_auto_uploads 2>/dev/null || echo "Uploads copy skipped."
        fi
    fi
    
    # Package into consolidated tarball
    if [ -f /tmp/inventory_auto_backup.sql ] || [ -d /tmp/inventory_auto_uploads ]; then
        tar -czf /tmp/inventory_auto_migration.tar.gz -C /tmp inventory_auto_backup.sql inventory_auto_uploads 2>/dev/null || true
        echo -e "${GREEN}✓ Automated migration backup created successfully.${NC}"
    fi
    
    # Clean up temporary folders
    rm -rf /tmp/inventory_auto_backup.sql /tmp/inventory_auto_uploads || true
fi

# Stop existing containers if they are running to avoid port conflicts
echo "Ensuring any existing version is stopped..."
$DOCKER_CMD compose -p $PROJECT_NAME down --remove-orphans &> /dev/null || true

echo "Starting fresh containers..."
$DOCKER_CMD compose -p $PROJECT_NAME up -d --build

# 4. Wait for database to be ready
echo "Waiting for the database to be healthy..."
RETRY_COUNT=0
MAX_RETRIES=30
while ! $DOCKER_CMD compose -p $PROJECT_NAME exec db pg_isready -U user -d inventory_db &> /dev/null; do
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "Error: Database timed out."
        exit 1
    fi
    echo -n "."
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT + 1))
done
echo -e "\n✓ Database is ready."

# 5. Automated Data Restore Hook
RESTORED=false
if [ -f /tmp/inventory_auto_migration.tar.gz ]; then
    echo -e "${YELLOW}Automated migration backup detected. Restoring your database and uploaded files...${NC}"
    
    # Extract
    tar -xzf /tmp/inventory_auto_migration.tar.gz -C /tmp 2>/dev/null || true
    
    # Drop and recreate schema to ensure clean state
    $DOCKER_CMD compose -p $PROJECT_NAME exec -T db psql -U user -d inventory_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" &>/dev/null || true
    
    # Restore SQL
    if [ -f /tmp/inventory_auto_backup.sql ]; then
        echo "Restoring database records..."
        $DOCKER_CMD compose -p $PROJECT_NAME exec -T db psql -U user -d inventory_db < /tmp/inventory_auto_backup.sql &>/dev/null || echo "Database restore had some warnings."
    fi
    
    # Restore Uploads
    if [ -d /tmp/inventory_auto_uploads ]; then
        echo "Restoring uploaded datasheets and images..."
        APP_CONTAINER_ID=$($DOCKER_CMD compose -p $PROJECT_NAME ps -q app 2>/dev/null)
        if [ -n "$APP_CONTAINER_ID" ]; then
            $DOCKER_CMD cp /tmp/inventory_auto_uploads/. "$APP_CONTAINER_ID":/app/public/uploads 2>/dev/null || true
        fi
    fi
    
    # Clean up
    rm -rf /tmp/inventory_auto_backup.sql /tmp/inventory_auto_uploads /tmp/inventory_auto_migration.tar.gz || true
    RESTORED=true
    echo -e "${GREEN}✓ Automated restore completed successfully! All data and files migrated.${NC}"
fi

# 6. Initialize Database Schema & Generate Prisma Client
echo "Initializing database schema and generating client..."
$DOCKER_CMD compose -p $PROJECT_NAME exec app npx prisma db push
$DOCKER_CMD compose -p $PROJECT_NAME exec app npx prisma generate

# 7. Seed the Database (Only if we didn't just restore a backup)
if [ "$RESTORED" = false ]; then
    echo "Ensuring default admin user and icons are seeded..."
    $DOCKER_CMD compose -p $PROJECT_NAME exec app npx prisma db seed
fi

echo "--------------------------------------------------------"
echo "✓ SETUP/UPDATE COMPLETE!"
echo "--------------------------------------------------------"
echo "You can now access InventoryPro at: http://localhost:3000"
echo "Default Credentials:"
echo "   Username: admin"
echo "   Password: password123"
echo "--------------------------------------------------------"
echo "Happy Making!"
