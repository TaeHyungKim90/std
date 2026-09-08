"""주소 공개 토글(PATCH /auth/me) 테스트."""

from fastapi import status

from conftest import TENANT_HEADERS
from db.session import SessionLocal
from models.auth_models import User


def test_patch_me_share_address_in_directory_toggle(integration_employee_client):
	client = integration_employee_client

	r0 = client.get("/api/auth/me")
	assert r0.status_code == status.HTTP_200_OK, r0.text
	assert r0.json().get("share_address_in_directory") is True

	r1 = client.patch("/api/auth/me", json={"share_address_in_directory": False})
	assert r1.status_code == status.HTTP_200_OK, r1.text
	assert r1.json().get("share_address_in_directory") is False

	r2 = client.get("/api/auth/me")
	assert r2.status_code == status.HTTP_200_OK
	assert r2.json().get("share_address_in_directory") is False
	# 본인 주소는 토글과 무관하게 me 응답에 유지
	assert "address" in r2.json()

	r3 = client.patch("/api/auth/me", json={"share_address_in_directory": True})
	assert r3.status_code == status.HTTP_200_OK
	assert r3.json().get("share_address_in_directory") is True

	login_id = r0.json().get("user_login_id")
	db = SessionLocal()
	try:
		user = db.query(User).filter(User.user_login_id == login_id).first()
		assert user is not None
		assert user.share_address_in_directory is True
	finally:
		db.close()
