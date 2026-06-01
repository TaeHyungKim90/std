from typing import cast

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.security import get_password_hash
from core.tenant import normalize_tenant_slug, validate_tenant_slug_format
from db.session import _seed_tenant_defaults
from models.auth_models import User
from models.tenant_models import Tenant
from schemas.platform_schemas import TenantCreateRequest, TenantUpdateRequest


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

	admin_login = (payload.bootstrap_admin_login_id or "").strip()
	admin_pw = payload.bootstrap_admin_password or ""
	if admin_login and admin_pw:
		existing = (
			db.query(User)
			.filter(User.user_login_id == admin_login, User.tenant_id == tid)
			.first()
		)
		if not existing:
			db.add(
				User(
					tenant_id=tid,
					user_login_id=admin_login,
					user_password=get_password_hash(admin_pw),
					user_name="관리자",
					user_nickname="관리자",
					role="admin",
				)
			)

	db.commit()
	db.refresh(tenant)
	return tenant


def update_tenant(db: Session, tenant_id: int, payload: TenantUpdateRequest) -> Tenant:
	tenant = require_tenant_by_id(db, tenant_id)
	data = payload.model_dump(exclude_unset=True)
	if "name" in data:
		name = (data["name"] or "").strip()
		if not name:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="기업명을 입력해 주세요.")
		tenant.name = name
	if "is_active" in data and data["is_active"] is not None:
		tenant.is_active = bool(data["is_active"])
	db.commit()
	db.refresh(tenant)
	return tenant
