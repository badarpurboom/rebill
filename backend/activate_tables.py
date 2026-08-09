import os
import django
import sys

sys.path.append(r"c:\Users\lenovo\Desktop\rebill\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tables.models import RestaurantTable

tables = RestaurantTable.objects.filter(is_active=False)
for t in tables:
    t.is_active = True
    t.save()
    print(f"Activated Table {t.number}")
