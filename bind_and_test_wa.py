import requests

login_res = requests.post('http://200.141.11.187/api/auth/login/', json={'username': 'owner', 'password': 'owner123'})
token = login_res.json()['access']
headers = {'Authorization': f'Bearer {token}'}

print("=== 1. SYNC TEMPLATES FROM META ===")
sync_res = requests.post('http://200.141.11.187/api/whatsapp/templates/sync/', headers=headers)
print("Sync Response:", sync_res.status_code, sync_res.json())

print("\n=== 2. FETCH APPROVED TEMPLATES ===")
templates = requests.get('http://200.141.11.187/api/whatsapp/templates/', headers=headers).json()
for t in templates:
    print(f"ID: {t['id']} | Name: {t['name']} | Status: {t['status']} | Variables: {t['variable_count']}")

print("\n=== 3. BIND BILL_RECEIPT TRIGGER TO TEMPLATE ===")
# Find bill_receipt template ID
bill_tmpl = next((t for t in templates if 'bill' in t['name'].lower() or 'receipt' in t['name'].lower()), None)
if bill_tmpl:
    bind_res = requests.post(
        'http://200.141.11.187/api/whatsapp/triggers/bind/',
        headers=headers,
        json={'trigger': 'BILL_RECEIPT', 'template_id': bill_tmpl['id']}
    )
    print("Binding Result:", bind_res.status_code, bind_res.json())
else:
    print("No bill receipt template found to bind!")
