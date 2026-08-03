import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Simulate exact POS flow:
# 1. Customer attach to order (setCustomer)
# 2. generateBill without customer in payload
# 3. pay

from django.test import RequestFactory
from apps.billing.models import Bill, Order
from apps.customers.models import Customer
from apps.whatsapp.models import WhatsAppMessage

# Check latest bill - was customer on the order?
latest_bill = Bill.objects.order_by('-created_at').first()
print(f'Latest bill: {latest_bill.bill_number}')
print(f'Bill customer: {latest_bill.customer}')
print(f'Order customer: {latest_bill.order.customer}')
print()

# Check all bills without customer
bills_no_customer = Bill.objects.filter(customer__isnull=True).order_by('-created_at')[:3]
print(f'Recent bills WITHOUT customer:')
for b in bills_no_customer:
    print(f'  Bill {b.bill_number}: order_customer={b.order.customer}')
