"""가입 승인(pending/approved/rejected) 플로우 테스트."""

from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from db.session import SessionLocal
from models.auth_models import User
from conftest import TENANT_HEADERS


def _login(client: TestClient, login_id: str, password: str):
	return client.post(
		"/api/auth/login",
		json={"id": login_id, "pw": password},
		headers=TENANT_HEADERS,
	)


def test_public_signup_is_pending_and_login_blocked():
	with TestClient(app_main.app, headers=TENANT_HEADERS) as client:
		payload = {
			"user_login_id": "pending_signup_user_01",
			"user_password": "test-pass-1234",
			"user_name": "승인대기유저",
			"user_phone_number": "01077778888",
			"birth_date": "1993-03-03",
		}
		signup = client.post("/api/auth/signup", json=payload, headers=TENANT_HEADERS)
		assert signup.status_code == status.HTTP_200_OK, signup.text
		assert "승인" in str(signup.json().get("message") or "")

		db = SessionLocal()
		try:
			user = db.query(User).filter(User.user_login_id == payload["user_login_id"]).first()
			assert user is not None
			assert user.approval_status == "pending"
		finally:
			db.close()

		login = _login(client, payload["user_login_id"], payload["user_password"])
		assert login.status_code == status.HTTP_403_FORBIDDEN, login.text
		assert "승인 대기" in str(login.json().get("detail") or "")


def test_admin_approve_then_login_ok(integration_admin_client):
	admin = integration_admin_client
	payload = {
		"user_login_id": "pending_then_approved_02",
		"user_password": "test-pass-1234",
		"user_name": "승인후로그인",
		"user_phone_number": "01066665555",
		"birth_date": "1994-04-04",
	}
	signup = admin.post("/api/auth/signup", json=payload, headers=TENANT_HEADERS)
	assert signup.status_code == status.HTTP_200_OK, signup.text

	db = SessionLocal()
	try:
		user = db.query(User).filter(User.user_login_id == payload["user_login_id"]).first()
		assert user is not None
		user_id = user.id
	finally:
		db.close()

	approve = admin.patch(
		f"/api/admin/users/{user_id}/approval",
		json={"approval_status": "approved"},
		headers=TENANT_HEADERS,
	)
	assert approve.status_code == status.HTTP_200_OK, approve.text
	assert approve.json().get("approval_status") == "approved"

	with TestClient(app_main.app, headers=TENANT_HEADERS) as login_client:
		login = _login(login_client, payload["user_login_id"], payload["user_password"])
		assert login.status_code == status.HTTP_200_OK, login.text


def test_rejected_user_cannot_login(integration_admin_client):
	admin = integration_admin_client
	payload = {
		"user_login_id": "rejected_signup_user_03",
		"user_password": "test-pass-1234",
		"user_name": "거절유저",
		"user_phone_number": "01055554444",
		"birth_date": "1995-05-05",
	}
	signup = admin.post("/api/auth/signup", json=payload, headers=TENANT_HEADERS)
	assert signup.status_code == status.HTTP_200_OK, signup.text

	db = SessionLocal()
	try:
		user = db.query(User).filter(User.user_login_id == payload["user_login_id"]).first()
		user_id = user.id
	finally:
		db.close()

	reject = admin.patch(
		f"/api/admin/users/{user_id}/approval",
		json={"approval_status": "rejected"},
		headers=TENANT_HEADERS,
	)
	assert reject.status_code == status.HTTP_200_OK, reject.text

	with TestClient(app_main.app, headers=TENANT_HEADERS) as login_client:
		login = _login(login_client, payload["user_login_id"], payload["user_password"])
		assert login.status_code == status.HTTP_403_FORBIDDEN, login.text
		assert "거절" in str(login.json().get("detail") or "")
