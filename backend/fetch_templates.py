import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import WhatsAppConfig
import requests, json

config = WhatsAppConfig.load()

resp = requests.get(
    f'https://graph.facebook.com/v22.0/{config.waba_id}/message_templates',
    headers={'Authorization': f'Bearer {config.access_token}'},
    params={'limit': 10},
    timeout=10
)
data = resp.json()
print(json.dumps(data, indent=2, ensure_ascii=False))
