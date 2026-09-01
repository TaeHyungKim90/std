"""Platform tenant management API tests."""

import main as app_main
from core.security import get_password_hash
from db.session import SessionLocal
from fastapi.testclient import TestClient
from models.platform_models import PlatformAdmin


def _ensure_platform_admin() -> None:
	db = SessionLocal()
	try:
		existing = db.query(PlatformAdmin).filter(PlatformAdmin.login_id == "pytest_platform").first()
		if not existing:
			db.add(
				PlatformAdmin(
					login_id="pytest_platform",
					password_hash=get_password_hash("pytest_platform_pw"),
					name="Pytest Platform",
					is_active=True,
				)
			)
			db.commit()
	finally:
		db.close()


def _login_platform(client: TestClient) -> None:
	res = client.post(
		"/api/platform/auth/login",
		json={"login_id": "pytest_platform", "password": "pytest_platform_pw"},
	)
	assert res.status_code == 200, res.text


def test_platform_tenant_crud():
	with TestClient(app_main.app) as client:
		_ensure_platform_admin()
		_login_platform(client)
		slug = "pytest-tenant-x"

		list_res = client.get("/api/platform/tenants")
		assert list_res.status_code == 200
		before = len(list_res.json())

		create_res = client.post(
			"/api/platform/tenants",
			json={
				"slug": slug,
				"name": "Pytest Tenant",
				"bootstrap_admin_login_id": "admin",
				"bootstrap_admin_password": "1234",
			},
		)
		assert create_res.status_code == 201, create_res.text
		body = create_res.json()
		assert body["slug"] == slug
		tenant_id = body["id"]

		patch_res = client.patch(
			f"/api/platform/tenants/{tenant_id}",
			json={"name": "Pytest Tenant Updated"},
		)
		assert patch_res.status_code == 200
		assert patch_res.json()["name"] == "Pytest Tenant Updated"

		pw_res = client.patch(
			f"/api/platform/tenants/{tenant_id}",
			json={"bootstrap_admin_password": "5678"},
		)
		assert pw_res.status_code == 200, pw_res.text

		deact_res = client.patch(
			f"/api/platform/tenants/{tenant_id}",
			json={"is_active": False},
		)
		assert deact_res.status_code == 200
		assert deact_res.json()["is_active"] is False

		list_res2 = client.get("/api/platform/tenants")
		assert list_res2.status_code == 200
		assert len(list_res2.json()) >= before + 1

		del_res = client.delete(f"/api/platform/tenants/{tenant_id}")
		assert del_res.status_code == 200, del_res.text

		list_res3 = client.get("/api/platform/tenants")
		assert list_res3.status_code == 200
		ids = {t["id"] for t in list_res3.json()}
		assert tenant_id not in ids


def test_platform_auth_rejects_tenant_token():
	"""테넌트 HR admin JWT로 platform API 접근 불가."""
	headers = {"X-Tenant-Slug": "valuesplay"}
	with TestClient(app_main.app, headers=headers) as client:
		login = client.post(
			"/api/auth/login",
			json={"id": "admin", "pw": "1234"},
		)
		assert login.status_code == 200
		res = client.get("/api/platform/tenants")
		assert res.status_code == 401
