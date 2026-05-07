"""한국 표준시(KST, Asia/Seoul) 기준 날짜·시각.

DB 컬럼이 naive DateTime인 경우가 많아, 값은 timezone 정보 없이 KST 시각으로 저장합니다.
JWT 만료 등 글로벌 표준(UTC)이 맞는 부분은 여기서 다루지 않습니다.
"""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

_SEOUL = ZoneInfo("Asia/Seoul")


def now_seoul_naive() -> datetime:
	"""현재 시각을 KST 기준으로 반환합니다(timezone 미부착 naive datetime)."""
	return datetime.now(_SEOUL).replace(tzinfo=None)


def now_seoul() -> datetime:
	"""`now_seoul_naive()`와 동일. 코드베이스에서 선호하는 이름."""
	return now_seoul_naive()


def today_seoul() -> date:
	"""현재 날짜를 KST 기준으로 반환합니다."""
	return datetime.now(_SEOUL).date()
