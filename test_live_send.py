import requests

login_res = requests.post('http://200.141.11.187/api/auth/login/', json={'username': 'owner', 'password': 'owner123'})
token = login_res.json()['access']
headers = {'Authorization': f'Bearer {token}'}

# Test phone number
phone = "8219262176" # test number from DB customer 'rohit'

# Create a test customer if needed, or send directly
payload = {
    "phone": phone,
    "trigger": "BILL_RECEIPT",
    "context": {
        "customer_name": "Rohit",
        "restaurant_name": "Radhe Sweets",
        "bill_number": "BILL-101",
        "bill_amount": "450",
        "earned_points": "45",
        "available_points": "100"
    }
}

res = requests.post('http://200.141.11.187/api/whatsapp/messages/send_test/', headers=headers, json=payload)
print("TEST SEND STATUS:", res.status_code)
print("TEST SEND RESULT:", res.json())
