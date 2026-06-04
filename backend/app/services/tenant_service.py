from typing import cast

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.config import settings
from core.security import get_password_hash
from core.tenant import normalize_tenant_slug, validate_tenant_slug_format
from db.session import _seed_tenant_defaults
from models.auth_models import User
from models.common_models import AuditLog
from models.hr_models import (
	Attendance,
	AttendanceDailySummary,
	DailyReport,
	MonthlyReport,
	Todo,
	WeeklyReport,
)
from models.message_models import Message
from models.tenant_models import Tenant
from schemas.platform_schemas import TenantCreateRequest, TenantUpdateRequest

BOOTSTRAP_ADMIN_LOGIN_ID = "admin"


def _upsert_bootstrap_admin(db: Session, tenant_id: int, password: str) -> None:
	"""테넌트 HR 부트스트랩 관리자(admin) — 로그인 ID 고정."""
	pw = (password or "").strip()
	if not pw:
		return
	admin = (
		db.query(User)
		.filter(User.user_login_id == BOOTSTRAP_ADMIN_LOGIN_ID, User.tenant_id == tenant_id)
		.first()
	)
	if admin:
		admin.user_password = get_password_hash(pw)
		admin.must_change_password = True
		admin.visible_in_user_list = False
		admin.role = "admin"
	else:
		db.add(
			User(
				tenant_id=tenant_id,
				user_login_id=BOOTSTRAP_ADMIN_LOGIN_ID,
				user_password=get_password_hash(pw),
				user_name="관리자",
				user_nickname="관리자",
				role="admin",
				must_change_password=True,
				visible_in_user_list=False,
			)
		)


def list_active_tenants(db: Session) -> list[Tenant]:
	return db.query(Tenant).filter(Tenant.is_active.is_(True)).order_by(Tenant.slug).all()


def list_all_tenants(db: Session) -> list[Tenant]:
	return db.query(Tenant).order_by(Tenant.id.desc()).all()


def get_tenant_or_none(db: Session, slug: str) -> Tenant | None:
	return (
		db.query(Tenant)
		.filter(Tenant.slug == slug.strip().lower(), Tenant.is_active.is_(True))
		.first()
	)


def get_tenant_by_id(db: Session, tenant_id: int) -> Tenant | None:
	return db.query(Tenant).filter(Tenant.id == tenant_id).first()


def require_tenant_by_id(db: Session, tenant_id: int) -> Tenant:
	tenant = get_tenant_by_id(db, tenant_id)
	if not tenant:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="테넌트를 찾을 수 없습니다.")
	return tenant


def create_tenant(db: Session, payload: TenantCreateRequest) -> Tenant:
	slug = normalize_tenant_slug(payload.slug)
	if not slug:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="테넌트 slug가 올바르지 않습니다.")
	validate_tenant_slug_format(slug)
	if db.query(Tenant).filter(Tenant.slug == slug).first():
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 slug입니다.")

	name = payload.name.strip()
	if not name:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="기업명을 입력해 주세요.")

	tenant = Tenant(slug=slug, name=name, is_active=True)
	db.add(tenant)
	try:
		db.flush()
	except IntegrityError:
		db.rollback()
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 사용 중인 slug입니다.")

	tid = cast(int, tenant.id)
	_seed_tenant_defaults(db, tid)

	custom_login = (payload.bootstrap_admin_login_id or "").strip()
	if custom_login and custom_login != BOOTSTRAP_ADMIN_LOGIN_ID:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"초기 관리자 ID는 '{BOOTSTRAP_ADMIN_LOGIN_ID}'만 사용할 수 있습니다.",
		)
	if payload.bootstrap_admin_password:
		_upsert_bootstrap_admin(db, tid, payload.bootstrap_admin_password)

	try:
		db.commit()
	except IntegrityError as exc:
		db.rollback()
		raw = str(getattr(exc, "orig", exc) or exc).lower()
		if "user_login_id" in raw:
			detail = "이미 다른 테넌트와 충돌하는 관리자 ID 제약이 있습니다. 백엔드를 재시작해 DB 마이그레이션을 적용한 뒤 다시 시도해 주세요."
		elif "category_key" in raw or "todo_category" in raw:
			detail = "카테고리 시드 제약 오류입니다. 백엔드를 재시작해 DB 마이그레이션을 적용한 뒤 다시 시도해 주세요."
		elif "location_key" in raw or "location_value" in raw:
			detail = "근무장소 시드 제약 오류입니다. 백엔드를 재시작해 DB 마이그레이션을 적용한 뒤 다시 시도해 주세요."
		else:
			detail = "테넌트 생성 중 데이터 제약이 발생했습니다. 백엔드를 재시작한 뒤 다시 시도해 주세요."
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from None
	db.refresh(tenant)
	return tenant


def update_tenant(db: Session, tenant_id: int, payload: TenantUpdateRequest) -> Tenant:
	tenant = require_tenant_by_id(db, tenant_id)
	slug = cast(str, tenant.slug)
	data = payload.model_dump(exclude_unset=True)
	if "name" in data:
		name = (data["name"] or "").strip()
		if not name:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="기업명을 입력해 주세요.")
		tenant.name = name
	if "is_active" in data and data["is_active"] is not None:
		if slug == settings.DEFAULT_TENANT_SLUG:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail=f"기본 테넌트({slug})의 활성 상태는 변경할 수 없습니다.",
			)
		tenant.is_active = bool(data["is_active"])
	if "bootstrap_admin_password" in data and data["bootstrap_admin_password"]:
		_upsert_bootstrap_admin(db, cast(int, tenant.id), data["bootstrap_admin_password"])
	db.commit()
	db.refresh(tenant)
	return tenant


def delete_tenant(db: Session, tenant_id: int) -> dict[str, str]:
	"""테넌트 및 소속 데이터 영구 삭제(복구 불가). 기본 테넌트는 보호."""
	tenant = require_tenant_by_id(db, tenant_id)
	slug = cast(str, tenant.slug)
	if slug == settings.DEFAULT_TENANT_SLUG:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"기본 테넌트({slug})는 삭제할 수 없습니다.",
		)

	tid = tenant_id
	users = db.query(User).filter(User.tenant_id == tid).all()
	user_pks = [cast(int, u.id) for u in users]
	user_logins = [cast(str, u.user_login_id) for u in users]

	try:
		if user_pks:
			db.query(Message).filter(
				or_(Message.sender_id.in_(user_pks), Message.receiver_id.in_(user_pks))
			).delete(synchronize_session=False)
			db.query(AuditLog).filter(
				or_(AuditLog.admin_id.in_(user_pks), AuditLog.target_user_id.in_(user_pks))
			).delete(synchronize_session=False)

		if user_logins:
			for model in (
				Todo,
				Attendance,
				AttendanceDailySummary,
				DailyReport,
				WeeklyReport,
				MonthlyReport,
			):
				db.query(model).filter(model.user_id.in_(user_logins)).delete(synchronize_session=False)

		for user in users:
			db.delete(user)

		from services.tenant_branding_service import remove_tenant_branding_files

		db.delete(tenant)
		db.commit()
		remove_tenant_branding_files(tid)
	except IntegrityError:
		db.rollback()
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="연결된 데이터가 남아 있어 삭제할 수 없습니다. 먼저 비활성화하거나 데이터를 정리해 주세요.",
		) from None

	return {"status": "success", "message": f"테넌트 '{slug}'가 삭제되었습니다."}
