import os
import sys
import django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import MessageTemplate, TriggerBinding, TriggerType, WhatsAppConfig
from apps.whatsapp.services import sync_templates

try:
    print('Syncing templates from Meta...')
    res = sync_templates()
    print(f'Sync result: {res}')
except Exception as e:
    print(f'Sync failed: {e}')

template = MessageTemplate.objects.filter(name='bill_loyalty_update').first()
if template:
    print(f'Found template: {template.name}')
    binding, created = TriggerBinding.objects.get_or_create(trigger=TriggerType.BILL_RECEIPT)
    binding.template = template
    binding.save()
    print('Successfully bound template to BILL_RECEIPT trigger!')
    
    config = WhatsAppConfig.load()
    config.is_live = True
    config.send_bill_receipt = True
    config.save()
    print('Turned on is_live and send_bill_receipt in WhatsAppConfig.')
else:
    print('Template bill_loyalty_update not found after sync!')
