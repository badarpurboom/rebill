import paramiko
import time

host = "200.141.11.187"
user = "root"
password = r"q,2,'2zh34.GTe&g"

print(f"Connecting to {host}...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(host, username=user, password=password, timeout=10)
    print("Connected successfully!")
    
    commands = [
        "cd /var/www/rebill && git pull origin main",
        "cd /var/www/rebill/frontend && npm install",
        "cd /var/www/rebill/frontend && npm run build"
    ]
    
    for cmd in commands:
        print(f"Running: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        
        # Wait for command to finish
        exit_status = stdout.channel.recv_exit_status()
        
        out = stdout.read().decode('utf-8')
        err = stderr.read().decode('utf-8')
        
        if out: print("OUTPUT:\n", out)
        if err: print("ERROR:\n", err)
        print(f"Exit status: {exit_status}\n{'-'*40}")
        
finally:
    client.close()
    print("Connection closed.")
