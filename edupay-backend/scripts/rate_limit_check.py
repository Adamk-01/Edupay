import json
import urllib.request
import urllib.error

base_url = 'http://127.0.0.1:8000/api/v1/auth/register'
statuses = {}

for i in range(25):
    payload = {
        'email': f'limit{i}@example.com',
        'password': 'TestPass123!',
        'full_name': f'Limiter Test {i}',
        'phone': f'080{str(i).zfill(8)}',
    }
    req = urllib.request.Request(
        base_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
    except urllib.error.HTTPError as exc:
        status = exc.code
    statuses[status] = statuses.get(status, 0) + 1
    if status == 429:
        print(f'429_SEEN_AT={i}')
        break

print(json.dumps(statuses, sort_keys=True))
