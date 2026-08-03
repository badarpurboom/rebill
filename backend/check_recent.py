import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import WhatsAppMessage
msgs = WhatsAppMessage.objects.order_by('-created_at')[:3]
for m in msgs:
    print(f'ID={m.id} | Phone={m.phone} | Status={m.status} | Mock={m.is_mock} | Trigger={m.trigger}')
    if m.error:
        print(f'  Error: {m.error}')
    print()
