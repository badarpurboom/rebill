import requests

login_res = requests.post('http://200.141.11.187/api/auth/login/', json={'username': 'owner', 'password': 'owner123'})
token = login_res.json()['access']
headers = {'Authorization': f'Bearer {token}'}

items_res = requests.get('http://200.141.11.187/api/menu/items/', headers=headers)
items = items_res.json()

target_names = [
    'Chicken Seekh Kabab',
    'Butter Chicken Special',
    'Paneer Tikka Special',
    'Dal Makhani Special',
    'Special Gulab Jamun',
    'Kulhad Masala Chai'
]

deleted_names = []
for item in items:
    if item['name'] in target_names or 'Chicken' in item['name']:
        del_res = requests.delete(f"http://200.141.11.187/api/menu/items/{item['id']}/", headers=headers)
        if del_res.status_code in (200, 204):
            deleted_names.append(item['name'])

print("Successfully deleted items:", deleted_names)
