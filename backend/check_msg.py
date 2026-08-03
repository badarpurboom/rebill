import os
import sys
import django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import WhatsAppMessage
for msg in WhatsAppMessage.objects.order_by('-created_at')[:5]:
    print(f'Phone: {msg.phone}, Status: {msg.status}, Is Mock: {msg.is_mock}')
    if msg.error:
        print(f'Error: {msg.error}')
    print('-'*40)
