"""
채용 공개 API + 관리자 공고 생성 + 지원자 가입·로그인·/apply/me·내역 조회 통합.
"""
import uuid

from fastapi import status
from fastapi.testclient import TestClient

import main as app_main


def test_recruitment_job_create_public_list_apply_me_and_my_applications(integration_admin_client):
	r_job = integration_admin_client.post(
		"/api/admin/recruitment/jobs",
		json={
			"title": "pytest 통합 공고",
			"description": "통합 테스트용 설명",
			"status": "open",
		},
	)
	assert r_job.status_code == status.HTTP_200_OK, r_job.text
	job_id = r_job.json()["id"]

	with TestClient(app_main.app) as public_client:
		r_list = public_client.get("/api/public/recruitment/jobs")
		assert r_list.status_code == status.HTTP_200_OK, r_list.text
		job_ids = {item["id"] for item in r_list.json().get("items", [])}
		assert job_id in job_ids

		email = f"applicant_{uuid.uuid4().hex[:12]}@pytest.local"
		r_sign = public_client.post(
			"/api/public/recruitment/signup",
			json={
				"email_id": email,
				"password": "ApplyPass1!",
				"name": "통합지원자",
				"phone": "01099887766",
			},
		)
		assert r_sign.status_code == status.HTTP_200_OK, r_sign.text

		r_login = public_client.post(
			"/api/public/recruitment/login",
			json={"email_id": email, "password": "ApplyPass1!"},
		)
		assert r_login.status_code == status.HTTP_200_OK, r_login.text

		r_apply = public_client.post(
			"/api/public/recruitment/apply/me",
			json={
				"job_id": job_id,
				"resume_file_url": "https://example.com/pytest-resume.pdf",
			},
		)
		assert r_apply.status_code == status.HTTP_200_OK, r_apply.text
		assert "application_id" in r_apply.json()

		r_apps = public_client.get("/api/public/recruitment/my-applications")
		assert r_apps.status_code == status.HTTP_200_OK, r_apps.text
		apps = r_apps.json()
		assert isinstance(apps, list)
		assert any(a.get("job_id") == job_id for a in apps)
