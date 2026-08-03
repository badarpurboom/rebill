import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Directly test the pay flow as it happens in views.py
from apps.billing.models import Bill, BillStatus
from apps.customers.models import Customer
from apps.whatsapp.models import TriggerType, WhatsAppMessage, WhatsAppConfig
from apps.whatsapp.services import send_if_enabled

# Find the latest bill
bill = Bill.objects.order_by('-created_at').first()
print(f'Latest bill: {bill.bill_number}, status={bill.status}, customer={bill.customer}')

config = WhatsAppConfig.load()
print(f'is_live={config.is_live}, is_configured={config.is_configured}')
print(f'send_bill_receipt={config.send_bill_receipt}')

# Try simulating what views.pay does
customer = Customer.objects.filter(phone='8219262176').first()
print(f'Customer: {customer}, phone: {customer.phone}')

msg = send_if_enabled(
    TriggerType.BILL_RECEIPT,
    customer=customer,
    bill=bill,
    context={
        'bill_number': 'LIVE-001',
        'bill_amount': '500',
        'earned_points': 25,
        'available_points': customer.points_balance,
    }
)

if msg:
    print(f'Message ID={msg.id}, status={msg.status}, is_mock={msg.is_mock}')
    if msg.error:
        print(f'Error: {msg.error}')
else:
    print('send_if_enabled returned None (trigger disabled or no phone?)')
