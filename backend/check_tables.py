import os
import django
import sys

sys.path.append(r"c:\Users\lenovo\Desktop\rebill\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.tables.models import RestaurantTable

tables = RestaurantTable.objects.all().order_by('number')
for t in tables:
    print(f"Table {t.number}: active={t.is_active}, pos_x={t.pos_x}, pos_y={t.pos_y}, status={t.status}")
