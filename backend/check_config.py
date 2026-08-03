import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import WhatsAppConfig
from django.conf import settings as django_settings

config = WhatsAppConfig.load()
print(f'is_live={config.is_live}')
print(f'is_configured={config.is_configured}')
print(f'phone_number_id={config.phone_number_id}')
print(f'access_token set={bool(config.access_token)}')
print(f'WHATSAPP_MOCK_MODE setting={getattr(django_settings, "WHATSAPP_MOCK_MODE", "NOT SET")}')
