"""
플랫폼 관리자(platform_admins) 계정 생성·비밀번호 갱신.

프로젝트 루트 .env(DATABASE_URL, SECRET_KEY 등)를 읽습니다.

예 (프로젝트 루트):
  uv run --project backend python backend/scripts/create_platform_admin.py --login-id ops --name "운영자"

비밀번호는 --password 또는 프롬프트(입력 내용은 화면에 표시되지 않음).
기존 login_id가 있으면 기본적으로 건너뜀. 비밀번호만 바꿀 때:
  uv run --project backend python backend/scripts/create_platform_admin.py --login-id ops --force-password
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.normpath(os.path.join(_SCRIPT_DIR, ".."))
_APP_DIR = os.path.join(_BACKEND_ROOT, "app")
if _APP_DIR not in sys.path:
	sys.path.insert(0, _APP_DIR)


def main() -> None:
	parser = argparse.ArgumentParser(description="플랫폼 관리자 계정 생성/갱신")
	parser.add_argument("--login-id", required=True, help="로그인 ID")
	parser.add_argument("--password", default=None, help="비밀번호(미지정 시 프롬프트)")
	parser.add_argument("--name", default=None, help="표시 이름(기본: login-id)")
	parser.add_argument(
		"--force-password",
		action="store_true",
		help="이미 존재하는 계정의 비밀번호·이름 갱신",
	)
	args = parser.parse_args()

	password = args.password
	if not password:
		password = getpass.getpass("비밀번호: ")
		confirm = getpass.getpass("비밀번호 확인: ")
		if password != confirm:
			print("비밀번호가 일치하지 않습니다.", file=sys.stderr)
			sys.exit(1)
	if not password:
		print("비밀번호가 필요합니다.", file=sys.stderr)
		sys.exit(1)

	import db.base  # noqa: F401

	from db.session import SessionLocal
	from models.platform_models import PlatformAdmin
	from services.platform_auth_service import upsert_platform_admin

	db = SessionLocal()
	try:
		existing = (
			db.query(PlatformAdmin)
			.filter(PlatformAdmin.login_id == args.login_id.strip())
			.first()
		)
		if existing and not args.force_password:
			print(
				f"이미 존재하는 플랫폼 관리자입니다: {existing.login_id}\n"
				"비밀번호 갱신: --force-password",
				file=sys.stderr,
			)
			sys.exit(2)

		row = upsert_platform_admin(
			db,
			args.login_id,
			password,
			name=args.name,
			force_password=args.force_password or existing is not None,
		)
		action = "갱신" if existing else "생성"
		print(f"플랫폼 관리자 {action} 완료: login_id={row.login_id}, name={row.name}")
	except ValueError as exc:
		print(str(exc), file=sys.stderr)
		sys.exit(1)
	finally:
		db.close()


if __name__ == "__main__":
	main()
