#!/bin/sh
set -eu

# Run from any directory after the stack has started. No credentials are needed.
python3 - <<'PY'
import json
from urllib.request import urlopen

def get(url):
    with urlopen(url, timeout=8) as response:
        assert response.status == 200, url
        return response.read().decode()

assert 'QTrace' in get('http://127.0.0.1:5173/')
for base in ('http://127.0.0.1:8000', 'http://127.0.0.1:5173/api'):
    assert json.loads(get(base + '/health/live')) == {'status': 'ok', 'service': 'qtrace-api'}
    assert json.loads(get(base + '/health/ready')) == {'status': 'ready', 'database': 'reachable'}
print('PASS: frontend served; direct and frontend-proxied API liveness and PostgreSQL readiness.')
PY
