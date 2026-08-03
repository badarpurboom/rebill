import sys
import requests

sys.stdout.reconfigure(encoding='utf-8')

login_res = requests.post('http://200.141.11.187/api/auth/login/', json={'username': 'owner', 'password': 'owner123'})
token = login_res.json()['access']
headers = {'Authorization': f'Bearer {token}'}

print("=== MESSAGES ===")
msgs = requests.get('http://200.141.11.187/api/whatsapp/messages/', headers=headers).json()
print("Messages API output:", str(msgs)[:500])

print("\n=== TEMPLATES ===")
templates = requests.get('http://200.141.11.187/api/whatsapp/templates/', headers=headers).json()
print("Templates API output:", str(templates)[:500])

print("\n=== TRIGGERS / BINDINGS ===")
triggers = requests.get('http://200.141.11.187/api/whatsapp/triggers/', headers=headers).json()
print("Triggers API output:", str(triggers)[:1000])
