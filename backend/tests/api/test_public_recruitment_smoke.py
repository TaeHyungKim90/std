"""
채용 공개 API 스모크: 공고 목록 응답 형식·예외 경로를 서비스 레이어는 목으로 고정해 검증.
"""
from fastapi import status
from fastapi.testclient import TestClient

import main as app_main
from api.public import recruitment as recruitment_api


def test_public_jobs_returns_paginated_shape(monkeypatch):
	def _fake_jobs(db, skip=0, limit=20, applicant_id=None):
		return {"items": [], "total": 0}

	monkeypatch.setattr(recruitment_api.service, "get_public_jobs", _fake_jobs)

	client = TestClient(app_main.app)
	res = client.get("/api/public/recruitment/jobs")
	assert res.status_code == status.HTTP_200_OK
	data = res.json()
	assert data.get("items") == []
	assert data.get("total") == 0


def test_public_jobs_wraps_unexpected_errors_as_500(monkeypatch):
	def _boom(db, skip=0, limit=20, applicant_id=None):
		raise RuntimeError("simulated db failure")

	monkeypatch.setattr(recruitment_api.service, "get_public_jobs", _boom)

	client = TestClient(app_main.app)
	res = client.get("/api/public/recruitment/jobs")
	assert res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
