import os
import sys
import django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from apps.customers.models import Customer
from apps.menu.models import MenuItemVariant
from apps.billing.models import Order
from apps.whatsapp.models import WhatsAppMessage
import json

User = get_user_model()
user = User.objects.first()

client = Client()
client.force_login(user)

phone = '8219262176'

print('1. Lookup customer...')
resp = client.get(f'/api/customers/lookup/?phone={phone}')
data = resp.json()
customer = data.get('exact')

if not customer:
    print('Customer not found, creating...')
    resp = client.post(f'/api/customers/', {'name': 'Test User', 'phone': phone}, content_type='application/json')
    customer = resp.json()
    print('Created customer:', customer)

customer_id = customer['id']
print(f'Customer ID: {customer_id}')

print('\n2. Find an open order...')
resp = client.get('/api/billing/orders/?open=true')
orders = resp.json()
if orders:
    order_id = orders[0]['id']
    print('Using existing open order:', order_id)
else:
    print('Creating Takeaway Order...')
    resp = client.post('/api/billing/orders/open-order/', {'table': 1}, content_type='application/json')
    order_id = resp.json()['id']
    print('Created order:', order_id)

print('\n3. Add item...')
variant = MenuItemVariant.objects.first()
resp = client.post(f'/api/billing/orders/{order_id}/items/', {'variant': variant.id, 'quantity': 1}, content_type='application/json')
print('Add item response:', resp.status_code)

print('\n4. Generate bill...')
resp = client.post(f'/api/billing/orders/{order_id}/generate-bill/', {'discount_percent': 0, 'customer': customer_id}, content_type='application/json')
print('Generate bill response:', resp.status_code, resp.content.decode('utf-8')[:200])
if resp.status_code != 201:
    sys.exit(1)
bill_id = resp.json()['id']

print('\n5. Pay bill...')
resp = client.post(f'/api/billing/bills/{bill_id}/pay/', {'payment_mode': 'CASH'}, content_type='application/json')
print('Pay bill response:', resp.status_code)

print('\n6. Checking WhatsAppMessage log...')
msg = WhatsAppMessage.objects.order_by('-created_at').first()
if msg:
    print(f'Last message to {msg.phone}: Status={msg.status}, Mock={msg.is_mock}')
    if msg.error:
        print(f'Error: {msg.error}')
    print(f'Body: {msg.body}')
else:
    print('No message found in DB!')
