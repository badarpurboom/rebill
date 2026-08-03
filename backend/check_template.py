import os
import sys
import django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import MessageTemplate, TriggerBinding, TriggerType

template = MessageTemplate.objects.filter(name='bill_loyalty_update').first()
print(f'Template: {template.name}, Status: {template.status}, is_usable: {template.is_usable}')

binding = TriggerBinding.objects.filter(trigger=TriggerType.BILL_RECEIPT).first()
if binding:
    print(f'Binding: trigger={binding.trigger}, template={binding.template.name}')
else:
    print('No binding found for BILL_RECEIPT')
