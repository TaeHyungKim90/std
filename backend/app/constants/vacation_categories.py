"""Shared vacation-related constants."""

from enum import Enum


class VacationType(str, Enum):
	ANNUAL_LEAVE = "연차"
	HALF_LEAVE = "반차"
	SICK_LEAVE = "병가"
	VACATION = "휴가"

VACATION_TODO_CATEGORIES = (
	"vacation_full",
	"vacation_am",
	"vacation_pm",
	"vacation_special",
	"vacation_sick",
	"official_leave",
)

# 출근 시 서버 확인 플래그가 필요한 To-Do(종일 연차·공가). 나머지는 차단하지 않음(update.md §2).
VACATION_TODO_REQUIRES_FULL_DAY_CONFIRM = frozenset({"vacation_full"})
VACATION_TODO_REQUIRES_OFFICIAL_LEAVE_CONFIRM = frozenset({"official_leave"})

# 결근 가상행 제외(연차·공가 등 ‘휴무 예정일’). 병가/경조/반차는 별도 규칙으로 처리.
VACATION_TODO_SKIPS_ABSENT_VIRTUAL = frozenset(
	{"vacation_full", "official_leave"}
)

# Categories that affect annual leave balance deductions/refunds.
VACATION_DEDUCTIBLE_CATEGORIES = (
	"vacation_full",
	"vacation_am",
	"vacation_pm",
)

# Categories used for admin vacation stats dashboard.
VACATION_STATS_CATEGORIES = (
	"vacation_full",
	"vacation_am",
	"vacation_pm",
	"vacation_special",
	"vacation_sick",
)

VACATION_STATUS_KEYWORDS = (
	"VACATION",
	"VAC",
	"HALF",
	VacationType.VACATION.value,
	VacationType.ANNUAL_LEAVE.value,
	VacationType.HALF_LEAVE.value,
	VacationType.SICK_LEAVE.value,
)
