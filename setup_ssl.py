import paramiko
import sys
import io

# Force utf-8 stdout/stderr encoding on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

host = "200.141.11.187"
user = "root"
password = r"q,2,'2zh34.GTe&g"

def run_remote_command(client, cmd):
    print(f"\n--- Running: {cmd} ---", flush=True)
    stdin, stdout, stderr = client.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out:
        print("STDOUT:\n" + out, flush=True)
    if err:
        print("STDERR:\n" + err, flush=True)
    print(f"Exit code: {exit_status}", flush=True)
    return exit_status, out, err

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    print(f"Connecting to {host}...", flush=True)
    client.connect(host, username=user, password=password, timeout=15)
    print("Connected successfully!", flush=True)

    # Check if certbot installed
    status, out, err = run_remote_command(client, "which certbot")
    if status != 0:
        print("Installing Certbot...", flush=True)
        run_remote_command(client, "apt-get update && apt-get install -y certbot python3-certbot-nginx")

    # Request and configure SSL certificate
    print("Requesting SSL Certificate from Let's Encrypt for laoo.online & www.laoo.online...", flush=True)
    cmd_certbot = "certbot --nginx -d laoo.online -d www.laoo.online --non-interactive --agree-tos -m admin@laoo.online --redirect"
    status, out, err = run_remote_command(client, cmd_certbot)

    if status == 0:
        print("\n=======================================================", flush=True)
        print("SUCCESS! SSL Certificate successfully installed for laoo.online", flush=True)
        print("=======================================================", flush=True)
    else:
        print("\nRetrying certbot for laoo.online only...", flush=True)
        cmd_fallback = "certbot --nginx -d laoo.online --non-interactive --agree-tos -m admin@laoo.online --redirect"
        run_remote_command(client, cmd_fallback)

finally:
    client.close()
    print("SSH session closed.", flush=True)
