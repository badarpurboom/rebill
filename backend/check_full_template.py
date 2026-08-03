import os, sys, django
sys.path.append('c:/Users/lenovo/Desktop/rebill/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.whatsapp.models import MessageTemplate, WhatsAppConfig
import requests

config = WhatsAppConfig.load()

# Fetch full template details from Meta
resp = requests.get(
    f'https://graph.facebook.com/v22.0/{config.waba_id}/message_templates',
    headers={'Authorization': f'Bearer {config.access_token}'},
    params={'name': 'bill_loyalty_update', 'limit': 5},
    timeout=10
)
data = resp.json()
for t in data.get('data', []):
    print(f'Name: {t["name"]}')
    print(f'Category: {t["category"]}')
    print(f'Status: {t["status"]}')
    print(f'Language: {t.get("language", "")}')
    print('Components:')
    for c in t.get('components', []):
        print(f'  Type: {c["type"]}')
        if 'text' in c:
            print(f'  Text: {c["text"]}')
        if 'example' in c:
            print(f'  Example: {c["example"]}')
