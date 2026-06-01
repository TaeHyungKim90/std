"""API 레이어 공통 의존성 헬퍼."""

from fastapi import HTTPException, status


def tenant_id_from_user(current_user: dict) -> int:
	"""JWT payload에서 tenantId 추출."""
	raw = current_user.get("tenantId")
	if raw is None:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="테넌트 정보가 없는 토큰입니다. 다시 로그인해 주세요.",
		)
	try:
		return int(raw)
	except (TypeError, ValueError):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="테넌트 정보가 올바르지 않습니다.",
		)
