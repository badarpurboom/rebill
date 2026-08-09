import os
import django
import sys

sys.path.append(r"c:\Users\lenovo\Desktop\rebill\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tables.models import RestaurantTable, TableStatus
from apps.billing.models import Order, Bill

table_numbers = ['10', '12', '18']

# Get the tables
tables = RestaurantTable.objects.filter(number__in=table_numbers)

for t in tables:
    # Find active/recent orders on this table to clear
    orders = Order.objects.filter(table=t)
    for order in orders:
        # Delete bills if any to satisfy PROTECT constraint
        Bill.objects.filter(order=order).delete()
        # Delete the order (this cascades to OrderItem and KOT)
        order.delete()
        
    t.status = TableStatus.AVAILABLE
    t.save()
    print(f"Cleared table {t.number}")
    
print("Done.")
