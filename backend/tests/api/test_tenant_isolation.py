"""테넌트 간 데이터 격리 스모크 테스트."""

from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from core.limiter import limiter


def test_departments_isolated_between_tenants():
	limiter._storage.reset()
	with TestClient(app_main.app, headers={"X-Tenant-Slug": "valuesplay"}) as vp_client:
		r = vp_client.post(
			"/api/auth/login",
			json={"id": "admin", "pw": "1234"},
		)
		assert r.status_code == status.HTTP_200_OK, r.text

		create = vp_client.post(
			"/api/admin/departments/",
			json={"department_name": "valuesplay-only-dept"},
		)
		assert create.status_code == status.HTTP_200_OK, create.text

	with TestClient(app_main.app, headers={"X-Tenant-Slug": "naver"}) as nv_client:
		r = nv_client.post(
			"/api/auth/login",
			json={"id": "admin", "pw": "1234"},
		)
		assert r.status_code == status.HTTP_200_OK, r.text

		naver_list = nv_client.get("/api/admin/departments/")
		assert naver_list.status_code == status.HTTP_200_OK, naver_list.text
		names = [d["department_name"] for d in naver_list.json()]
		assert "valuesplay-only-dept" not in names


def test_tenant_header_required_for_login():
	with TestClient(app_main.app) as client:
		r = client.post(
			"/api/auth/login",
			json={"id": "admin", "pw": "1234"},
		)
		assert r.status_code == status.HTTP_400_BAD_REQUEST


def test_public_jobs_scoped_by_tenant():
	with TestClient(app_main.app) as client:
		vp = client.get("/api/public/recruitment/jobs", headers={"X-Tenant-Slug": "valuesplay"})
		nv = client.get("/api/public/recruitment/jobs", headers={"X-Tenant-Slug": "naver"})
		assert vp.status_code == status.HTTP_200_OK
		assert nv.status_code == status.HTTP_200_OK
		assert "items" in vp.json()
		assert "items" in nv.json()
