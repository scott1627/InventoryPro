# InventoryPro

Modern Parts Management for Makers and Engineers.

## 🚀 Quick Start (Deployment)
To deploy InventoryPro on your local machine or server, run the single-command setup. **The script will even offer to install Docker for you** if you are on an Ubuntu/Debian-based system:

```bash
chmod +x setup.sh
./setup.sh
```

### 🔄 Updating to the Latest Version
If you want to pull the latest features and updates from GitHub, simply run:

```bash
chmod +x update.sh
./update.sh
```
This will pull the latest code and re-build the system while **keeping all your data safe** in the database.


This script will:
1. Verify Your environment.
2. Build and start the containers.
3. Automatically initialize the database.
4. Set up the default admin account.

### 🔑 Default Credentials
- **Username**: `admin`
- **Password**: `password123`

---

## 🛠 Features
- **Comprehensive Inventory Control**: Track parts, categories, and storage locations.
- **BOM & Production Jobs**: Build assemblies and track stock deduction automatically.
- **Activity Tracking**: Full audit trail of who changed what and when.
- **Data Safety**: Built-in backup and restore functionality.
- **Clean UI**: Modern, responsive dashboard with dark mode support.

## 📖 Documentation
A full user manual is available at `/admin/docs` once the system is running.

---
Built for the modern maker lab. Open source and self-hosted.
