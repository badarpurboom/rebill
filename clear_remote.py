import paramiko
import time

host = "200.141.11.187"
user = "root"
password = r"q,2,'2zh34.GTe&g"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(host, username=user, password=password, timeout=10)
    print("Connected to VPS to clear tables...")
    
    script = """
import os, django
import sys
sys.path.append('/var/www/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.tables.models import RestaurantTable, TableStatus
from apps.billing.models import Order, Bill
table_numbers = ['10', '12', '18']
tables = RestaurantTable.objects.filter(number__in=table_numbers)
for t in tables:
    orders = Order.objects.filter(table=t)
    for order in orders:
        Bill.objects.filter(order=order).delete()
        order.delete()
    t.status = TableStatus.AVAILABLE
    t.save()
    print(f"Cleared table {t.number}")
print("Done.")
"""
    
    # Write the script to a file on the VPS
    sftp = client.open_sftp()
    with sftp.file('/var/www/rebill/backend/clear_test_tables.py', 'w') as f:
        f.write(script)
    sftp.close()
    
    # Execute the script
    cmd = "cd /var/www/rebill/backend && source venv/bin/activate && python clear_test_tables.py"
    stdin, stdout, stderr = client.exec_command(cmd)
    
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    
    if out: print("OUTPUT:\n", out)
    if err: print("ERROR:\n", err)
    print(f"Exit status: {exit_status}")
        
finally:
    client.close()
    print("Connection closed.")
