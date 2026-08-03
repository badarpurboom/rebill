"""Seed the three demo staff logins and a starter menu.

    python manage.py seed_demo

Safe to re-run: users and items are matched by natural key and updated in
place, never duplicated. Passwords are only set when the user is first made,
so a changed password is not silently reset.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.auth_app.models import Role
from apps.menu.models import Category, FoodType, MenuItem, MenuItemVariant, Portion

User = get_user_model()

DEMO_USERS = [
    ('owner', 'owner123', 'Rajesh', 'Sharma', Role.OWNER),
    ('cashier', 'cashier123', 'Priya', 'Verma', Role.CASHIER),
    ('waiter', 'waiter123', 'Amit', 'Kumar', Role.WAITER),
]

# (category, name, food_type, half_price, full_price, description)
SAMPLE_MENU = [
    ('Starters', 'Paneer Tikka', FoodType.VEG, 150, 260, 'Tandoor me pakaya hua paneer'),
    ('Starters', 'Veg Spring Roll', FoodType.VEG, 110, 190, ''),
    ('Starters', 'Hara Bhara Kabab', FoodType.VEG, None, 210, ''),
    ('Starters', 'Chicken Tikka', FoodType.NON_VEG, 180, 320, 'Boneless, malai marinade'),
    ('Starters', 'Fish Amritsari', FoodType.NON_VEG, None, 340, ''),
    ('Starters', 'Chilli Chicken', FoodType.NON_VEG, 170, 300, ''),

    ('Main Course', 'Dal Makhani', FoodType.VEG, 140, 240, 'Raat bhar dheemi aanch par'),
    ('Main Course', 'Shahi Paneer', FoodType.VEG, 170, 290, ''),
    ('Main Course', 'Kadhai Paneer', FoodType.VEG, 170, 290, ''),
    ('Main Course', 'Veg Biryani', FoodType.VEG, 150, 260, ''),
    ('Main Course', 'Butter Chicken', FoodType.NON_VEG, 220, 380, 'Ghar ki sabse popular dish'),
    ('Main Course', 'Chicken Biryani', FoodType.NON_VEG, 190, 330, ''),
    ('Main Course', 'Mutton Rogan Josh', FoodType.NON_VEG, None, 420, ''),
    ('Main Course', 'Tawa Roti', FoodType.VEG, None, 15, ''),
    ('Main Course', 'Butter Naan', FoodType.VEG, None, 45, ''),
    ('Main Course', 'Jeera Rice', FoodType.VEG, 90, 160, ''),

    ('Desserts', 'Gulab Jamun', FoodType.VEG, None, 90, '2 pieces'),
    ('Desserts', 'Rasmalai', FoodType.VEG, None, 110, '2 pieces'),
    ('Desserts', 'Gajar Ka Halwa', FoodType.VEG, 80, 140, 'Seasonal'),
    ('Desserts', 'Vanilla Ice Cream', FoodType.VEG, None, 70, ''),

    ('Drinks', 'Masala Chai', FoodType.VEG, None, 40, ''),
    ('Drinks', 'Filter Coffee', FoodType.VEG, None, 60, ''),
    ('Drinks', 'Sweet Lassi', FoodType.VEG, 60, 100, ''),
    ('Drinks', 'Fresh Lime Soda', FoodType.VEG, None, 80, ''),
    ('Drinks', 'Cold Drink (300ml)', FoodType.VEG, None, 50, ''),
]

CATEGORY_ORDER = ['Starters', 'Main Course', 'Desserts', 'Drinks']


class Command(BaseCommand):
    help = 'Seed demo users (owner/cashier/waiter) and a sample menu.'

    @transaction.atomic
    def handle(self, *args, **options):
        for username, password, first, last, role in DEMO_USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': first,
                    'last_name': last,
                    'role': role,
                    'is_staff': role == Role.OWNER,
                    'is_superuser': role == Role.OWNER,
                },
            )
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f'  + user {username} / {password}  [{role}]'))
            else:
                self.stdout.write(f'  = user {username} already exists (password unchanged)')

        categories = {}
        for order, name in enumerate(CATEGORY_ORDER):
            categories[name], _ = Category.objects.get_or_create(
                name=name, defaults={'sort_order': order}
            )

        created_items = 0
        for order, (cat, name, food_type, half, full, desc) in enumerate(SAMPLE_MENU):
            item, was_created = MenuItem.objects.get_or_create(
                category=categories[cat],
                name=name,
                defaults={'food_type': food_type, 'description': desc, 'sort_order': order},
            )
            created_items += was_created
            MenuItemVariant.objects.get_or_create(
                item=item, portion=Portion.FULL, defaults={'price': Decimal(full)}
            )
            if half is not None:
                MenuItemVariant.objects.get_or_create(
                    item=item, portion=Portion.HALF, defaults={'price': Decimal(half)}
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. {len(categories)} categories, {created_items} new menu items '
                f'({MenuItem.objects.count()} total).'
            )
        )
