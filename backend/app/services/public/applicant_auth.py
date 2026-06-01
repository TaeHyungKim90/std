from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from core.security import decode_auth_token
from core.tenant import assert_token_tenant_matches, require_tenant
from models.tenant_models import Tenant

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="public/recruitment/login", auto_error=False)


def get_applicant_jwt_payload_if_any(request: Request) -> Optional[dict]:
	auth = (request.headers.get("Authorization") or "").strip()
	token: str | None = None
	if auth.lower().startswith("bearer "):
		token = auth[7:].strip() or None
	if not token:
		token = request.cookies.get("applicantToken")
	if not token:
		return None
	payload = decode_auth_token(token)
	if not payload or not payload.get("applicantId"):
		return None
	return payload


async def get_current_applicant(
	request: Request, token: str | None = Depends(oauth2_scheme)
) -> dict:
	if not token:
		token = request.cookies.get("applicantToken")
	if not token:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="지원자 인증 정보가 없습니다.")

	payload = decode_auth_token(token)
	if not payload or not payload.get("applicantId"):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="유효하지 않거나 만료된 지원자 토큰입니다.",
		)
	return payload


async def get_current_applicant_for_tenant(
	request: Request,
	token: str | None = Depends(oauth2_scheme),
	tenant: Tenant = Depends(require_tenant),
) -> dict:
	payload = await get_current_applicant(request, token)
	assert_token_tenant_matches(payload, tenant)
	return payload


def try_get_applicant_id(request: Request) -> Optional[int]:
	payload = get_applicant_jwt_payload_if_any(request)
	if payload is None or payload.get("applicantId") is None:
		return None
	try:
		return int(payload["applicantId"])
	except (TypeError, ValueError):
		return None
