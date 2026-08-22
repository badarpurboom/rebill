import os
import sys
import paramiko

host = os.environ.get("VPS_HOST", "200.141.11.187").strip()
user = os.environ.get("VPS_USERNAME", "root").strip()
password = os.environ.get("VPS_PASSWORD", "").strip()

if not password:
    print("ERROR: VPS_PASSWORD environment variable is empty. Please check GitHub Secrets!")
    sys.exit(1)

print(f"Connecting to VPS {host} as {user}...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(host, username=user, password=password, timeout=30)
    print("Connected successfully to VPS!\n")

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
        print(f"[>>] {description}")
        stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()

        if out:
            print(f"    {out[:500]}")
        if exit_code != 0:
            print(f"    ERROR (exit code {exit_code}): {err[:500]}")
            if "systemctl" not in cmd and "is-active" not in cmd:
                print(f"Deployment failed at step: {description}")
                sys.exit(exit_code)
        else:
            print("    OK")

    print("\n==========================================")
    print("DEPLOYMENT COMPLETE! App is live on VPS!")
    print("==========================================")

except Exception as e:
    print(f"SSH Exception: {e}")
    sys.exit(1)
finally:
    client.close()
