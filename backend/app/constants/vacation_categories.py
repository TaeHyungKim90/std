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
