from types import SimpleNamespace

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

import main as app_main  # noqa: E402
from conftest import TENANT_HEADERS  # noqa: E402
from core.config import settings  # noqa: E402
from db.session import get_db  # noqa: E402
from core.tenant import require_tenant  # noqa: E402
from models.auth_models import User  # noqa: E402
from models.common_models import UploadedFile  # noqa: E402
from models.tenant_models import Tenant  # noqa: E402
from models.message_models import Message, MessageAttachment  # noqa: E402
from services.auth_service import get_current_user_for_tenant_media  # noqa: E402
from services.public.applicant_auth import get_current_applicant_for_tenant  # noqa: E402
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
	client = TestClient(app_main.app, headers=TENANT_HEADERS)
	res = client.post(
		"/api/common/upload",
		files=[("files", ("sample.pdf", b"dummy", "application/pdf"))],
	)
	assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_common_download_returns_403_when_authorized_user_has_no_permission(monkeypatch):
	# 인증은 통과시키고, 파일 권한 체크에서 403 강제
	app_main.app.dependency_overrides[get_current_user_for_tenant_media] = lambda: {
		"id": 101,
		"role": "user",
		"tenantId": 1,
	}
	app_main.app.dependency_overrides[get_db] = lambda: _FakeDB(
		SimpleNamespace(id=1, saved_name="dummy.pdf", original_name="dummy.pdf", content_type="application/pdf")
	)

	from services import common_service

	def _deny(*_args, **_kwargs):
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 파일에 접근할 권한이 없습니다.")

	monkeypatch.setattr(common_service, "assert_user_may_download_uploaded_file", _deny)

	client = TestClient(app_main.app, headers=TENANT_HEADERS)
	res = client.get("/api/common/files/1")
	assert res.status_code == status.HTTP_403_FORBIDDEN

	app_main.app.dependency_overrides.clear()


