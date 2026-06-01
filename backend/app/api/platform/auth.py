from typing import cast

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from core.config import settings
from core.limiter import limiter
from core.security import create_access_token
from db.session import get_db
from schemas.platform_schemas import (
	PlatformLoginRequest,
	PlatformLoginResponse,
	PlatformMeResponse,
)
from services.platform_auth_service import (
	PLATFORM_SCOPE,
	authenticate_platform_admin,
	get_current_platform_admin,
)
from services import tenant_service

router = APIRouter(prefix="/auth", tags=["Platform Auth"])

IS_PROD = settings.ENVIRONMENT == "production"

PLATFORM_COOKIE_OPTIONS = {
	"key": "platformAccessToken",
	"httponly": True,
	"max_age": settings.ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
	"samesite": "lax",
	"secure": IS_PROD,
	"path": "/",
}


@router.post("/login", response_model=PlatformLoginResponse)
@limiter.limit("5/minute")
async def platform_login(
	request: Request,
	data: PlatformLoginRequest,
	response: Response,
	db: Session = Depends(get_db),
):
	admin = authenticate_platform_admin(db, data.login_id, data.password)
	token = create_access_token(
		{
			"scope": PLATFORM_SCOPE,
			"loginId": admin.login_id,
			"name": admin.name,
			"id": cast(int, admin.id),
		}
	)
	response.set_cookie(value=token, **PLATFORM_COOKIE_OPTIONS)
	return PlatformLoginResponse(login_id=cast(str, admin.login_id), name=cast(str, admin.name))


@router.post("/logout")
async def platform_logout(response: Response):
	delete_options = {k: v for k, v in PLATFORM_COOKIE_OPTIONS.items() if k != "max_age"}
	response.delete_cookie(**delete_options)
	return {"success": True, "message": "로그아웃 되었습니다."}


@router.get("/me", response_model=PlatformMeResponse)
async def platform_me(current: dict = Depends(get_current_platform_admin)):
	return PlatformMeResponse(
		isLoggedIn=True,
		login_id=current.get("loginId"),
		name=current.get("name"),
	)
