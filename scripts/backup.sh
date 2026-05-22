#!/bin/bash

# Configuration
BACKUP_DIR="/home/user/backups/inventory-pro"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="inventory_backup_$TIMESTAMP"
CONTAINER_NAME="inventory-pro-db-1"
DB_NAME="inventory_db"
DB_USER="user"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup: $BACKUP_NAME"

# Dump Database
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_NAME.sql"

# Copy Uploads (PDFs)
docker cp inventory-pro-app-1:/app/public/uploads "$BACKUP_DIR/$BACKUP_NAME-uploads"

# Create archive
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME.sql" "$BACKUP_NAME-uploads"

# Cleanup temporary files
rm "$BACKUP_DIR/$BACKUP_NAME.sql"
rm -rf "$BACKUP_DIR/$BACKUP_NAME-uploads"

echo "Backup completed: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
