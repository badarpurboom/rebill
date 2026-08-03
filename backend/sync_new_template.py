import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import MessageTemplate, TriggerBinding, TriggerType, WhatsAppConfig
from apps.whatsapp.services import sync_templates

print('1. Syncing templates from Meta...')
res = sync_templates()
print('Sync result:', res)

templates = MessageTemplate.objects.all()
for t in templates:
    print(f'Template: name={t.name}, lang={t.language}, status={t.status}, category={t.category}')

# Bind bill_receipt to BILL_RECEIPT trigger
template = MessageTemplate.objects.filter(name='bill_receipt').first()
if template:
    print(f'Found approved template: {template.name} ({template.language})')
    binding, created = TriggerBinding.objects.get_or_create(trigger=TriggerType.BILL_RECEIPT)
    binding.template = template
    binding.save()
    print(f'Bound {template.name} to TriggerType.BILL_RECEIPT successfully!')
else:
    print('Template bill_receipt not found in synced templates!')

