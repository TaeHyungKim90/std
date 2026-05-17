"""근태 세션 단위 순수 시간 계산(야간 교집합·단계 휴게 차감).

서울 달력 기준 naive datetime을 가정합니다(앱 전역 `now_seoul_naive`와 동일).
야간 구간: 각 날짜 D에 대해 [D 22:00, (D+1) 06:00) 과 근무 구간의 교집합 분 합산.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import NamedTuple


class SessionMinutes(NamedTuple):
	"""퇴근 시점에 저장할 분 단위 값."""

	work_minutes: int
	night_work_minutes: int


@dataclass(frozen=True)
class BreakTierConfig:
	"""휴게 단계: raw(출퇴근 간격 분) 기준 차감. PR-0/취업규칙 확정 후 env로 조정."""

	tier1_after_minutes: int = 240  # 4h
	tier1_deduct: int = 30
	tier2_after_minutes: int = 480  # 8h
	tier2_deduct: int = 60


DEFAULT_BREAK_TIERS = BreakTierConfig()

# 급여·연장 합산용(일 8시간 소정) — 추후 설정으로 승격 가능
STANDARD_WORKDAY_MINUTES = 480


def raw_minutes_between(clock_in: datetime | None, clock_out: datetime | None) -> int:
	if clock_in is None or clock_out is None:
		return 0
	delta = clock_out - clock_in
	return max(0, int(delta.total_seconds() // 60))


def break_minutes_from_raw(raw: int, cfg: BreakTierConfig = DEFAULT_BREAK_TIERS) -> int:
	if raw < cfg.tier1_after_minutes:
		return 0
	if raw < cfg.tier2_after_minutes:
		return cfg.tier1_deduct
	return cfg.tier2_deduct


def effective_work_minutes(raw: int, cfg: BreakTierConfig = DEFAULT_BREAK_TIERS) -> int:
	return max(0, raw - break_minutes_from_raw(raw, cfg))


def overlap_night_minutes(clock_in: datetime, clock_out: datetime) -> int:
	"""22:00~익일 06:00(서울 달력일 D 기준) 야간창과 [clock_in, clock_out] 교집합 분 합산."""
	if clock_out < clock_in:
		clock_in, clock_out = clock_out, clock_in
	lo, hi = clock_in, clock_out
	total = 0
	cur_d = lo.date() - timedelta(days=1)
	end_d = hi.date()
	while cur_d <= end_d:
		win_start = datetime.combine(cur_d, time(22, 0))
		win_end = datetime.combine(cur_d + timedelta(days=1), time(6, 0))
		seg_start = max(lo, win_start)
		seg_end = min(hi, win_end)
		if seg_end > seg_start:
			total += int((seg_end - seg_start).total_seconds() // 60)
		cur_d += timedelta(days=1)
	return total


def session_minutes_at_clock_out(
	clock_in: datetime | None,
	clock_out: datetime | None,
	*,
	cfg: BreakTierConfig = DEFAULT_BREAK_TIERS,
) -> SessionMinutes:
	"""퇴근 PATCH/clock-out 공통: 실근무 분(휴게 차감) + 야간 분."""
	raw = raw_minutes_between(clock_in, clock_out)
	work = effective_work_minutes(raw, cfg) if clock_in and clock_out else 0
	night = overlap_night_minutes(clock_in, clock_out) if clock_in and clock_out else 0
	return SessionMinutes(work_minutes=work, night_work_minutes=night)


def day_overtime_from_total_work(total_work_minutes: int, standard_minutes: int = STANDARD_WORKDAY_MINUTES) -> int:
	return max(0, int(total_work_minutes) - int(standard_minutes))


def app_break_tier_config() -> BreakTierConfig:
	"""core.config 설정값으로 휴게 단계 구성(서비스·관리자 재계산 공통)."""
	from core.config import settings

	return BreakTierConfig(
		tier1_after_minutes=int(settings.ATTENDANCE_BREAK_TIER1_THRESHOLD),
		tier1_deduct=int(settings.ATTENDANCE_BREAK_TIER1_MINUTES),
		tier2_after_minutes=int(settings.ATTENDANCE_BREAK_TIER2_THRESHOLD),
		tier2_deduct=int(settings.ATTENDANCE_BREAK_TIER2_MINUTES),
	)
