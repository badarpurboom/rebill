import os
import django
import sys

sys.path.append(r"c:\Users\lenovo\Desktop\rebill\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tables.models import RestaurantTable, TableStatus

tables = RestaurantTable.objects.filter(number__in=['1', '2'])
for t in tables:
    t.status = TableStatus.AVAILABLE
    t.save()
    print(f"Cleared status for Table {t.number}")
