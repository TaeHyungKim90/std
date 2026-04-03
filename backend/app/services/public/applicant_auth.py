from typing import Optional

from fastapi import Request, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from core.security import decode_auth_token

# 지원자 토큰은 쿠키 기반을 기본으로 하되, 확장성을 위해 헤더도 허용(auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="public/recruitment/login", auto_error=False)


def get_applicant_jwt_payload_if_any(request: Request) -> Optional[dict]:
	"""
	Authorization: Bearer → applicantToken 쿠키 순으로 JWT를 읽어 페이로드 반환.
	없거나 만료·불일치면 None (401 없음). GET /me·공개 목록 필터 등에 사용.
	"""
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


async def get_current_applicant(request: Request, token: str | None = Depends(oauth2_scheme)) -> dict:
	"""
	지원자 인증 의존성.
	- 1순위: Authorization: Bearer <token>
	- 2순위: httpOnly 쿠키 applicantToken
	"""
	if not token:
		token = request.cookies.get("applicantToken")
	if not token:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="지원자 인증 정보가 없습니다.")

	payload = decode_auth_token(token)
	if not payload or not payload.get("applicantId"):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않거나 만료된 지원자 토큰입니다.")
	return payload


def try_get_applicant_id(request: Request) -> Optional[int]:
	"""지원자 ID만 조용히 추출. 비로그인·만료 토큰이면 None."""
	payload = get_applicant_jwt_payload_if_any(request)
	if payload is None or payload.get("applicantId") is None:
		return None
	try:
		return int(payload["applicantId"])
	except (TypeError, ValueError):
		return None

