"""테스트에서 KST '오늘'을 고정할 때 사용."""

from __future__ import annotations

from datetime import date, datetime, time

_TODAY_TARGETS = (
	"utils.seoul_time.today_seoul",
	"services.admin.stats_service.today_seoul",
	"services.admin.user_service.today_seoul",
)

_NOW_TARGETS = (
	"utils.seoul_time.now_seoul_naive",
	"utils.seoul_time.now_seoul",
)


def freeze_seoul_today(monkeypatch, fixed: date) -> None:
	"""`from utils.seoul_time import today_seoul` 형태로 가져온 모듈까지 함께 고정."""
	fixed_dt = datetime.combine(fixed, time(12, 0, 0))
	for target in _TODAY_TARGETS:
		monkeypatch.setattr(target, lambda _fixed=fixed: _fixed)
	for target in _NOW_TARGETS:
		monkeypatch.setattr(target, lambda _fixed=fixed_dt: _fixed)
