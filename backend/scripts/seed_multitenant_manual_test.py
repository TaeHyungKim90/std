"""
멀티테넌트 수동 테스트 플랜용 로컬 DB 시드.

프로젝트 루트 .env(DATABASE_URL)를 사용합니다.

예 (프로젝트 루트):
  python backend/scripts/seed_multitenant_manual_test.py
"""
from __future__ import annotations

import os
import sys

os.environ.setdefault("PYTHONIOENCODING", "utf-8")

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.normpath(os.path.join(_SCRIPT_DIR, ".."))
_APP_DIR = os.path.join(_BACKEND_ROOT, "app")
_TESTS_DIR = os.path.join(_BACKEND_ROOT, "tests")
for p in (_APP_DIR, _TESTS_DIR):
	if p not in sys.path:
		sys.path.insert(0, p)

from db.session import SessionLocal, init_db  # noqa: E402
from support.multitenant_manual_seed import seed_manual_test_data  # noqa: E402


def main() -> None:
	init_db()
	db = SessionLocal()
	try:
		ctx = seed_manual_test_data(db)
		print("--- 멀티테넌트 수동 테스트 시드 완료 ---")
		print(f"  테넌트 A: {ctx.slug_a} (id={ctx.tid_a})")
		print(f"  테넌트 B: {ctx.slug_b} (id={ctx.tid_b})")
		print(f"  기준일: {ctx.work_date.isoformat()}")
		print("  공통 비밀번호: tests/support/multitenant_manual_seed.py 의 MANUAL_TEST_PASSWORD 참고")
		print("  계정: admin, emp_a, emp_b, shared01 (각 테넌트별 별도 User 행)")
		print("  URL 예:")
		print(f"    http://localhost:3000/{ctx.slug_a}/login")
		print(f"    http://localhost:3000/{ctx.slug_b}/login")
	except Exception as exc:
		db.rollback()
		raise SystemExit(f"시드 실패: {exc}") from exc
	finally:
		db.close()


if __name__ == "__main__":
	main()
