from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from core.config import settings
from core.security import decode_auth_token, get_password_hash, verify_password
from db.session import get_db
from models.platform_models import PlatformAdmin

oauth2_platform_scheme = OAuth2PasswordBearer(tokenUrl="platform/login", auto_error=False)

PLATFORM_SCOPE = "platform"


def authenticate_platform_admin(db: Session, login_id: str, password: str) -> PlatformAdmin:
	row = (
		db.query(PlatformAdmin)
		.filter(PlatformAdmin.login_id == login_id.strip(), PlatformAdmin.is_active.is_(True))
		.first()
	)
	if not row or not verify_password(password, row.password_hash):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="아이디 또는 비밀번호가 틀립니다.",
		)
	return row


async def get_current_platform_admin(
	request: Request,
	token: str | None = Depends(oauth2_platform_scheme),
):
	if not token:
		token = request.cookies.get("platformAccessToken")
	if not token:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="플랫폼 인증 정보가 없습니다.",
		)
	payload = decode_auth_token(token)
	if not payload or payload.get("scope") != PLATFORM_SCOPE:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="유효하지 않거나 만료된 플랫폼 토큰입니다.",
		)
	login_id = payload.get("loginId")
	if not isinstance(login_id, str) or not login_id.strip():
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="플랫폼 인증 정보가 올바르지 않습니다.",
		)
	return payload


def hash_platform_password(password: str) -> str:
	return get_password_hash(password)


def upsert_platform_admin(
	db: Session,
	login_id: str,
	password: str,
	*,
	name: str | None = None,
	force_password: bool = False,
) -> PlatformAdmin:
	"""플랫폼 관리자 생성 또는(옵션) 비밀번호·이름 갱신 — CLI/운영 시드용."""
	login = login_id.strip()
	if not login:
		raise ValueError("login_id는 비어 있을 수 없습니다.")
	if not password:
		raise ValueError("password는 비어 있을 수 없습니다.")

	row = db.query(PlatformAdmin).filter(PlatformAdmin.login_id == login).first()
	if row:
		if force_password:
			row.password_hash = hash_platform_password(password)
		if name is not None:
			row.name = name.strip() or login
		row.is_active = True
		db.commit()
		db.refresh(row)
		return row

	display_name = (name or login).strip() or login
	row = PlatformAdmin(
		login_id=login,
		password_hash=hash_platform_password(password),
		name=display_name,
		is_active=True,
	)
	db.add(row)
	db.commit()
	db.refresh(row)
	return row


def ensure_dev_platform_admin_seeded(db: Session) -> PlatformAdmin | None:
	"""
	개발 환경에서 설정된 PLATFORM_ADMIN_LOGIN_ID 계정이 없으면 자동 생성.
	(다른 테스트 계정만 있어도 padmin 은 추가됨)
	운영(production)에서는 자동 생성하지 않음.
	"""
	if settings.ENVIRONMENT == "production":
		return None

	login_id = (settings.PLATFORM_ADMIN_LOGIN_ID or "padmin").strip()
	password = settings.PLATFORM_ADMIN_PASSWORD or "padmin"
	name = (settings.PLATFORM_ADMIN_NAME or "플랫폼 관리자").strip()

	existing = db.query(PlatformAdmin).filter(PlatformAdmin.login_id == login_id).first()
	if existing is not None:
		return None

	# 예전 기본 ID(platform) 1명만 있을 때 → padmin 으로 이전
	legacy = db.query(PlatformAdmin).filter(PlatformAdmin.login_id == "platform").first()
	if legacy is not None and db.query(PlatformAdmin).count() == 1:
		legacy.login_id = login_id
		legacy.password_hash = hash_platform_password(password)
		legacy.name = name
		legacy.is_active = True
		db.commit()
		db.refresh(legacy)
		print(f"--- 🔄 플랫폼 관리자 ID 변경: platform → {login_id} ---")
		print("--- ✅ /platform/login — 운영 배포 전 반드시 변경 ---")
		return legacy

	row = upsert_platform_admin(db, login_id, password, name=name)
	print(
		f"--- 🛠️ 개발용 플랫폼 관리자 자동 생성: login_id={row.login_id} "
		f"(비밀번호는 .env PLATFORM_ADMIN_PASSWORD 또는 기본값) ---"
	)
	print("--- ✅ /platform/login — 운영 배포 전 반드시 변경 ---")
	return row
