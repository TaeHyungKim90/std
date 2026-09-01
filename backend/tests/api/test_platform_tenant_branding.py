"""Platform tenant logo/icon branding API tests."""

import io

import main as app_main
from core.security import get_password_hash
from db.session import SessionLocal
from fastapi.testclient import TestClient
from models.platform_models import PlatformAdmin
from services.tenant_branding_service import DEFAULT_ICON_URL, DEFAULT_LOGO_URL


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


# 1x1 PNG
_TINY_PNG = (
	b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
	b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
	b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_platform_tenant_branding_defaults_and_upload():
	with TestClient(app_main.app) as client:
		_ensure_platform_admin()
		_login_platform(client)
		slug = "pytest-branding-y"

		create_res = client.post(
			"/api/platform/tenants",
			json={"slug": slug, "name": "Branding Test"},
		)
		assert create_res.status_code == 201, create_res.text
		tenant_id = create_res.json()["id"]

		get_res = client.get(f"/api/platform/tenants/{tenant_id}/branding")
		assert get_res.status_code == 200
		data = get_res.json()
		assert data["logo_url"] is None
		assert data["icon_url"] is None
		assert data["logo_url_effective"] == DEFAULT_LOGO_URL
		assert data["icon_url_effective"] == DEFAULT_ICON_URL

		exists_res = client.get(f"/api/tenants/{slug}/exists")
		assert exists_res.status_code == 200
		assert exists_res.json()["logo_url"] == DEFAULT_LOGO_URL

		logo_api_res = client.get(f"/api/tenants/{slug}/branding/logo")
		assert logo_api_res.status_code == 200

		logo_res = client.post(
			f"/api/platform/tenants/{tenant_id}/branding/logo",
			files={"file": ("logo.png", io.BytesIO(_TINY_PNG), "image/png")},
		)
		assert logo_res.status_code == 200, logo_res.text
		assert logo_res.json()["logo_url"] is not None
		logo_effective = logo_res.json()["logo_url_effective"]
		assert logo_effective == f"/api/tenants/{slug}/branding/logo"

		logo_api_res = client.get(logo_effective)
		assert logo_api_res.status_code == 200, logo_api_res.text
		assert logo_api_res.headers.get("content-type", "").startswith("image/")

		icon_res = client.post(
			f"/api/platform/tenants/{tenant_id}/branding/icon",
			files={"file": ("icon.png", io.BytesIO(_TINY_PNG), "image/png")},
		)
		assert icon_res.status_code == 200, icon_res.text
		assert icon_res.json()["icon_url"] is not None

		exists2 = client.get(f"/api/tenants/{slug}/exists")
		assert exists2.status_code == 200
		assert exists2.json()["logo_url"] == f"/api/tenants/{slug}/branding/logo"
		assert exists2.json()["icon_url"] == f"/api/tenants/{slug}/branding/icon"

		client.delete(f"/api/platform/tenants/{tenant_id}")
