"""사용자 본인 관련 API (/api/users/...)."""

from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from api.auth import (
	KAKAO_CLIENT_ID,
	KAKAO_REDIRECT_URI,
	NAVER_CLIENT_ID,
	NAVER_REDIRECT_URI,
	_create_oauth_state,
	_user_response,
)
from core.tenant import require_tenant, tenant_slug_str
from db.session import get_db
from models.auth_models import User
from models.tenant_models import Tenant
from schemas import auth_schemas
from services import auth_service as service

router = APIRouter()


@router.post("/me/link-social", response_model=auth_schemas.LinkSocialResponse)
def link_or_unlink_social(
	body: auth_schemas.LinkSocialRequest,
	db: Session = Depends(get_db),
	current_user: dict = Depends(service.get_current_user_for_tenant),
	tenant: Tenant = Depends(require_tenant),
):
	"""로그인 상태에서 소셜 계정 연동(OAuth URL 반환) 또는 해제."""
	user_pk = current_user.get("id")
	if user_pk is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 올바르지 않습니다.")

	user = (
		db.query(User)
		.options(
			joinedload(User.vacation),
			joinedload(User.avatar_setting),
			joinedload(User.department),
			joinedload(User.position),
		)
		.filter(User.id == user_pk)
		.first()
	)
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")

	if (user.role or "").strip().lower() == "admin":
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="관리자 계정은 소셜 계정을 연동할 수 없습니다.",
		)

	provider = body.provider
	action = body.action

	if action == "unlink":
		service.unlink_social_provider(db, user, provider=provider)
		db.refresh(user)
		return auth_schemas.LinkSocialResponse(
			success=True,
			message=f"{'카카오' if provider == 'kakao' else '네이버'} 연동이 해제되었습니다.",
			provider=provider,
			action=action,
			linked=service.is_provider_linked(user, provider),
		)

	# action == link → OAuth 시작 URL 반환
	state = _create_oauth_state("link", tenant_slug_str(tenant), link_user_id=user.id)
	if provider == "kakao":
		url = "https://kauth.kakao.com/oauth/authorize?" + urlencode(
			{
				"client_id": KAKAO_CLIENT_ID,
				"redirect_uri": KAKAO_REDIRECT_URI,
				"response_type": "code",
				"state": state,
			}
		)
	else:
		url = "https://nid.naver.com/oauth2.0/authorize?" + urlencode(
			{
				"response_type": "code",
				"client_id": NAVER_CLIENT_ID,
				"redirect_uri": NAVER_REDIRECT_URI,
				"state": state,
			}
		)

	return auth_schemas.LinkSocialResponse(
		success=True,
		message=f"{'카카오' if provider == 'kakao' else '네이버'} 연동 페이지로 이동합니다.",
		provider=provider,
		action=action,
		linked=service.is_provider_linked(user, provider),
		url=url,
	)


@router.get("/me", response_model=auth_schemas.UserResponse)
def get_my_profile_alias(
	db: Session = Depends(get_db),
	current_user: dict = Depends(service.get_current_user_for_tenant),
):
	"""GET /api/auth/me 와 동일 — /api/users/me 별칭."""
	from services.admin.user_service import sync_user_vacation

	user_pk = current_user.get("id")
	if user_pk is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 올바르지 않습니다.")
	user = (
		db.query(User)
		.options(
			joinedload(User.vacation),
			joinedload(User.avatar_setting),
			joinedload(User.department),
			joinedload(User.position),
		)
		.filter(User.id == user_pk)
		.first()
	)
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
	sync_user_vacation(db, user)
	db.commit()
	refreshed = (
		db.query(User)
		.options(
			joinedload(User.vacation),
			joinedload(User.avatar_setting),
			joinedload(User.department),
			joinedload(User.position),
		)
		.filter(User.id == user_pk)
		.first()
	)
	return _user_response(refreshed or user)
