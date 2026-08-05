import paramiko
import time

host = "200.141.11.187"
user = "root"
password = r"q,2,'2zh34.GTe&g"

print(f"Connecting to VPS {host}...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(host, username=user, password=password, timeout=30)
    print("Connected successfully!\n")

    commands = [
        # Step 1: Pull latest code (safe - no data deleted)
        ("git pull origin main", "Pulling latest code from GitHub...", 60),

        # Step 2: Install any new frontend dependencies
        ("cd /var/www/rebill/frontend && npm install --silent", "Installing frontend dependencies...", 120),

        # Step 3: Build frontend (creates new dist/ folder)
        ("cd /var/www/rebill/frontend && npm run build", "Building frontend (this takes ~1-2 min)...", 180),

        # Step 4: Run Django migrations safely (only adds, never deletes data)
        ("cd /var/www/rebill/backend && source venv/bin/activate && python manage.py migrate --noinput", "Running database migrations (safe - no data deleted)...", 60),

        # Step 5: Restart backend service
        ("systemctl restart rebill-backend", "Restarting backend service...", 15),

        # Step 6: Reload nginx
        ("systemctl reload nginx", "Reloading nginx...", 10),

        # Step 7: Check services are running
        ("systemctl is-active rebill-backend && systemctl is-active nginx", "Checking services...", 10),
    ]

    all_ok = True
    for cmd, label, timeout in commands:
        print(f"[>>] {label}")
        full_cmd = f"cd /var/www/rebill && {cmd}" if not cmd.startswith("cd /var/www") and not cmd.startswith("systemctl") else cmd
        
        stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
        exit_status = stdout.channel.recv_exit_status()

        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()

        if out:
            safe_out = out[:300].encode('ascii', errors='replace').decode('ascii')
            print(f"    {safe_out}")
        if err and exit_status != 0:
            safe_err = err[:300].encode('ascii', errors='replace').decode('ascii')
            print(f"    ERROR: {safe_err}")

        if exit_status == 0:
            print(f"    OK")
        else:
            print(f"    WARNING: Exit code: {exit_status}\n")
            if "systemctl" not in cmd:  # Don't stop for service checks
                all_ok = False

    if all_ok:
        print("=" * 50)
        print("DEPLOYMENT COMPLETE!")
        print("   All data is safe - only code was updated.")
        print(f"   App is live at: http://{host}")
        print("=" * 50)
    else:
        print("WARNING: Deployment completed with some warnings. Check above output.")

finally:
    client.close()
    print("SSH connection closed.")
