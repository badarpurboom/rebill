import os
import sys
import paramiko
import io
import time

def safe_print(val):
    try:
        print(val)
    except Exception:
        print(str(val).encode('ascii', errors='replace').decode('ascii'))

# Read environment variables with fallback
host = os.environ.get("VPS_HOST", "").strip() or "200.141.11.187"
user = os.environ.get("VPS_USERNAME", "").strip() or "root"
ssh_key_str = os.environ.get("SSH_PRIVATE_KEY", "").strip()
env_password = os.environ.get("VPS_PASSWORD", "").strip()
default_password = r"q,2,'2zh34.GTe&g"

safe_print(f"Target VPS: {user}@{host}")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

connected = False

# 1. Attempt connection via SSH Key if present
if ssh_key_str and len(ssh_key_str) > 50:
    try:
        safe_print("Attempting connection via SSH Private Key...")
        clean_key = ssh_key_str.replace('\r\n', '\n').replace('\r', '\n').strip()
        if not clean_key.endswith('\n'):
            clean_key += '\n'
        
        # Try RSA Key first
        try:
            pkey = paramiko.RSAKey.from_private_key(io.StringIO(clean_key))
        except Exception:
            pkey = paramiko.Ed25519Key.from_private_key(io.StringIO(clean_key))

        client.connect(
            hostname=host,
            username=user,
            pkey=pkey,
            timeout=20,
            banner_timeout=45,
            auth_timeout=45,
            look_for_keys=False,
            allow_agent=False
        )
        connected = True
        safe_print(">> Connected successfully via SSH Key!\n")
    except Exception as e:
        safe_print(f"SSH Key connection notice: {e}")

# 2. Attempt connection via Environment Password
if not connected and env_password:
    try:
        safe_print("Attempting connection via Environment Password...")
        client.connect(
            hostname=host,
            username=user,
            password=env_password,
            timeout=20,
            banner_timeout=45,
            auth_timeout=45,
            look_for_keys=False,
            allow_agent=False
        )
        connected = True
        safe_print(">> Connected successfully via Environment Password!\n")
    except Exception as e:
        safe_print(f"Environment Password connection notice: {e}")

# 3. Attempt connection via Default Verified Password
if not connected and default_password != env_password:
    try:
        safe_print("Attempting connection via Verified Default Credentials...")
        client.connect(
            hostname=host,
            username=user,
            password=default_password,
            timeout=20,
            banner_timeout=45,
            auth_timeout=45,
            look_for_keys=False,
            allow_agent=False
        )
        connected = True
        safe_print(">> Connected successfully via Verified Default Credentials!\n")
    except Exception as e:
        safe_print(f"Default Password connection notice: {e}")

if not connected:
    safe_print("ERROR: Could not authenticate to VPS with any method.")
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
