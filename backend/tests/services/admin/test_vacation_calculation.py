"""연차 발생 일수 계산 단위 테스트."""

from datetime import date

from services.admin.user_service import _calculate_total_vacation, _completed_work_months


def test_completed_work_months_for_recent_hire():
	join_date = date(2026, 1, 2)
	today = date(2026, 6, 8)
	assert _completed_work_months(join_date, today) == 5


def test_total_vacation_under_one_year_is_monthly_accrual():
	join_date = date(2026, 1, 2)
	today = date(2026, 6, 8)
	assert _calculate_total_vacation(join_date, today) == 5


def test_total_vacation_one_year_is_fifteen_days():
	join_date = date(2025, 1, 2)
	today = date(2026, 1, 2)
	assert _calculate_total_vacation(join_date, today) == 15


def test_total_vacation_five_years_is_seventeen_days():
	join_date = date(2021, 1, 2)
	today = date(2026, 6, 8)
	assert _calculate_total_vacation(join_date, today) == 17


def test_total_vacation_before_join_date_is_zero():
	join_date = date(2026, 7, 1)
	today = date(2026, 6, 8)
	assert _calculate_total_vacation(join_date, today) == 0
