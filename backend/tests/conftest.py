"""
pytest 공통:
- 통합 테스트가 개발용 todo.db 를 건드리지 않도록 임시 SQLite 파일을 DATABASE_URL 로 지정
- Settings 필수 항목 기본값(CI·.env 누락 시)
- app 패키지 import 경로
- 내부 직원(관리자·일반) 통합 계정 픽스처
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi import status
from fastapi.testclient import TestClient

# db.session / core.config 이 처음 로드되기 전에 반드시 설정
_fd, _TEST_DB_PATH = tempfile.mkstemp(suffix=".sqlite")
os.close(_fd)
os.environ["DATABASE_URL"] = "sqlite:///" + Path(_TEST_DB_PATH).resolve().as_posix()

_env = os.environ
_env.setdefault("SECRET_KEY", "pytest-secret-key-must-be-long-enough-for-jwt-hs256!")
_env.setdefault("KAKAO_CLIENT_ID", "pytest")
_env.setdefault("KAKAO_CLIENT_SECRET", "pytest")
_env.setdefault("NAVER_CLIENT_ID", "pytest")
_env.setdefault("NAVER_CLIENT_SECRET", "pytest")
_env.setdefault("PUBLIC_DATA_API_KEY", "pytest")
_env.setdefault("ENVIRONMENT", "development")

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_APP_DIR = os.path.join(_BACKEND_DIR, "app")
if _APP_DIR not in sys.path:
	sys.path.insert(0, _APP_DIR)

_TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
if _TESTS_DIR not in sys.path:
	sys.path.insert(0, _TESTS_DIR)

from integration_constants import (
	INTEGRATION_ADMIN_LOGIN_ID,
	INTEGRATION_EMPLOYEE_LOGIN_ID,
	INTEGRATION_LOGIN_PASSWORD,
)


def pytest_sessionfinish(session, exitstatus):
	try:
		Path(_TEST_DB_PATH).unlink(missing_ok=True)
	except OSError:
		pass


def _signup_or_exists(client: TestClient, payload: dict) -> None:
	r = client.post("/api/auth/signup", json=payload)
	if r.status_code == status.HTTP_200_OK:
		return
	detail = ""
	try:
		detail = str(r.json().get("detail") or "")
	except Exception:
		detail = r.text
	if r.status_code == status.HTTP_400_BAD_REQUEST and "이미 사용" in detail:
		return
	pytest.fail(f"signup failed: {r.status_code} {r.text}")


@pytest.fixture(scope="session")
def ensure_integration_users():
	import main as app_main

	with TestClient(app_main.app) as client:
		base = {
			"user_password": INTEGRATION_LOGIN_PASSWORD,
			"user_name": "통합테스트",
			"user_nickname": "통합",
			"joined_at": "2020-01-01",
		}
		_signup_or_exists(
			client,
			{**base, "user_login_id": INTEGRATION_ADMIN_LOGIN_ID, "role": "admin"},
		)
		_signup_or_exists(
			client,
			{**base, "user_login_id": INTEGRATION_EMPLOYEE_LOGIN_ID, "role": "user"},
		)
	yield


@pytest.fixture(scope="session")
def integration_admin_client(ensure_integration_users):
	import main as app_main

	with TestClient(app_main.app) as c:
		r = c.post(
			"/api/auth/login",
			json={"id": INTEGRATION_ADMIN_LOGIN_ID, "pw": INTEGRATION_LOGIN_PASSWORD},
		)
		assert r.status_code == status.HTTP_200_OK, r.text
		yield c


@pytest.fixture(scope="session")
def integration_employee_client(ensure_integration_users):
	import main as app_main

	with TestClient(app_main.app) as c:
		r = c.post(
			"/api/auth/login",
			json={"id": INTEGRATION_EMPLOYEE_LOGIN_ID, "pw": INTEGRATION_LOGIN_PASSWORD},
		)
		assert r.status_code == status.HTTP_200_OK, r.text
		yield c
