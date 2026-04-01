from sqlalchemy.orm import Session

from models.common_models import AuditLog


def create_audit_log(
	db: Session,
	admin_id: int,
	target_user_id: int,
	action: str,
	endpoint: str,
	ip_address: str | None = None,
) -> None:
	"""감사 로그 생성.

	메인 로직에 영향을 주지 않도록 예외는 모두 삼키고(pass) 종료합니다.
	"""
	try:
		row = AuditLog(
			admin_id=admin_id,
			target_user_id=target_user_id,
			action=action,
			endpoint=endpoint,
			ip_address=ip_address,
		)
		db.add(row)
		db.commit()
	except Exception as e:
		try:
			db.rollback()
		except Exception:
			pass
		# 운영 로깅 시스템이 없으므로 최소한의 콘솔 로깅만 수행
		print(f"[audit] failed to write audit log: {e}")
		return

