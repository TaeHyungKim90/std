import os
import sys
from types import SimpleNamespace

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

# 테스트 실행 위치에 상관없이 app 모듈 임포트 가능하게 보정
APP_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "app"))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

import main as app_main  # noqa: E402
from core.config import settings  # noqa: E402
from db.session import get_db  # noqa: E402
from services.auth_service import get_current_user  # noqa: E402
from services.public.applicant_auth import get_current_applicant  # noqa: E402


class _FakeQuery:
    def __init__(self, row):
        self._row = row

    def filter(self, *_args, **_kwargs):
        return self

    def first(self):
        return self._row


class _FakeDB:
    def __init__(self, row):
        self._row = row

    def query(self, *_args, **_kwargs):
        return _FakeQuery(self._row)


def test_common_upload_requires_authentication():
    client = TestClient(app_main.app)
    res = client.post(
        "/api/common/upload",
        files=[("files", ("sample.pdf", b"dummy", "application/pdf"))],
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_common_download_returns_403_when_authorized_user_has_no_permission(monkeypatch):
    # 인증은 통과시키고, 파일 권한 체크에서 403 강제
    app_main.app.dependency_overrides[get_current_user] = lambda: {"id": 101, "role": "user"}
    app_main.app.dependency_overrides[get_db] = lambda: _FakeDB(
        SimpleNamespace(id=1, saved_name="dummy.pdf", original_name="dummy.pdf", content_type="application/pdf")
    )

    from services import common_service

    def _deny(*_args, **_kwargs):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 파일에 접근할 권한이 없습니다.")

    monkeypatch.setattr(common_service, "assert_user_may_download_uploaded_file", _deny)

    client = TestClient(app_main.app)
    res = client.get("/api/common/files/1")
    assert res.status_code == status.HTTP_403_FORBIDDEN

    app_main.app.dependency_overrides.clear()


def test_legacy_applicant_endpoint_returns_410_when_disabled():
    app_main.app.dependency_overrides[get_current_applicant] = lambda: {"applicantId": 1}
    prev = settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS
    settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS = False

    try:
        client = TestClient(app_main.app)
        res = client.get("/api/public/recruitment/my-applications/1")
        assert res.status_code == status.HTTP_410_GONE
    finally:
        settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS = prev
        app_main.app.dependency_overrides.clear()

