import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import WhatsAppConfig, TriggerType
from apps.customers.models import Customer
from django.conf import settings as django_settings

config = WhatsAppConfig.load()
customer = Customer.objects.filter(phone='8219262176').first()

print(f'config.is_live = {config.is_live}')
print(f'config.is_configured = {config.is_configured}')
print(f'WHATSAPP_MOCK_MODE = {django_settings.WHATSAPP_MOCK_MODE}')
print(f'use_live would be = {config.is_live and config.is_configured and not django_settings.WHATSAPP_MOCK_MODE}')
print()
print(f'customer = {customer}')
print(f'customer.is_active = {customer.is_active}')
print(f'config.trigger_enabled(BILL_RECEIPT) = {config.trigger_enabled(TriggerType.BILL_RECEIPT)}')

# Now test real send directly
import requests
from apps.whatsapp.services import to_e164, TRIGGER_MESSAGES

phone = '8219262176'
context = {
    'customer_name': 'Test',
    'restaurant_name': 'Test Restaurant',
    'bill_number': 'T-999',
    'bill_amount': '500',
    'earned_points': 50,
    'available_points': 150,
}
trigger = TriggerType.BILL_RECEIPT

variables = TRIGGER_MESSAGES.get(trigger, {}).get('variables', [])
params = [{'type': 'text', 'parameter_name': name, 'text': str(context.get(name, ''))} for name in variables]
print(f'\nParams to send: {params}')

api_url = f'https://graph.facebook.com/v22.0/{config.phone_number_id}/messages'
body = {
    'messaging_product': 'whatsapp',
    'to': to_e164(phone),
    'type': 'template',
    'template': {
        'name': 'bill_loyalty_update',
        'language': {'code': 'hi'},
        'components': [{'type': 'body', 'parameters': params}]
    }
}
print(f'\nSending to: {api_url}')
resp = requests.post(api_url, headers={'Authorization': f'Bearer {config.access_token}', 'Content-Type': 'application/json'}, json=body, timeout=10)
print(f'Response: {resp.status_code} - {resp.text}')
