"""
/auth/login SlowAPI 제한(5/min) 검증. 다른 테스트와 카운터가 섞이지 않도록 스토리지를 비웁니다.
"""
from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from core.limiter import limiter


def test_login_burst_triggers_rate_limit_429():
	limiter._storage.reset()
	client = TestClient(app_main.app)
	payload = {"id": "__rate_limit_probe__", "pw": "wrong-password"}
	last = None
	for i in range(6):
		last = client.post("/api/auth/login", json=payload)
	assert last is not None
	assert last.status_code == status.HTTP_429_TOO_MANY_REQUESTS
