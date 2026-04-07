# Kenso Deployment Guide

Running **kenso-dashboard** (Next.js) and **kenso-audio-engine** (Go) together via Docker Compose on a single AWS server.

---

## Architecture

```
Internet
    │
    ▼
Caddy (:80/:443)  ←  audio.knownsense.ai  +  kenso.knownsense.ai
    │
    ├── audio-engine:8080   ← Go WebRTC SFU + REST API
    └── dashboard:3000       ← Next.js Dashboard
```

- **Caddy**: reverse proxy + automatic HTTPS (no manual certbot)
- **audio-engine** (`knownsense-audio-engine`): Go server, port 8080
- **dashboard** (`kenso-dashboard`): Next.js, port 3000 (internal)
- **coturn**: TURN server for WebRTC NAT traversal

Both frontend and backend are on the same Docker network — no port forwarding needed for internal communication.

---

## Prerequisites

- AWS Ubuntu 22.04+
- Docker + Docker Compose v2 installed
- Two subdomains pointed to your server IP:
  - `audio.knownsense.ai` → Go API + WebSocket
  - `kenso.knownsense.ai` → Dashboard frontend

---

## Setup

### 1. Clone repos

```bash
# kenso-audio-engine (backend)
mkdir -p /opt/kenso-audio-engine
cd /opt/kenso-audio-engine
git clone https://github.com/cupcake08/knownsense-audio-engine.git .
git checkout main

# kenso-dashboard (frontend)
mkdir -p /opt/kenso-dashboard
cd /opt/kenso-dashboard
git clone -b feat/kenso-dashboard https://github.com/cupcake08/kenso-dashboard.git .
git checkout feat/kenso-dashboard
```

### 2. Create environment file

```bash
cd /opt/kenso-audio-engine
cp .env.example .env
nano .env
```

Fill in the required values:

```env
# Domain
ALLOWED_ORIGINS=https://kenso.knownsense.ai,https://audio.knownsense.ai

# Firebase
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_CREDENTIALS_FILE=/app/firebase-credentials.json

# Storage
STORAGE_BUCKET=your-project.appspot.com

# API + Auth
ADMIN_API_KEY=your-admin-key
SFU_SHARED_SECRET=your-secure-secret

# TURN server
EXTERNAL_IP=your-server-ip
TURN_USERNAME=turnuser
TURN_PASSWORD=turnpassword

# Dashboard env (shared between docker-compose and dashboard)
NEXT_PUBLIC_API_BASE=https://audio.knownsense.ai
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...

# Public URL
PUBLIC_URL=https://audio.knownsense.ai
```

### 3. Firebase credentials

```bash
# Download service account key from Firebase Console
# Save as firebase-credentials.json in /opt/kenso-audio-engine/
```

### 4. TURN server config

```bash
# Create turnserver.conf in /opt/kenso-audio-engine/
sudo cp /opt/kenso-audio-engine/turnserver.conf.example /opt/kenso-audio-engine/turnserver.conf
# Edit the conf file with your server IP and credentials
```

---

## Running

```bash
cd /opt/kenso-audio-engine

# Pull latest code
git pull

# Build and start all containers
docker compose up -d --build

# Check status
docker compose ps

# Follow logs
docker compose logs -f
docker compose logs -f dashboard
docker compose logs -f audio-engine
```

---

## Stopping

```bash
docker compose down        # stop containers
docker compose down -v    # stop + remove volumes
```

---

## Updating

```bash
cd /opt/kenso-audio-engine
git pull

cd /opt/kenso-dashboard
git pull

# Rebuild + restart
cd /opt/kenso-audio-engine
docker compose up -d --build
```

---

## Docker Network

Both services are on `knownsense-net`:

| Container | Internal IP | Exposed Port |
|-----------|------------|--------------|
| audio-engine | `audio-engine:8080` | none (internal) |
| dashboard | `dashboard:3000` | none (internal) |
| caddy | caddy:80/443 | :80, :443 |
| coturn | host network | (used for TURN) |

Dashboard calls the API at `http://audio-engine:8080` internally (via `NEXT_PUBLIC_API_BASE`).

---

## File Locations

```
/opt/kenso-audio-engine/          # Go server + docker-compose
  ├── docker-compose.yml
  ├── Caddyfile                   # Routes both domains
  ├── turnserver.conf
  ├── .env                        # Secrets + config
  └── firebase-credentials.json

/opt/kenso-dashboard/             # Next.js dashboard
  ├── Dockerfile
  ├── docker-compose.yml          # Standalone (dev only)
  └── ecosystem.config.js         # PM2 (optional non-Docker)
```

---

## Troubleshooting

### Dashboard shows "Failed to fetch"

```bash
# Check NEXT_PUBLIC_API_BASE is set to audio.knownsense.ai
docker compose exec dashboard env | grep NEXT_PUBLIC_API_BASE

# Verify audio-engine is healthy
curl http://localhost:8080/health
docker compose logs audio-engine
```

### Caddy not routing to dashboard

```bash
# Check Caddy config loaded
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile

# Check Caddy logs
docker compose logs caddy
```

### WebSocket connection fails

```bash
# Verify coturn is running (TURN needed for remote clients)
docker compose logs coturn

# Check STUN/TURN credentials match in .env
```

---

## Ports

| Port | Service |
|------|---------|
| `:80` | Caddy HTTP (redirects to HTTPS) |
| `:443` | Caddy HTTPS (audio.knownsense.ai + kenso.knownsense.ai) |
