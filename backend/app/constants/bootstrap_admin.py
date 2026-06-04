"""테넌트 부트스트랩 운영자(admin) — HR 직원 레코드가 아님."""

BOOTSTRAP_ADMIN_LOGIN_ID = "admin"


def is_bootstrap_system_admin(user) -> bool:
	"""테넌트 시드·플랫폼 생성 시 고정되는 운영용 admin 계정 여부."""
	return str(getattr(user, "user_login_id", "") or "").strip() == BOOTSTRAP_ADMIN_LOGIN_ID
