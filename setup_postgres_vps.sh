#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

echo "[1/4] Installing PostgreSQL..."
apt-get update -y
apt-get install -y postgresql postgresql-contrib

systemctl start postgresql
systemctl enable postgresql

echo "[2/4] Setting up Database and User..."
sudo -u postgres psql -c "CREATE DATABASE rebill_db;" || true
sudo -u postgres psql -c "CREATE USER rebill_user WITH PASSWORD 'RebillSecurePass2026!';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rebill_db TO rebill_user;" || true
sudo -u postgres psql -c "ALTER DATABASE rebill_db OWNER TO rebill_user;" || true
sudo -u postgres psql -d rebill_db -c "GRANT ALL ON SCHEMA public TO rebill_user;" || true

echo "[3/4] Configuring Remote Access (listen_addresses = '*')..."
PG_VER=$(ls /etc/postgresql/ | head -n 1)
CONF="/etc/postgresql/$PG_VER/main/postgresql.conf"
HBA="/etc/postgresql/$PG_VER/main/pg_hba.conf"

sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$CONF"
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/g" "$CONF"

if ! grep -q "0.0.0.0/0" "$HBA"; then
    echo "host    all             all             0.0.0.0/0               md5" >> "$HBA"
    echo "host    all             all             0.0.0.0/0               scram-sha-256" >> "$HBA"
fi

systemctl restart postgresql

echo "[4/4] Updating VPS backend .env file..."
cat << 'EOF' > /var/www/rebill/backend/.env
SECRET_KEY=django-insecure-rebill-prod-key-change-me
DEBUG=False
ALLOWED_HOSTS=*
DB_ENGINE=django.db.backends.postgresql
DB_NAME=rebill_db
DB_USER=rebill_user
DB_PASSWORD=RebillSecurePass2026!
DB_HOST=127.0.0.1
DB_PORT=5432
EOF

cd /var/www/rebill/backend
source venv/bin/activate
pip install psycopg2-binary
python manage.py migrate
python manage.py seed_demo || true

systemctl restart rebill-backend

echo "=== PostgreSQL Setup Complete! ==="
