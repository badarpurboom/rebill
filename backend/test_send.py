import os
import sys
import django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import TriggerType, WhatsAppConfig, WhatsAppMessage
from apps.whatsapp.services import send_if_enabled, bound_template

t = bound_template(TriggerType.BILL_RECEIPT)
print(f'bound_template returned: {t}')

print('Calling send_if_enabled...')
msg = send_if_enabled(
    TriggerType.BILL_RECEIPT,
    phone='8219262176',
    context={
        'bill_number': 'TEST-123',
        'bill_amount': '500',
        'earned_points': 50,
        'available_points': 150,
    }
)
if msg:
    print(f'Message status: {msg.status}')
    if msg.error:
        print(f'Error: {msg.error}')
else:
    print('send_if_enabled returned None')

