import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'rebill.settings')
django.setup()

from apps.settings_app.models import RestaurantSettings

settings = RestaurantSettings.load()
settings.loyalty_enabled = True
settings.loyalty_earn_amount = 100
settings.loyalty_earn_points = 5
settings.loyalty_redeem_value = 1
settings.loyalty_min_redeem_points = 20
settings.loyalty_max_redeem_percent = 50
settings.save()

print('Settings updated successfully on production!')
