# Kenso Deployment Guide

Complete setup for running **kenso-dashboard** (Next.js) alongside **kenso-audio-engine** (Go) on a single AWS server.

---

## Architecture

```
Internet
    │
    ▼
nginx-proxy (:80/:443)
    │
    ├── /         → dashboard:3000  (Next.js)
    ├── /api/v2/* → host.docker.internal:8080  (Go SFU + REST API)
    └── /ws        → host.docker.internal:8080  (WebSocket)
```

- **Go server** (`kenso-audio-engine`): port `8080`, handles WebRTC SFU + REST API
- **Next.js dashboard** (`kenso-dashboard`): port `3000`, standalone container
- **nginx-proxy**: reverse proxy, SSL termination

---

## Prerequisites

- AWS Ubuntu 22.04+ instance
- Domain pointed to server IP (`kenso.yourdomain.com`)
- Docker + Docker Compose installed
- GitHub access to `cupcake08/kenso-dashboard` and `cupcake08/knownsense-audio-engine`

---

## One-Time Server Setup

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo systemctl enable docker
```

### 2. Install Certbot for SSL

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 3. Clone both repos

```bash
# kenso-dashboard (frontend)
sudo mkdir -p /var/www/kenso-dashboard
cd /var/www/kenso-dashboard
git clone -b feat/kenso-dashboard https://github.com/cupcake08/kenso-dashboard.git .
git checkout feat/kenso-dashboard

# kenso-audio-engine (backend)
sudo mkdir -p /opt/kenso-audio-engine
cd /opt/kenso-audio-engine
git clone https://github.com/cupcake08/knownsense-audio-engine.git .
```

---

## Configuration

### kenso-dashboard

```bash
cd /var/www/kenso-dashboard

# Create .env from example
cp .env.production.example .env
nano .env
```

Fill in:

```env
NEXT_PUBLIC_API_BASE=https://kenso.yourdomain.com
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

### SSL Certificates

```bash
sudo mkdir -p /etc/nginx/secrets
sudo certbot certonly --nginx -d kenso.yourdomain.com --email your@email.com --agree-tos --non-interactive
sudo cp /etc/letsencrypt/live/kenso.yourdomain.com/fullchain.pem /etc/nginx/secrets/
sudo cp /etc/letsencrypt/live/kenso.yourdomain.com/privkey.pem /etc/nginx/secrets/
```

### kenso-audio-engine

Set env vars for the Go server. Key ones:

```bash
# .env in /opt/kenso-audio-engine
FIRESTORE_EMULATOR_HOST=localhost:8081        # only for local dev
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
ALLOWED_ORIGINS=https://kenso.yourdomain.com
SFU_SHARED_SECRET=your-secure-secret-here
ADMIN_API_KEY=your-admin-key
KENSO_RTDB_URL=https://your-project-default-rtdb.firebaseio.com
PORT=8080
```

---

## Starting Services

### Start the Go backend

```bash
cd /opt/kenso-audio-engine

# Build the Go binary
go build -o kenso-server ./cmd/server

# Run (production)
PORT=8080 ALLOWED_ORIGINS=https://kenso.yourdomain.com SFU_SHARED_SECRET=... ADMIN_API_KEY=... ./kenso-server

# Or with systemd — see deploy/systemd-kenso-server.service
sudo cp deploy/systemd-kenso-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kenso-server
sudo systemctl start kenso-server
```

### Start the dashboard

```bash
cd /var/www/kenso-dashboard

# Build + start containers
docker compose build dashboard
docker compose up -d dashboard
```

Check logs:

```bash
docker compose logs -f dashboard
```

---

## Updating

### Dashboard

```bash
cd /var/www/kenso-dashboard
git pull origin feat/kenso-dashboard
docker compose build dashboard
docker compose up -d dashboard
```

### Go backend

```bash
cd /opt/kenso-audio-engine
git pull origin main
go build -o kenso-server ./cmd/server
sudo systemctl restart kenso-server
```

---

## Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Go server | `8080` | REST API + WebSocket SFU |
| Next.js | `3000` | Dashboard (internal only) |
| nginx | `80` / `443` | Public HTTPS |

---

## File Locations

```
/var/www/kenso-dashboard/          # Next.js dashboard
/opt/kenso-audio-engine/            # Go server
/etc/systemd/system/kenso-server.service
/etc/nginx/secrets/                  # SSL certs (fullchain.pem, privkey.pem)
```

---

## Troubleshooting

### Dashboard won't start

```bash
docker compose logs dashboard
# Check .env vars are set correctly
docker compose exec dashboard env | grep NEXT_PUBLIC
```

### API calls returning 500

```bash
# Verify Go server is running
curl http://localhost:8080/health
# Check Go server logs
sudo journalctl -u kenso-server -f
```

### SSL cert issues

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### nginx not routing to Go backend

Ensure `host.docker.internal` resolves on your Docker version. If not, add `--add-host=host.docker.internal:host-gateway` to the nginx container in `docker-compose.yml`.
