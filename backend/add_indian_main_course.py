import os
import django
import sys

sys.path.append(r"c:\Users\lenovo\Desktop\rebill\backend")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.menu.models import Category, MenuItem, MenuItemVariant, Portion

category_name = "INDIAN MAIN COURSE"
cat, _ = Category.objects.get_or_create(name=category_name)

items = [
    # Left column
    ("Kadhai Paneer", 245, 345),
    ("Handi Paneer", 245, 360),
    ("Shahi Paneer (White Spl./ Normal)", 245, 345),
    ("Spl Paneer Tikka Masala 6 Pcs", None, 329),
    ("Paneer 2 Pyaza", 245, 345),
    ("Paneer Lababdar 5 Half / 10 Full", 250, 410),
    ("Aloo Gobhi Matar Seasonal", 155, 250),
    ("Paneer Patiala / 8 Pcs", None, 519),
    ("Paneer Toofani / 8 Pcs", None, 449),
    ("Paneer Punjabi Tadka / 8 Pcs", None, 449),
    ("Paneer Jaipuri / 8 Pcs/", None, 349),
    ("Paneer Kolhapuri / 8 Pcs", None, 509),
    ("Paneer Butter Masala 4 Pcs / 8 Pcs", 250, 360),
    ("Matar Paneer Masala 4Pcs / 8 Pcs", None, 319),
    ("Palak Paneer / 8 Pcs", None, 349),
    ("Paneer Dhaniya Adaraki", None, 399),
    ("Paneer Kaju Masala", None, 399),
    ("Mix Veg", 189, 299),
    ("Veg Hyderabadi", None, 240),
    ("Veg Kolhapuri", None, 320),
    ("Mushroom 2 Pyaza", 225, 330),
    ("Mushroom Kadhai", 229, 315),
    ("Mushroom Masala", 250, 370),
    ("Kaju Curry", None, 350),
    ("Kaju Masala", None, 350),
    ("Malai Kofta 4 Pcs", None, 380),
    ("Radhe Radhe Special Mix Veg", None, 320),

    # Right column
    ("Kadhai Chaap", 250, 370),
    ("Jeera Aloo", None, 195),
    ("Soya Chaap Masala", 250, 370),
    ("Dum Aloo Banarasi", None, 299),
    ("Dum Aloo Kashmiri", None, 295),
    ("Paneer Bhujia", 250, 360),
]

for item_name, half_price, full_price in items:
    # Trim trailing slashes/dots if any (already done in string but to be safe)
    clean_name = item_name.strip()
    
    # Create or update menu item
    menu_item, created = MenuItem.objects.update_or_create(
        category=cat,
        name=clean_name,
        defaults={'food_type': 'VEG'}
    )
    
    # Add FULL variant
    if full_price is not None:
        MenuItemVariant.objects.update_or_create(
            item=menu_item,
            portion=Portion.FULL,
            defaults={'price': full_price}
        )
        
    # Add HALF variant
    if half_price is not None:
        MenuItemVariant.objects.update_or_create(
            item=menu_item,
            portion=Portion.HALF,
            defaults={'price': half_price}
        )

print("Menu items inserted successfully!")