def test_common_download_allows_own_profile_image_with_tenant_query(monkeypatch, tmp_path):
	from services import common_service

	saved_name = "profile-query.png"
	(tmp_path / saved_name).write_bytes(b"fake png")
	monkeypatch.setattr(common_service, "UPLOAD_DIR", str(tmp_path))

	with memory_db_session() as db:
		user = User(
			tenant_id=1,
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

		app_main.app.dependency_overrides[get_current_user_for_tenant_media] = lambda: {
			"id": user.id,
			"role": "user",
			"tenantId": 1,
		}
		app_main.app.dependency_overrides[get_db] = _override_db

		try:
			client = TestClient(app_main.app)
			res = client.get(
				f"/api/common/files/by-saved-name/{saved_name}?tenant=valuesplay"
			)
			assert res.status_code == status.HTTP_200_OK
			assert res.content == b"fake png"
		finally:
			app_main.app.dependency_overrides.clear()


def test_common_download_allows_own_profile_image(monkeypatch, tmp_path):
	from services import common_service

	saved_name = "profile.png"
	(tmp_path / saved_name).write_bytes(b"fake png")
	monkeypatch.setattr(common_service, "UPLOAD_DIR", str(tmp_path))

	with memory_db_session() as db:
		user = User(
			tenant_id=1,
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

		app_main.app.dependency_overrides[get_current_user_for_tenant_media] = lambda: {
			"id": user.id,
			"role": "user",
			"tenantId": 1,
		}
		app_main.app.dependency_overrides[get_db] = _override_db

		try:
			client = TestClient(app_main.app, headers=TENANT_HEADERS)
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
			tenant_id=1,
			user_login_id="profile-owner",
			user_password="hashed",
			user_name="Profile Owner",
			role="user",
			user_profile_image_url=f"/uploads/{saved_name}",
		)
		other = User(
			tenant_id=1,
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

		app_main.app.dependency_overrides[get_current_user_for_tenant_media] = lambda: {
			"id": other.id,
			"role": "user",
			"tenantId": 1,
		}
		app_main.app.dependency_overrides[get_db] = _override_db

		try:
			client = TestClient(app_main.app, headers=TENANT_HEADERS)
			res = client.get(f"/api/common/files/by-saved-name/{saved_name}")
			assert res.status_code == status.HTTP_403_FORBIDDEN
		finally:
			app_main.app.dependency_overrides.clear()


def test_common_download_allows_pdf_only_for_message_receiver():
	from services import common_service

	with memory_db_session() as db:
		admin = User(tenant_id=1, user_login_id="admin", user_password="hashed", user_name="Admin", role="admin")
		receiver = User(tenant_id=1, user_login_id="receiver", user_password="hashed", user_name="Receiver", role="user")
		sender = User(tenant_id=1, user_login_id="sender", user_password="hashed", user_name="Sender", role="user")
		pdf = UploadedFile(
			original_name="salary.pdf",
			saved_name="salary.pdf",
			file_path="/uploads/salary.pdf",
			file_size=8,
			content_type="application/pdf",
		)
		db.add_all([admin, receiver, sender, pdf])
		db.commit()
		for row in (admin, receiver, sender, pdf):
			db.refresh(row)

		message = Message(
			title="급여명세서",
			content="",
			sender_id=sender.id,
			receiver_id=receiver.id,
			is_global=False,
		)
		db.add(message)
		db.flush()
		db.add(MessageAttachment(message_id=message.id, file_id=pdf.id))
		db.commit()

		common_service.assert_user_may_download_uploaded_file(
			db,
			{"id": receiver.id, "role": "user"},
			pdf,
		)
		common_service.assert_user_may_download_uploaded_file(
			db,
			{"userId": receiver.user_login_id, "role": "user"},
			pdf,
		)
		common_service.assert_user_may_download_uploaded_file(
			db,
			{"id": admin.id, "role": "admin"},
			pdf,
		)


def test_common_download_blocks_individual_pdf_for_sender_and_allows_global_pdf_for_user():
	from services import common_service

	with memory_db_session() as db:
		receiver = User(tenant_id=1, user_login_id="receiver", user_password="hashed", user_name="Receiver", role="user")
		sender = User(tenant_id=1, user_login_id="sender", user_password="hashed", user_name="Sender", role="user")
		global_viewer = User(tenant_id=1, user_login_id="viewer", user_password="hashed", user_name="Viewer", role="user")
		individual_pdf = UploadedFile(
			original_name="salary.pdf",
			saved_name="salary.pdf",
			file_path="/uploads/salary.pdf",
			file_size=8,
			content_type="application/pdf",
		)
		global_pdf = UploadedFile(
			original_name="notice.pdf",
			saved_name="notice.pdf",
			file_path="/uploads/notice.pdf",
			file_size=8,
			content_type="application/pdf",
		)
		db.add_all([receiver, sender, global_viewer, individual_pdf, global_pdf])
		db.commit()
		for row in (receiver, sender, global_viewer, individual_pdf, global_pdf):
			db.refresh(row)

		individual_message = Message(
			title="급여명세서",
			content="",
			sender_id=sender.id,
			receiver_id=receiver.id,
			is_global=False,
		)
		global_message = Message(
			title="전체공지",
			content="",
			sender_id=sender.id,
			receiver_id=None,
			is_global=True,
		)
		db.add_all([individual_message, global_message])
		db.flush()
		db.add_all([
			MessageAttachment(message_id=individual_message.id, file_id=individual_pdf.id),
			MessageAttachment(message_id=global_message.id, file_id=global_pdf.id),
		])
		db.commit()

		try:
			common_service.assert_user_may_download_uploaded_file(
				db,
				{"id": sender.id, "role": "user"},
				individual_pdf,
			)
		except HTTPException as exc:
			assert exc.status_code == status.HTTP_403_FORBIDDEN
		else:
			raise AssertionError("개별 PDF 접근 권한이 없는 발신자가 허용되었습니다.")

		common_service.assert_user_may_download_uploaded_file(
			db,
			{"id": global_viewer.id, "role": "user"},
			global_pdf,
		)


def test_legacy_applicant_endpoint_returns_410_when_disabled():
	_stub_tenant = Tenant(id=1, slug="valuesplay", name="Test Tenant", is_active=True)

	async def _override_tenant():
		return _stub_tenant

	app_main.app.dependency_overrides[require_tenant] = _override_tenant
	app_main.app.dependency_overrides[get_current_applicant_for_tenant] = lambda: {
		"applicantId": 1,
		"tenantId": 1,
	}
	prev = settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS
	settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS = False

	try:
		client = TestClient(app_main.app, headers=TENANT_HEADERS)
		res = client.get("/api/public/recruitment/my-applications/1")
		assert res.status_code == status.HTTP_410_GONE
	finally:
		settings.ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS = prev
		app_main.app.dependency_overrides.clear()


def test_public_signup_rejects_admin_role():
	client = TestClient(app_main.app, headers=TENANT_HEADERS)
	res = client.post(
		"/api/auth/signup",
		json={
			"user_login_id": "security_test_no_admin_signup",
			"user_password": "test-pass-1234",
			"user_name": "일반가입테스트",
			"role": "admin",
		},
	)
	assert res.status_code == status.HTTP_400_BAD_REQUEST
	assert "관리자" in str(res.json().get("detail") or "")

