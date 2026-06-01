from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

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
