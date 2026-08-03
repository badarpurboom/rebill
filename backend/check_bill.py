import os
import sys
import django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.billing.models import Bill
from apps.whatsapp.models import WhatsAppConfig

bill = Bill.objects.get(pk=44)
print(f'Bill 44 Customer: {bill.customer}')
if bill.customer:
    print(f'Customer phone: {bill.customer.phone}, active: {bill.customer.is_active}')
else:
    print('No customer attached to bill 44!')

config = WhatsAppConfig.load()
print(f'WhatsAppConfig -> is_live: {config.is_live}, send_bill_receipt: {config.send_bill_receipt}')
