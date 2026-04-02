"""
추가 API 스모크: 메시지·관리자 사용자/통계·공통 파일 경로 검증·인증 보조·채용 로그인.
"""
from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from services.auth_service import get_current_user


def _client():
	return TestClient(app_main.app)


def test_messages_inbox_requires_authentication():
	res = _client().get("/api/messages/inbox")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_messages_outbox_requires_authentication():
	res = _client().get("/api/messages/outbox")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_messages_send_requires_authentication():
	res = _client().post(
		"/api/messages/",
		json={
			"title": "t",
			"message_type": "individual",
			"is_global": False,
			"receiver_id": 1,
			"file_ids": [],
		},
	)
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_users_list_requires_authentication():
	res = _client().get("/api/admin/users/")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_stats_requires_authentication():
	res = _client().get("/api/admin/stats/")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_auth_logout_ok_without_session():
	res = _client().post("/api/auth/logout")
	assert res.status_code == status.HTTP_200_OK
	assert res.json().get("success") is True


def test_auth_check_invalid_bearer_token_treated_as_logged_out():
	res = _client().get(
		"/api/auth/check",
		headers={"Authorization": "Bearer not-a-valid-jwt-token"},
	)
	assert res.status_code == status.HTTP_200_OK
	assert res.json().get("isLoggedIn") is False


def test_common_download_by_saved_name_requires_authentication():
	res = _client().get("/api/common/files/by-saved-name/sample.pdf")
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_common_download_by_saved_name_rejects_double_dot_segment():
	"""경로에 '..'가 포함되면 400 (URL 정규화로 ../ 세그먼트가 사라지는 경우는 별도)."""
	app_main.app.dependency_overrides[get_current_user] = lambda: {
		"id": 1,
		"userId": "u1",
		"role": "user",
	}
	try:
		res = _client().get("/api/common/files/by-saved-name/evil..dot.pdf")
		assert res.status_code == status.HTTP_400_BAD_REQUEST
	finally:
		app_main.app.dependency_overrides.clear()


def test_public_recruitment_login_invalid_credentials_401(monkeypatch):
	from api.public import recruitment as recruitment_api

	monkeypatch.setattr(recruitment_api.service, "login_applicant", lambda db, data: None)

	res = _client().post(
		"/api/public/recruitment/login",
		json={"email_id": "nobody@example.com", "password": "wrong"},
	)
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_public_recruitment_signup_duplicate_email_400(monkeypatch):
	from api.public import recruitment as recruitment_api

	monkeypatch.setattr(recruitment_api.service, "signup_applicant", lambda db, data: None)

	res = _client().post(
		"/api/public/recruitment/signup",
		json={
			"email_id": "dup@example.com",
			"password": "Secret1!",
			"name": "테스트",
			"phone": "01012345678",
		},
	)
	assert res.status_code == status.HTTP_400_BAD_REQUEST
