import requests

login_res = requests.post('http://200.141.11.187/api/auth/login/', json={'username': 'owner', 'password': 'owner123'})
token = login_res.json()['access']
headers = {'Authorization': f'Bearer {token}'}

# Fetch existing tables
existing_tables = requests.get('http://200.141.11.187/api/tables/', headers=headers).json()
print("Existing tables count:", len(existing_tables))
existing_numbers = {t['number']: t for t in existing_tables}

# Grid layout parameters (5 tables per row)
# Row 0: Table 1 to 5 (pos_y=0, pos_x=0..4)
# Row 1: Table 6 to 10 (pos_y=1, pos_x=0..4)
# Row 2: Table 11 to 15 (pos_y=2, pos_x=0..4)
# Row 3: Table 16 to 20 (pos_y=3, pos_x=0..4)

created_count = 0
updated_count = 0

for i in range(1, 21):
    num_str = str(i)
    row = (i - 1) // 5
    col = (i - 1) % 5

    # Seating logic
    if i in (1, 2, 3, 4):
        seats = 2
        shape = 'SQUARE'
        label = 'Couples Section'
    elif i in (17, 18, 19, 20):
        seats = 6
        shape = 'RECT'
        label = 'Family Section'
    else:
        seats = 4
        shape = 'SQUARE'
        label = 'Main Dining'

    payload = {
        'number': num_str,
        'label': label,
        'seats': seats,
        'shape': shape,
        'pos_x': col,
        'pos_y': row,
        'is_active': True,
    }

    if num_str in existing_numbers:
        table_id = existing_numbers[num_str]['id']
        requests.patch(f'http://200.141.11.187/api/tables/{table_id}/', headers=headers, json=payload)
        updated_count += 1
    else:
        requests.post('http://200.141.11.187/api/tables/', headers=headers, json=payload)
        created_count += 1

# Verify final table list
all_tables = requests.get('http://200.141.11.187/api/tables/', headers=headers).json()
print(f"Created: {created_count}, Updated: {updated_count}")
print(f"Total tables in DB now: {len(all_tables)}")
print("Table numbers in DB:", [t['number'] for t in sorted(all_tables, key=lambda x: int(x['number']) if x['number'].isdigit() else 99)])
