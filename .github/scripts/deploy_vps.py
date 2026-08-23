import os
import sys
import paramiko
import io

def safe_print(val):
    try:
        print(val)
    except Exception:
        print(str(val).encode('ascii', errors='replace').decode('ascii'))

# Read secrets with fallback to verified defaults
host = os.environ.get("VPS_HOST", "").strip() or "200.141.11.187"
user = os.environ.get("VPS_USERNAME", "").strip() or "root"
ssh_key_str = os.environ.get("SSH_PRIVATE_KEY", "").strip()
password = os.environ.get("VPS_PASSWORD", "").strip() or r"q,2,'2zh34.GTe&g"

safe_print(f"Target VPS: {user}@{host}")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

connected = False

# 1. Try SSH Key if available
if ssh_key_str:
    try:
        safe_print("Attempting connection via SSH Key...")
        clean_key = ssh_key_str.replace('\r\n', '\n').replace('\r', '\n').strip()
        pkey = paramiko.RSAKey.from_private_key(io.StringIO(clean_key))
        client.connect(host, username=user, pkey=pkey, timeout=30)
        connected = True
        safe_print("Connected successfully via SSH Key!\n")
    except Exception as e:
        safe_print(f"SSH Key notice: {e}")

# 2. Fallback to Password
if not connected and password:
    try:
        safe_print("Attempting connection via Password...")
        client.connect(host, username=user, password=password, timeout=30)
        connected = True
        safe_print("Connected successfully via Password!\n")
    except Exception as e:
        safe_print(f"Password notice: {e}")

if not connected:
    safe_print("ERROR: Could not authenticate to VPS with SSH Key or Password.")
    sys.exit(1)

try:
    commands = [
        (
            "cd /var/www/rebill && git fetch origin main && git reset --hard origin/main && git pull origin main",
            "Pulling latest code from GitHub..."
        ),
        (
            "cd /var/www/rebill && docker compose up --build -d --remove-orphans",
            "Building & restarting Docker containers (Backend + Frontend + Nginx)..."
        ),
        (
            "docker ps --filter 'name=rebill' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
            "Verifying running Docker containers..."
        ),
    ]

    for cmd, description in commands:
        safe_print(f"[>>] {description}")
        stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()

        if out:
            safe_print(f"    {out[:1000]}")
        if exit_code != 0:
            safe_print(f"    ERROR (exit {exit_code}): {err[:500]}")
            safe_print(f"Deployment failed at: {description}")
            sys.exit(exit_code)
        else:
            safe_print("    OK")

    safe_print("\n=======================================================")
    safe_print("DOCKER DEPLOYMENT COMPLETE! App is live on VPS!")
    safe_print("=======================================================")

finally:
    client.close()
