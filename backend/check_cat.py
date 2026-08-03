import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import MessageTemplate
t = MessageTemplate.objects.filter(name='bill_loyalty_update').first()
print(f'Name: {t.name}')
print(f'Status: {t.status}')
print(f'Language: {t.language}')
print(f'Category: {t.category}')
