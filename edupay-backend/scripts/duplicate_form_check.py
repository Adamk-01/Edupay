import json
import urllib.request
import urllib.error

base = 'http://127.0.0.1:8000/api/v1'
login_payload = json.dumps({
    'email': 'buyer@example.com',
    'password': 'TestPass123!'
}).encode()
login_req = urllib.request.Request(base + '/auth/login', data=login_payload, headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(login_req, timeout=10) as resp:
    token = json.load(resp)['access_token']

for i in range(2):
    body = json.dumps({
        'form_id': '0832c0e7-2aa3-4f84-8c91-e65b2a05b6fa',
        'phone': '08011112222',
        'email': 'buyer@example.com',
        'whatsapp_number': '08011112222',
        'full_name': 'Test Buyer',
        'state_of_origin': 'Lagos'
    }).encode()
    req = urllib.request.Request(
        base + '/forms/buy',
        data=body,
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f'BUY {i+1}: STATUS={resp.status} BODY={resp.read().decode()}')
    except urllib.error.HTTPError as e:
        print(f'BUY {i+1}: STATUS={e.code} BODY={e.read().decode()}')
