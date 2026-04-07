#!/bin/bash
# deploy-kenso-dashboard.sh
# Usage: ./deploy/deploy-kenso-dashboard.sh

set -e

APP_DIR="/var/www/kenso-dashboard"

echo "==> Pulling latest code"
cd "$APP_DIR"
git pull origin feat/kenso-dashboard

echo "==> Building Docker image"
docker compose build dashboard

echo "==> Starting containers (detach)"
docker compose up -d dashboard

echo "Done. Dashboard running at http://127.0.0.1:3000"
