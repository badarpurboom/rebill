#!/bin/bash
set -e

echo "=== Starting Rebill Automated Deployment on VPS ==="

# 1. System Updates & Dependencies
echo "[1/6] Installing system packages..."
apt-get update -y
apt-get install -y git python3 python3-pip python3-venv nginx curl

# 2. Setup Application Directory
APP_DIR="/var/www/rebill"
echo "[2/6] Setting up project directory at $APP_DIR..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin main
else
    git clone https://github.com/badarpurboom/rebill.git "$APP_DIR"
    cd "$APP_DIR"
fi

# 3. Backend Setup
echo "[3/6] Setting up Django Backend..."
cd "$APP_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Ensure .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
    else
        echo "SECRET_KEY=django-insecure-rebill-prod-key-change-me" > .env
        echo "DEBUG=False" >> .env
        echo "ALLOWED_HOSTS=*" >> .env
    fi
fi

python3 manage.py migrate --noinput

# 4. Frontend Setup
echo "[4/6] Setting up Vite Frontend..."
cd "$APP_DIR/frontend"
echo "Ensuring Node.js 22 is installed..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs



npm install
npm run build

# 5. Systemd Gunicorn Service
echo "[5/6] Creating Gunicorn systemd service..."
cat << 'EOF' > /etc/systemd/system/rebill-backend.service
[Unit]
Description=Rebill Django Backend Service
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/rebill/backend
ExecStart=/var/www/rebill/backend/venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable rebill-backend
systemctl restart rebill-backend

# 6. Nginx Reverse Proxy Setup
echo "[6/6] Configuring Nginx Web Server..."
cat << 'EOF' > /etc/nginx/sites-available/rebill
server {
    listen 80;
    server_name _;

    root /var/www/rebill/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/rebill /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

echo "=== Deployment Complete! Rebill is live on http://$(curl -s ifconfig.me) ==="
