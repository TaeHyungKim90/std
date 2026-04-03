"""
출·퇴근 시각으로 work_minutes 일괄 재계산 (과거 오계산 정정).

실행 예 (백엔드 폴더에서, app이 PYTHONPATH에 있어야 함):
  cd backend
  set PYTHONPATH=app
  python scripts/recompute_attendance_work_minutes.py --start 2025-01-01 --end 2025-12-31

실제 반영:
  python scripts/recompute_attendance_work_minutes.py --start 2025-01-01 --end 2025-12-31 --apply

특정 직원만:
  python scripts/recompute_attendance_work_minutes.py --start 2025-01-01 --end 2025-01-31 --user employee01
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# backend/app 을 import 경로에 추가
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.normpath(os.path.join(_SCRIPT_DIR, ".."))
_APP_DIR = os.path.join(_BACKEND_ROOT, "app")
if _APP_DIR not in sys.path:
	sys.path.insert(0, _APP_DIR)


def main() -> None:
	parser = argparse.ArgumentParser(description="근태 work_minutes 재계산 (dry-run 기본)")
	parser.add_argument("--start", required=True, help="시작일 YYYY-MM-DD")
	parser.add_argument("--end", required=True, help="종료일 YYYY-MM-DD")
	parser.add_argument("--user", default=None, help="직원 user_login_id (선택)")
	parser.add_argument(
		"--apply",
		action="store_true",
		help="지정 시 DB에 반영. 미지정이면 dry-run만",
	)
	args = parser.parse_args()

	import db.base  # noqa: F401 — ORM 베이스 로드
	from models.system_models import Department, Position  # noqa: F401 — User.department/position 관계

	from db.session import SessionLocal
	from services.admin.attendance_service import recompute_work_minutes_bulk

	db = SessionLocal()
	try:
		result = recompute_work_minutes_bulk(
			db,
			args.start,
			args.end,
			user_login_id=args.user,
			dry_run=not args.apply,
		)
		print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
	finally:
		db.close()


if __name__ == "__main__":
	main()
