#!/bin/bash
# deploy-kenso-dashboard.sh
# Usage: ./deploy/deploy-kenso-dashboard.sh

set -e

APP_DIR="/var/www/kenso-dashboard"
NGINX_CONF="deploy/nginx-kenso-dashboard.conf"
ECOSYSTEM="ecosystem.config.js"

echo "==> Pulling latest code"
cd "$APP_DIR"
git pull origin feat/kenso-dashboard

echo "==> Installing dependencies"
npm install --production

echo "==> Building standalone Next.js"
npm run build

echo "==> Restarting PM2"
pm2 restart kenso-dashboard --update-env

echo "==> Reloading nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "Done. Dashboard running at http://127.0.0.1:3000"
