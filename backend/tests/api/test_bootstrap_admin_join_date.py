"""부트스트랩 admin 입사일 변경 차단."""

from datetime import date

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from constants.bootstrap_admin import is_bootstrap_system_admin
from models.auth_models import User
from support.memory_db import memory_db_session


def test_is_bootstrap_system_admin_by_login_id():
	u = User(
		tenant_id=1,
		user_login_id="admin",
		user_password="x",
		user_name="Admin",
		role="admin",
	)
	assert is_bootstrap_system_admin(u) is True
	u2 = User(
		tenant_id=1,
		user_login_id="emp1",
		user_password="x",
		user_name="Emp",
		role="user",
	)
	assert is_bootstrap_system_admin(u2) is False


def test_patch_me_rejects_join_date_for_bootstrap_admin():
	import main as app_main
	from db.session import get_db
	from services import auth_service as auth_service_module

	with memory_db_session() as db:
		admin = User(
			tenant_id=1,
			user_login_id="admin",
			user_password="x",
			user_name="Admin",
			role="admin",
			visible_in_user_list=False,
		)
		db.add(admin)
		db.commit()
		db.refresh(admin)

		def _override_db():
			yield db

		def _override_user():
			return {
				"id": admin.id,
				"userId": admin.user_login_id,
				"role": admin.role,
				"tenantId": admin.tenant_id,
			}

		app_main.app.dependency_overrides[get_db] = _override_db
		app_main.app.dependency_overrides[auth_service_module.get_current_user_for_tenant] = _override_user
		try:
			client = TestClient(app_main.app, headers={"X-Tenant-Slug": "valuesplay"})
			res = client.patch("/api/auth/me", json={"join_date": date(2020, 1, 1).isoformat()})
			assert res.status_code == status.HTTP_400_BAD_REQUEST
			assert "입사일" in str(res.json().get("detail") or "")
		finally:
			app_main.app.dependency_overrides.clear()


def test_get_me_join_date_editable_flag_for_admin():
	import main as app_main
	from db.session import get_db
	from services import auth_service as auth_service_module

	with memory_db_session() as db:
		admin = User(
			tenant_id=1,
			user_login_id="admin",
			user_password="x",
			user_name="Admin",
			role="admin",
		)
		db.add(admin)
		db.commit()
		db.refresh(admin)

		def _override_db():
			yield db

		def _override_user():
			return {
				"id": admin.id,
				"userId": admin.user_login_id,
				"role": admin.role,
				"tenantId": admin.tenant_id,
			}

		app_main.app.dependency_overrides[get_db] = _override_db
		app_main.app.dependency_overrides[auth_service_module.get_current_user_for_tenant] = _override_user
		try:
			client = TestClient(app_main.app, headers={"X-Tenant-Slug": "valuesplay"})
			res = client.get("/api/auth/me")
			assert res.status_code == status.HTTP_200_OK
			assert res.json().get("join_date_editable") is False
		finally:
			app_main.app.dependency_overrides.clear()
