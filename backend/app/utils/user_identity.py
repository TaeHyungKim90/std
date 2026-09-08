"""사용자 신원(이름·생년월일·전화) 정규화 및 조회 헬퍼."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from models.auth_models import User


def normalize_phone_number(phone: str | None) -> str | None:
	"""하이픈·공백 등 제거 후 숫자만 남긴다. +82 국제번호는 0으로 변환.

	카카오 예: '+82 10-1234-5678' → '01012345678'
	주의: 숫자만 남긴 뒤 11자리로 먼저 자르면 '82101234567'이 되어 매칭이 깨진다.
	"""
	if phone is None:
		return None
	s = str(phone).strip()
	if not s:
		return None
	digits = re.sub(r"[^\d]", "", s)
	# 82 + 국내번호(보통 10자리 → 합 12). 최소 11자 이상일 때만 국가번호로 본다.
	if digits.startswith("82") and len(digits) >= 11:
		digits = "0" + digits[2:]
	return digits or None


def normalize_birth_date(value: Any) -> str | None:
	"""생년월일을 'YYYY-MM-DD' 문자열로 통일. YYYYMMDD / YYYY-MM-DD / date 지원."""
	if value is None:
		return None
	if isinstance(value, datetime):
		return value.date().isoformat()
	if isinstance(value, date):
		return value.isoformat()

	s = str(value).strip()
	if not s:
		return None

	digits = re.sub(r"[^\d]", "", s)
	if len(digits) == 8:
		try:
			parsed = datetime.strptime(digits, "%Y%m%d").date()
			return parsed.isoformat()
		except ValueError:
			return None

	# YYYY-MM-DD 등
	try:
		parsed = datetime.strptime(s[:10], "%Y-%m-%d").date()
		return parsed.isoformat()
	except ValueError:
		pass

	return None


def normalize_user_name(name: str | None) -> str | None:
	if name is None:
		return None
	s = str(name).strip()
	return s or None


def compose_birth_from_year_month_day(
	birthyear: str | None,
	birthday: str | None,
) -> str | None:
	"""카카오/네이버처럼 year + MMDD(또는 MM-DD)를 YYYY-MM-DD로 합친다."""
	year = (str(birthyear).strip() if birthyear is not None else "") or ""
	day_part = (str(birthday).strip() if birthday is not None else "") or ""
	if not year or not day_part:
		return None
	md = re.sub(r"[^\d]", "", day_part)
	if len(md) != 4 or not year.isdigit() or len(year) != 4:
		return None
	return normalize_birth_date(f"{year}{md}")


def find_user_by_identity(
	db: Session,
	*,
	tenant_id: int,
	user_name: str | None,
	birth_date: str | None,
	phone_number: str | None,
) -> User | None:
	"""정규화된 tenant_id + user_name + birth_date + phone 으로 유저 조회."""
	name = normalize_user_name(user_name)
	birth = normalize_birth_date(birth_date)
	phone = normalize_phone_number(phone_number)
	if not name or not birth or not phone:
		return None

	candidates = (
		db.query(User)
		.filter(
			User.tenant_id == tenant_id,
			User.user_name == name,
			User.birth_date.isnot(None),
			User.user_phone_number.isnot(None),
		)
		.all()
	)
	for user in candidates:
		if normalize_birth_date(user.birth_date) == birth and normalize_phone_number(user.user_phone_number) == phone:
			return user
	return None
