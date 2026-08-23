#!/bin/bash
set -e

echo "=================================================="
echo "      Rebill - Automatic Docker VPS Setup         "
echo "=================================================="

# 1. Update and install prerequisites
echo "[1/5] Installing dependencies..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git

# 2. Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "[2/5] Installing Docker Engine..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker installed successfully!"
else
    echo "[2/5] Docker is already installed."
fi

# 3. Stop conflicting host services (Host Nginx & old systemd service)
echo "[3/5] Cleaning up old host services to free Port 80..."
if systemctl is-active --quiet rebill-backend; then
    systemctl stop rebill-backend || true
    systemctl disable rebill-backend || true
fi

if systemctl is-active --quiet nginx; then
    systemctl stop nginx || true
    systemctl disable nginx || true
fi

# 4. Project Directory & Env Check
APP_DIR="/var/www/rebill"
echo "[4/5] Checking project at $APP_DIR..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin main || true
else
    git clone https://github.com/badarpurboom/rebill.git "$APP_DIR"
    cd "$APP_DIR"
fi

if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
    else
        echo "SECRET_KEY=django-insecure-rebill-prod-key" > backend/.env
        echo "DEBUG=False" >> backend/.env
        echo "ALLOWED_HOSTS=*" >> backend/.env
    fi
fi

# Update DB_HOST to host.docker.internal for container networking
if [ -f "backend/.env" ]; then
    sed -i 's/DB_HOST=127.0.0.1/DB_HOST=host.docker.internal/g' backend/.env
    sed -i 's/DB_HOST=localhost/DB_HOST=host.docker.internal/g' backend/.env
fi

# Ensure sqlite database file exists if using sqlite
touch backend/db.sqlite3

# 5. Build and Launch Containers
echo "[5/5] Building and starting Docker containers..."
docker compose down || true
docker compose up --build -d

echo ""
echo "=================================================="
echo " Docker Setup Complete! Rebill is running live!"
echo " URL: http://$(curl -s ifconfig.me || echo 'your-vps-ip')"
echo "=================================================="
