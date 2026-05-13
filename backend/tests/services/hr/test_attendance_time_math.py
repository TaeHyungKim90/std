"""attendance_time_math 단위 테스트.

자정 넘김 야간 세션: Day1 23:55 ~ Day2 03:55 → 야간 240분(전 구간이 22~06 교집합).
"""

from datetime import date, datetime, time

import pytest

from services.hr.attendance_time_math import (
	BreakTierConfig,
	break_minutes_from_raw,
	effective_work_minutes,
	overlap_night_minutes,
	raw_minutes_between,
	session_minutes_at_clock_out,
)


def _dt(d: date, h: int, m: int = 0) -> datetime:
	return datetime.combine(d, time(h, m))


def test_overlap_night_all_night_cross_midnight():
	d1 = date(2026, 6, 1)
	d2 = date(2026, 6, 2)
	assert overlap_night_minutes(_dt(d1, 23, 55), _dt(d2, 3, 55)) == 240


def test_overlap_night_day_shift_zero():
	d = date(2026, 6, 3)
	assert overlap_night_minutes(_dt(d, 9, 0), _dt(d, 18, 0)) == 0


def test_overlap_night_partial_evening():
	d = date(2026, 6, 4)
	assert overlap_night_minutes(_dt(d, 21, 0), _dt(d, 23, 0)) == 60


def test_overlap_night_reversed_args_symmetric():
	d1 = date(2026, 6, 5)
	d2 = date(2026, 6, 6)
	a, b = _dt(d1, 23, 0), _dt(d2, 2, 0)
	assert overlap_night_minutes(a, b) == overlap_night_minutes(b, a)


@pytest.mark.parametrize(
	("raw", "expected_break"),
	[
		(239, 0),
		(240, 30),
		(479, 30),
		(480, 60),
	],
)
def test_break_minutes_tier_boundaries(raw, expected_break):
	cfg = BreakTierConfig()
	assert break_minutes_from_raw(raw, cfg) == expected_break
	assert effective_work_minutes(raw, cfg) == raw - expected_break


def test_session_minutes_combines_break_and_night():
	d1 = date(2026, 6, 10)
	d2 = date(2026, 6, 11)
	cin = _dt(d1, 23, 55)
	cout = _dt(d2, 3, 55)
	raw = raw_minutes_between(cin, cout)
	assert raw == 240
	w, n = session_minutes_at_clock_out(cin, cout)
	assert n == 240
	assert w == 240 - 30  # tier1 break at raw 240


def test_raw_minutes_none_inputs():
	assert raw_minutes_between(None, datetime.now()) == 0
	assert raw_minutes_between(datetime.now(), None) == 0
