"""
멀티테넌트 전 메뉴 수동 테스트 플랜 — API 자동 검증.

수동 체크리스트(docs/플랜)와 1:1 대응하는 회귀 테스트입니다.
브라우저 UI는 별도 수동 확인이 필요합니다.
"""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date

import pytest
from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from core.limiter import limiter
from core.security import create_access_token
from db.session import get_db
from support.multitenant_manual_seed import (
	MANUAL_TEST_PASSWORD,
	MARKER,
	SLUG_A,
	SLUG_B,
	ManualTestSeedContext,
	seed_manual_test_data,
)
from support.memory_db import memory_db_session


@pytest.fixture(autouse=True)
def _reset_rate_limit():
	limiter._storage.reset()
	yield
	limiter._storage.reset()


@contextmanager
def _client_for_db(db, tenant_slug: str):
	def _override_db():
		yield db

	app_main.app.dependency_overrides[get_db] = _override_db
	client = TestClient(app_main.app, headers={"X-Tenant-Slug": tenant_slug})
	try:
		yield client
	finally:
		app_main.app.dependency_overrides.clear()


@contextmanager
def _admin_client(db, ctx: ManualTestSeedContext, tenant_slug: str, tenant_id: int):
	token = _token_for(db, ctx, tenant_id=tenant_id, slug=tenant_slug)
	with _client_for_db(db, tenant_slug) as client:
		client.cookies.set("accessToken", token)
		yield client


def _login_admin(client: TestClient) -> None:
	r = client.post("/api/auth/login", json={"id": "admin", "pw": MANUAL_TEST_PASSWORD})
	assert r.status_code == status.HTTP_200_OK, r.text


def _token_for(db, ctx: ManualTestSeedContext, *, tenant_id: int, slug: str) -> str:
	from models.auth_models import User

	user = (
		db.query(User)
		.filter(User.tenant_id == tenant_id, User.user_login_id == "admin")
		.one()
	)
	return create_access_token(
		{
			"userId": user.user_login_id,
			"userName": user.user_name,
			"userNickname": user.user_nickname,
			"role": user.role,
			"id": user.id,
			"tenantId": tenant_id,
			"tenantSlug": slug,
		}
	)


@pytest.fixture()
def manual_seed():
	with memory_db_session() as db:
		ctx = seed_manual_test_data(db)
		yield db, ctx


# --- Phase 0: 인증·세션 ---


