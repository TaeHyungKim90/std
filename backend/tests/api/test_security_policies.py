from types import SimpleNamespace

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

import main as app_main  # noqa: E402
from core.config import settings  # noqa: E402
from db.session import get_db  # noqa: E402
from models.auth_models import User  # noqa: E402
from models.common_models import UploadedFile  # noqa: E402
from services.auth_service import get_current_user  # noqa: E402
from services.public.applicant_auth import get_current_applicant  # noqa: E402
from support.memory_db import memory_db_session  # noqa: E402


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


def test_common_download_allows_own_profile_image(monkeypatch, tmp_path):
	from services import common_service

	saved_name = "profile.png"
	(tmp_path / saved_name).write_bytes(b"fake png")
	monkeypatch.setattr(common_service, "UPLOAD_DIR", str(tmp_path))

	with memory_db_session() as db:
		user = User(
			user_login_id="profile-owner",
			user_password="hashed",
			user_name="Profile Owner",
			role="user",
			user_profile_image_url=f"/uploads/{saved_name}",
		)
		file_row = UploadedFile(
			original_name=saved_name,
			saved_name=saved_name,
			file_path=f"/uploads/{saved_name}",
			file_size=8,
			content_type="image/png",
		)
		db.add_all([user, file_row])
		db.commit()
		db.refresh(user)

		def _override_db():
			yield db

		app_main.app.dependency_overrides[get_current_user] = lambda: {"id": user.id, "role": "user"}
		app_main.app.dependency_overrides[get_db] = _override_db

		try:
			client = TestClient(app_main.app)
			res = client.get(f"/api/common/files/by-saved-name/{saved_name}")
			assert res.status_code == status.HTTP_200_OK
			assert res.content == b"fake png"
		finally:
			app_main.app.dependency_overrides.clear()


def test_common_download_blocks_other_users_profile_image(monkeypatch, tmp_path):
	from services import common_service

	saved_name = "other-profile.png"
	(tmp_path / saved_name).write_bytes(b"fake png")
	monkeypatch.setattr(common_service, "UPLOAD_DIR", str(tmp_path))

	with memory_db_session() as db:
		owner = User(
			user_login_id="profile-owner",
			user_password="hashed",
			user_name="Profile Owner",
			role="user",
			user_profile_image_url=f"/uploads/{saved_name}",
		)
		other = User(
			user_login_id="profile-viewer",
			user_password="hashed",
			user_name="Profile Viewer",
			role="user",
		)
		file_row = UploadedFile(
			original_name=saved_name,
			saved_name=saved_name,
			file_path=f"/uploads/{saved_name}",
			file_size=8,
			content_type="image/png",
		)
		db.add_all([owner, other, file_row])
		db.commit()
		db.refresh(other)

		def _override_db():
			yield db

		app_main.app.dependency_overrides[get_current_user] = lambda: {"id": other.id, "role": "user"}
		app_main.app.dependency_overrides[get_db] = _override_db

		try:
			client = TestClient(app_main.app)
			res = client.get(f"/api/common/files/by-saved-name/{saved_name}")
			assert res.status_code == status.HTTP_403_FORBIDDEN
		finally:
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

