import os
import sys
import paramiko

# Reconfigure stdout/stderr to utf-8 safely
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def safe_str(val):
    if isinstance(val, bytes):
        val = val.decode('utf-8', errors='replace')
    return val.encode('ascii', errors='replace').decode('ascii')

host = os.environ.get("VPS_HOST", "200.141.11.187").strip()
user = os.environ.get("VPS_USERNAME", "root").strip()
password = os.environ.get("VPS_PASSWORD", "").strip()

if not password:
    print("ERROR: VPS_PASSWORD environment variable is empty. Please check GitHub Secrets!")
    sys.exit(1)

print(safe_str(f"Connecting to VPS {host} as {user}..."))
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(host, username=user, password=password, timeout=30)
    print(safe_str("Connected successfully to VPS!\n"))

    commands = [
        ("cd /var/www/rebill && git fetch origin main && git reset --hard origin/main && git pull origin main", "Pulling latest code from GitHub..."),
        ("cd /var/www/rebill/frontend && npm install --silent", "Installing frontend dependencies..."),
        ("cd /var/www/rebill/frontend && npm run build", "Building frontend..."),
        ("cd /var/www/rebill/backend && source venv/bin/activate && pip install -r requirements.txt --quiet && python manage.py migrate --noinput", "Running Django migrations..."),
        ("systemctl restart rebill-backend", "Restarting backend service..."),
        ("systemctl reload nginx", "Reloading Nginx..."),
        ("systemctl is-active rebill-backend && systemctl is-active nginx", "Checking active services...")
    ]

    for cmd, description in commands:
        print(safe_str(f"[>>] {description}"))
        stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()

        if out:
            print(safe_str(f"    {out[:500]}"))
        if exit_code != 0:
            print(safe_str(f"    ERROR (exit code {exit_code}): {err[:500]}"))
            if "systemctl" not in cmd and "is-active" not in cmd:
                print(safe_str(f"Deployment failed at step: {description}"))
                sys.exit(exit_code)
        else:
            print(safe_str("    OK"))

    print(safe_str("\n=========================================="))
    print(safe_str("DEPLOYMENT COMPLETE! App is live on VPS!"))
    print(safe_str("=========================================="))

except Exception as e:
    print(safe_str(f"SSH Exception: {e}"))
    sys.exit(1)
finally:
    client.close()
