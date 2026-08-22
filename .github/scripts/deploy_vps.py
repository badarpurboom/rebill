import os
import sys
import paramiko
import io

def safe_print(val):
    try:
        print(val)
    except Exception:
        print(str(val).encode('ascii', errors='replace').decode('ascii'))

host = os.environ.get("VPS_HOST", "200.141.11.187").strip()
user = os.environ.get("VPS_USERNAME", "root").strip()
ssh_key_str = os.environ.get("SSH_PRIVATE_KEY", "").strip()
password = os.environ.get("VPS_PASSWORD", "").strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

connected = False

# 1. Try SSH Key first
if ssh_key_str:
    try:
        safe_print(f"Connecting to VPS {host} as {user} using SSH Key...")
        clean_key = ssh_key_str.replace('\r\n', '\n').replace('\r', '\n').strip()
        pkey = paramiko.RSAKey.from_private_key(io.StringIO(clean_key))
        client.connect(host, username=user, pkey=pkey, timeout=30)
        connected = True
        safe_print("Connected successfully via SSH Key!\n")
    except Exception as e:
        safe_print(f"SSH Key connection notice: {e}")

# 2. Fallback to Password if SSH Key was not successful
if not connected and password:
    try:
        safe_print(f"Connecting to VPS {host} as {user} using Password...")
        client.connect(host, username=user, password=password, timeout=30)
        connected = True
        safe_print("Connected successfully via Password!\n")
    except Exception as e:
        safe_print(f"Password connection error: {e}")

if not connected:
    safe_print("ERROR: Authentication failed. Please verify SSH_PRIVATE_KEY or VPS_PASSWORD in GitHub Secrets.")
    sys.exit(1)

try:
    commands = [
        (
            "cd /var/www/rebill && git fetch origin main && git reset --hard origin/main && git pull origin main",
            "Pulling latest code from GitHub..."
        ),
        (
            "cd /var/www/rebill/frontend && npm install --silent",
            "Installing frontend dependencies..."
        ),
        (
            "cd /var/www/rebill/frontend && npm run build",
            "Building frontend..."
        ),
        (
            "cd /var/www/rebill/backend && source venv/bin/activate && pip install -r requirements.txt --quiet && python manage.py migrate --noinput",
            "Running Django migrations..."
        ),
        (
            "systemctl restart rebill-backend",
            "Restarting backend service..."
        ),
        (
            "systemctl reload nginx",
            "Reloading Nginx..."
        ),
        (
            "systemctl is-active rebill-backend && systemctl is-active nginx",
            "Checking active services..."
        ),
    ]

    for cmd, description in commands:
        safe_print(f"[>>] {description}")
        stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()

        if out:
            safe_print(f"    {out[:500]}")
        if exit_code != 0:
            safe_print(f"    ERROR (exit {exit_code}): {err[:500]}")
            if "systemctl" not in cmd and "is-active" not in cmd:
                safe_print(f"Deployment failed at: {description}")
                sys.exit(exit_code)
        else:
            safe_print("    OK")

    safe_print("\n==========================================")
    safe_print("DEPLOYMENT COMPLETE! App is live on VPS!")
    safe_print("==========================================")

finally:
    client.close()
