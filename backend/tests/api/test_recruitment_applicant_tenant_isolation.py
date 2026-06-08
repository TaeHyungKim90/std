"""동일 이메일 지원자가 A·B 테넌트에 각각 지원할 때 채용 데이터 격리 검증."""

from __future__ import annotations

from contextlib import contextmanager

import pytest
from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from core.limiter import limiter
from core.security import create_access_token
from db.session import get_db
from models.recruitment_models import Applicant, Application, JobPosting
from support.multitenant_manual_seed import (
	MARKER,
	SLUG_A,
	SLUG_B,
	ManualTestSeedContext,
	seed_manual_test_data,
)
from support.memory_db import memory_db_session

SHARED_EMAIL = "same.person@pytest.local"
APPLY_PASSWORD = "ApplyPass1!"


@pytest.fixture(autouse=True)
def _reset_rate_limit():
	limiter._storage.reset()
	yield
	limiter._storage.reset()


@pytest.fixture()
def manual_seed():
	with memory_db_session() as db:
		ctx = seed_manual_test_data(db)
		yield db, ctx


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


def _admin_token(db, ctx: ManualTestSeedContext, tenant_id: int, slug: str) -> str:
	from models.auth_models import User

	admin = (
		db.query(User)
		.filter(User.tenant_id == tenant_id, User.user_login_id == "admin")
		.one()
	)
	return create_access_token(
		{
			"userId": admin.user_login_id,
			"userName": admin.user_name,
			"role": admin.role,
			"id": admin.id,
			"tenantId": tenant_id,
			"tenantSlug": slug,
		}
	)


@contextmanager
def _admin_client(db, ctx: ManualTestSeedContext, tenant_slug: str, tenant_id: int):
	with _client_for_db(db, tenant_slug) as client:
		client.cookies.set("accessToken", _admin_token(db, ctx, tenant_id, tenant_slug))
		yield client


def _signup_login_apply(
	client: TestClient,
	*,
	job_id: int,
	email: str,
	password: str,
	name: str,
	phone: str,
	resume_url: str,
) -> int:
	r_sign = client.post(
		"/api/public/recruitment/signup",
		json={
			"email_id": email,
			"password": password,
			"name": name,
			"phone": phone,
		},
	)
	assert r_sign.status_code == status.HTTP_200_OK, r_sign.text
	applicant_id = r_sign.json()["applicant_id"]

	r_login = client.post(
		"/api/public/recruitment/login",
		json={"email_id": email, "password": password},
	)
	assert r_login.status_code == status.HTTP_200_OK, r_login.text

	r_apply = client.post(
		"/api/public/recruitment/apply/me",
		json={"job_id": job_id, "resume_file_url": resume_url},
	)
	assert r_apply.status_code == status.HTTP_200_OK, r_apply.text
	assert "application_id" in r_apply.json()
	return applicant_id


def _job_id(db, tenant_id: int, title_suffix: str) -> int:
	job = (
		db.query(JobPosting)
		.filter(JobPosting.tenant_id == tenant_id, JobPosting.title == f"{MARKER}-job-{title_suffix}")
		.one()
	)
	return int(job.id)


def test_same_email_applies_to_both_tenants_isolated(manual_seed):
	"""동일 email_id → 테넌트별 Applicant·Application 분리, 관리자·내 지원 내역 격리."""
	db, ctx = manual_seed
	job_a = _job_id(db, ctx.tid_a, "a")
	job_b = _job_id(db, ctx.tid_b, "b")

	with _client_for_db(db, SLUG_A) as client_a:
		applicant_a_id = _signup_login_apply(
			client_a,
			job_id=job_a,
			email=SHARED_EMAIL,
			password=APPLY_PASSWORD,
			name="지원자 A",
			phone="01011112222",
			resume_url="/uploads/resume-a.pdf",
		)
		r_apps_a = client_a.get("/api/public/recruitment/my-applications")
		assert r_apps_a.status_code == status.HTTP_200_OK, r_apps_a.text
		apps_a = r_apps_a.json()
		assert len(apps_a) == 1
		assert apps_a[0]["job_id"] == job_a
		assert MARKER in (apps_a[0].get("job_title") or "")

	with _client_for_db(db, SLUG_B) as client_b:
		applicant_b_id = _signup_login_apply(
			client_b,
			job_id=job_b,
			email=SHARED_EMAIL,
			password=APPLY_PASSWORD,
			name="지원자 B",
			phone="01033334444",
			resume_url="/uploads/resume-b.pdf",
		)
		r_apps_b = client_b.get("/api/public/recruitment/my-applications")
		assert r_apps_b.status_code == status.HTTP_200_OK, r_apps_b.text
		apps_b = r_apps_b.json()
		assert len(apps_b) == 1
		assert apps_b[0]["job_id"] == job_b
		assert apps_b[0]["job_id"] != job_a

	assert applicant_a_id != applicant_b_id

	applicants = db.query(Applicant).filter(Applicant.email_id == SHARED_EMAIL).all()
	assert len(applicants) == 2
	assert {int(a.tenant_id) for a in applicants} == {ctx.tid_a, ctx.tid_b}

	apps = db.query(Application).filter(
		Application.applicant_id.in_([applicant_a_id, applicant_b_id])
	).all()
	assert len(apps) == 2
	assert {int(a.applicant_id) for a in apps} == {applicant_a_id, applicant_b_id}

	with _admin_client(db, ctx, SLUG_A, ctx.tid_a) as admin_a:
		r = admin_a.get(f"/api/admin/recruitment/jobs/{job_a}/applications")
		assert r.status_code == status.HTTP_200_OK, r.text
		items = r.json()
		assert len(items) == 1
		assert items[0]["applicant_id"] == applicant_a_id
		assert items[0]["resume_file_url"] == "/uploads/resume-a.pdf"

	with _admin_client(db, ctx, SLUG_B, ctx.tid_b) as admin_b:
		r = admin_b.get(f"/api/admin/recruitment/jobs/{job_b}/applications")
		assert r.status_code == status.HTTP_200_OK, r.text
		items = r.json()
		assert len(items) == 1
		assert items[0]["applicant_id"] == applicant_b_id
		assert items[0]["resume_file_url"] == "/uploads/resume-b.pdf"

		# B 관리자가 A 공고 지원 목록 조회 불가
		r_other = admin_b.get(f"/api/admin/recruitment/jobs/{job_a}/applications")
		assert r_other.status_code == status.HTTP_404_NOT_FOUND


def test_applicant_jwt_cross_tenant_rejected_on_my_applications(manual_seed):
	"""A 테넌트 지원자 JWT로 B /my-applications 요청 시 403."""
	db, ctx = manual_seed
	job_a = _job_id(db, ctx.tid_a, "a")

	with _client_for_db(db, SLUG_A) as client_a:
		_signup_login_apply(
			client_a,
			job_id=job_a,
			email="cross.tenant@pytest.local",
			password=APPLY_PASSWORD,
			name="크로스테스트",
			phone="01055556666",
			resume_url="/uploads/resume-cross.pdf",
		)
		token_a = client_a.cookies.get("applicantToken")

	with _client_for_db(db, SLUG_B) as client_b:
		client_b.cookies.set("applicantToken", token_a)
		r = client_b.get("/api/public/recruitment/my-applications")
		assert r.status_code == status.HTTP_403_FORBIDDEN
		assert "다른 기업" in str(r.json().get("detail") or "")
