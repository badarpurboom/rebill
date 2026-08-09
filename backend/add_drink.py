import os
import django
import sys

sys.path.append(r"c:\Users\lenovo\Desktop\rebill\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.menu.models import Category, MenuItem, MenuItemVariant, Portion

category_name = "DRINK"
cat, _ = Category.objects.get_or_create(name=category_name)

item_name = "Water Bottle"
full_price = 20

# Create or update menu item
menu_item, created = MenuItem.objects.update_or_create(
    category=cat,
    name=item_name,
    defaults={'food_type': 'VEG'}
)

# Add FULL variant
MenuItemVariant.objects.update_or_create(
    item=menu_item,
    portion=Portion.FULL,
    defaults={'price': full_price}
)

print(f"Created category '{category_name}' and added '{item_name}' for {full_price} rupees!")
