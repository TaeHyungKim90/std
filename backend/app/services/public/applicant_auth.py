from fastapi import Request, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from core.security import decode_auth_token

# 지원자 토큰은 쿠키 기반을 기본으로 하되, 확장성을 위해 헤더도 허용(auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="public/recruitment/login", auto_error=False)


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

