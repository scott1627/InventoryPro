#!/bin/bash

# InventoryPro Update Script
# This script pulls the latest code from GitHub and re-runs the setup.

set -e

echo "--------------------------------------------------------"
echo "   InventoryPro - Automatically Updating System         "
echo "--------------------------------------------------------"

# 1. Pull Latest Changes
if [ -d .git ]; then
    echo "Pulling latest changes from GitHub..."
    git pull origin main
else
    echo "Warning: No .git directory found. Skipping code pull."
fi

# 2. Run Setup
echo "Running setup to apply any database or dependency changes..."
./setup.sh

echo "--------------------------------------------------------"
echo "✓ UPDATE COMPLETE!"
echo "--------------------------------------------------------"
