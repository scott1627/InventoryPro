---
description: How to set up and run InventoryPro on Ubuntu 24.04
---

# InventoryPro Setup Guide

Follow these steps to get your inventory system up and running.

## 1. Prerequisites
Ensure you have Docker and Docker Compose installed:
```bash
sudo apt update
sudo apt install docker.io docker-compose-v2 -y
sudo usermod -aG docker $USER
# Note: Log out and back in if this is the first time installing docker
```

## 2. Start the Services
Navigate to the project directory and run:
// turbo
```bash
docker-compose up -d
```

## 3. Database Initialization
Once the containers are running, initialize the database schema:
// turbo
```bash
docker-compose exec app npx prisma migrate dev --name init
```

## 4. Verification
- Open your browser to `http://localhost:3000` (or your server's IP).
- You should see the InventoryPro Dashboard.

## 5. Maintenance
To back up your data at any time:
```bash
./scripts/backup.sh
```