class TestPhase0Session:
	def test_0_1_valuesplay_admin_login(self, manual_seed):
		db, _ctx = manual_seed
		with _client_for_db(db, SLUG_A) as client:
			r = client.post("/api/auth/login", json={"id": "admin", "pw": MANUAL_TEST_PASSWORD})
			assert r.status_code == status.HTTP_200_OK
			assert r.json().get("userName") == "Admin A"

	def test_0_2_cross_tenant_check_auth_logged_out(self, manual_seed):
		db, ctx = manual_seed
		token = _token_for(db, ctx, tenant_id=ctx.tid_a, slug=SLUG_A)
		with _client_for_db(db, SLUG_B) as client:
			r = client.get("/api/auth/check", cookies={"accessToken": token})
			assert r.status_code == status.HTTP_200_OK
			assert r.json().get("isLoggedIn") is False

	def test_0_3_naver_admin_login(self, manual_seed):
		db, _ctx = manual_seed
		with _client_for_db(db, SLUG_B) as client:
			r = client.post("/api/auth/login", json={"id": "admin", "pw": MANUAL_TEST_PASSWORD})
			assert r.status_code == status.HTTP_200_OK
			assert r.json().get("userName") == "Admin B"

	def test_0_5_profile_me_tenant_scoped(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/auth/me")
			assert r.status_code == status.HTTP_200_OK
			body = r.json()
			assert body.get("user_name") == "Admin A"
			vac = body.get("vacation") or {}
			assert vac.get("total_days") == 5


# --- Phase 1: HR GNB ---


class TestPhase1HrMenus:
	def test_1_todos_tenant_isolated(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/hr/todos/")
			assert r.status_code == status.HTTP_200_OK
			titles = [t.get("title") for t in r.json()]
			assert any(MARKER in (t or "") for t in titles)
			assert not any("todo-b" in (t or "") for t in titles)

	def test_1_attendance_today_one_session(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get(
				f"/api/hr/attendance/day?work_date={ctx.work_date.isoformat()}"
			)
			assert r.status_code == status.HTTP_200_OK
			assert r.json() is not None

	def test_1_profile_vacation_b_differs(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_B, ctx.tid_b) as client:
			r = client.get("/api/auth/me")
			assert r.status_code == status.HTTP_200_OK
			vac = r.json().get("vacation") or {}
			assert vac.get("total_days") == 17


# --- Phase 2: 관리자 인사 ---


class TestPhase2AdminHr:
	def test_2_1_users_no_cross_tenant(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/users/")
			assert r.status_code == status.HTTP_200_OK
			login_ids = [u["user_login_id"] for u in r.json()]
			assert "emp_a" in login_ids
			assert "emp_b" not in login_ids
			assert login_ids.count("shared01") == 1

	def test_2_2_attendance_one_row_per_user(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get(
				f"/api/admin/attendance/all?work_date={ctx.work_date.isoformat()}&limit=50"
			)
			assert r.status_code == status.HTTP_200_OK
			data = r.json()
			ids = [row["user_id"] for row in data["items"]]
			assert ids.count("admin") == 1
			assert ids.count("shared01") == 1
			assert data["total"] == len(set(ids))

	def test_2_2_attendance_location_tenant_scoped(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get(
				f"/api/admin/attendance/all?work_date={ctx.work_date.isoformat()}&limit=50"
			)
			admin_row = next(row for row in r.json()["items"] if row["user_id"] == "admin")
			assert admin_row.get("clock_in_location") == "Seoul Head Office"

		with _admin_client(db, ctx, SLUG_B, ctx.tid_b) as client:
			r = client.get(
				f"/api/admin/attendance/all?work_date={ctx.work_date.isoformat()}&limit=50"
			)
			admin_row = next(row for row in r.json()["items"] if row["user_id"] == "admin")
			assert admin_row.get("clock_in_location") == "New York Branch"

	def test_2_3_monthly_rewards_no_duplicate_users(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/attendance/monthly-rewards?year=2026&month=6")
			assert r.status_code == status.HTTP_200_OK
			ids = [row.get("user_id") for row in r.json().get("items", [])]
			assert len(ids) == len(set(ids))

	def test_2_4_todos_author_tenant_scoped(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/todos/?limit=50")
			assert r.status_code == status.HTTP_200_OK
			shared = next(
				i for i in r.json()["items"] if MARKER in (i.get("title") or "")
			)
			author = shared.get("author") or {}
			assert author.get("user_name") == "공유직원 A"

		with _admin_client(db, ctx, SLUG_B, ctx.tid_b) as client:
			r = client.get("/api/admin/todos/?limit=50")
			shared = next(
				i for i in r.json()["items"] if "shared-b" in (i.get("title") or "")
			)
			author = shared.get("author") or {}
			assert author.get("user_name") == "공유직원 B"

	def test_2_5_reports_no_duplicate_users(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get(
				f"/api/admin/reports/daily-status?work_date={ctx.work_date.isoformat()}"
			)
			assert r.status_code == status.HTTP_200_OK
			ids = [row.get("user_login_id") for row in r.json()]
			assert len(ids) == len(set(ids))

	def test_2_6_messages_outbox_tenant_scoped(self, manual_seed):
		db, ctx = manual_seed
		from models.auth_models import User
		from models.message_models import Message

		admin_a = (
			db.query(User)
			.filter(User.tenant_id == ctx.tid_a, User.user_login_id == "admin")
			.one()
		)
		if db.query(Message).filter(Message.title == f"{MARKER}-msg-a").count() == 0:
			db.add(
				Message(
					title=f"{MARKER}-msg-a",
					content="A only",
					is_global=True,
					sender_id=admin_a.id,
				)
			)
			db.commit()

		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/messages/outbox")
			assert r.status_code == status.HTTP_200_OK
			titles = [m.get("title") for m in r.json().get("items", [])]
			assert f"{MARKER}-msg-a" in titles

		with _admin_client(db, ctx, SLUG_B, ctx.tid_b) as client:
			r = client.get("/api/messages/outbox")
			titles = [m.get("title") for m in r.json().get("items", [])]
			assert f"{MARKER}-msg-a" not in titles


# --- Phase 3-4: 채용·시스템관리 ---


class TestPhase3And4Admin:
	def test_3_recruitment_jobs_isolated(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/recruitment/jobs")
			assert r.status_code == status.HTTP_200_OK
			titles = [j["title"] for j in r.json().get("items", [])]
			assert any("job-a" in t for t in titles)
			assert not any("job-b" in t for t in titles)

	def test_4_departments_isolated(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/departments/")
			names = [d["department_name"] for d in r.json()]
			assert "A개발팀" in names
			assert "B마케팅" not in names

	def test_4_work_locations_same_key_different_value(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/work-locations/")
			main = next(w for w in r.json() if w["location_key"] == "MAIN")
			assert main["location_value"] == "Seoul Head Office"

		with _admin_client(db, ctx, SLUG_B, ctx.tid_b) as client:
			r = client.get("/api/admin/work-locations/")
			main = next(w for w in r.json() if w["location_key"] == "MAIN")
			assert main["location_value"] == "New York Branch"

	def test_4_categories_tenant_scoped(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/category-types/")
			assert r.status_code == status.HTTP_200_OK
			keys = [c["category_key"] for c in r.json()]
			assert "vacation_full" in keys


# --- Phase 5: 대시보드 ---


class TestPhase5Dashboard:
	def test_5_stats_vacation_isolated(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get("/api/admin/stats/")
			assert r.status_code == status.HTTP_200_OK
			data = r.json()
			assert data.get("vacation_count", 0) >= 1
			names = [v.get("user_name") for v in data.get("today_vacations", [])]
			assert not any("직원 B" in (n or "") for n in names)


# --- Phase 6: 공개 채용 ---


class TestPhase6PublicCareers:
	def test_6_public_jobs_scoped(self, manual_seed):
		db, _ctx = manual_seed
		with _client_for_db(db, SLUG_A) as client:
			r = client.get("/api/public/recruitment/jobs")
			titles = [j["title"] for j in r.json().get("items", [])]
			assert any("job-a" in t for t in titles)
			assert not any("job-b" in t for t in titles)


# --- Phase 7 + Cross matrix ---


class TestCrossTenantMatrix:
	def test_c1_b_admin_url_without_b_session(self, manual_seed):
		db, ctx = manual_seed
		token = _token_for(db, ctx, tenant_id=ctx.tid_a, slug=SLUG_A)
		with _client_for_db(db, SLUG_B) as client:
			r = client.get(
				"/api/admin/users/",
				cookies={"accessToken": token},
			)
			assert r.status_code in (
				status.HTTP_401_UNAUTHORIZED,
				status.HTTP_403_FORBIDDEN,
			)

	def test_c2_shared01_attendance_isolated(self, manual_seed):
		db, ctx = manual_seed
		with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as client:
			r = client.get(
				f"/api/admin/attendance/all?work_date={ctx.work_date.isoformat()}&limit=50"
			)
			ids = [row["user_id"] for row in r.json()["items"]]
			assert "shared01" in ids

		with _admin_client(db, ctx, SLUG_B, ctx.tid_b) as client:
			r = client.get(
				f"/api/admin/attendance/all?work_date={ctx.work_date.isoformat()}&limit=50"
			)
			ids = [row["user_id"] for row in r.json()["items"]]
			assert "shared01" in ids
			assert len(ids) == len(set(ids))
