"""소셜 가입 완료(티켓) 플로우 테스트."""

from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from conftest import TENANT_HEADERS
from core.security import create_timed_token
from db.session import SessionLocal
from models.auth_models import User


def test_social_signup_complete_creates_pending_user():
	ticket = create_timed_token(
		{
			"purpose": "social_signup",
			"provider": "kakao",
			"provider_id": "social_complete_pid_01",
			"tenant": "valuesplay",
			"user_name": "소셜완료",
			"user_nickname": "소셜닉",
			"user_phone_number": "01012123434",
			"birth_date": "1991-01-01",
		},
		minutes=30,
	)
	with TestClient(app_main.app, headers=TENANT_HEADERS) as client:
		client.cookies.set("socialSignupTicket", ticket)
		ticket_res = client.get("/api/auth/social-signup/ticket", headers=TENANT_HEADERS)
		assert ticket_res.status_code == status.HTTP_200_OK, ticket_res.text
		assert ticket_res.json().get("provider") == "kakao"

		complete = client.post(
			"/api/auth/social-signup/complete",
			headers=TENANT_HEADERS,
			json={
				"user_name": "소셜완료",
				"user_nickname": "소셜닉",
				"user_phone_number": "01012123434",
				"birth_date": "1991-01-01",
				"address": "서울특별시 강남구 테헤란로 1",
			},
		)
		assert complete.status_code == status.HTTP_200_OK, complete.text
		assert complete.json().get("approval_status") == "pending"

	db = SessionLocal()
	try:
		user = (
			db.query(User)
			.filter(User.provider_kakao_id == "social_complete_pid_01")
			.first()
		)
		assert user is not None
		assert user.approval_status == "pending"
		assert user.address == "서울특별시 강남구 테헤란로 1"
		assert user.user_login_id.startswith("kakao_")
	finally:
		db.close()


def test_public_signup_requires_address():
	with TestClient(app_main.app, headers=TENANT_HEADERS) as client:
		res = client.post(
			"/api/auth/signup",
			headers=TENANT_HEADERS,
			json={
				"user_login_id": "no_address_user_01",
				"user_password": "test-pass-1234",
				"user_name": "주소없음",
				"user_phone_number": "01099887766",
				"birth_date": "1990-09-09",
			},
		)
	assert res.status_code == status.HTTP_400_BAD_REQUEST
	assert "주소" in str(res.json().get("detail") or "")
