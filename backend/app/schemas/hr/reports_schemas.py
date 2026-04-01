from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

AdminDailyReportStatusLiteral = Literal["HOLIDAY", "VACATION", "SUBMITTED", "MISSING"]
AdminWeeklyReportStatusLiteral = Literal["HOLIDAY", "VACATION", "SUBMITTED", "MISSING"]


class DailyReportOut(BaseModel):
	id: int
	user_id: str
	report_date: date
	content: str
	created_at: datetime
	updated_at: datetime

	model_config = ConfigDict(from_attributes=True)


class DailyReportUpsert(BaseModel):
	report_date: date
	content: str = Field(..., min_length=1, max_length=50000)


class WeeklyReportOut(BaseModel):
	id: int
	user_id: str
	week_start_date: date
	summary: str
	created_at: datetime
	updated_at: datetime

	model_config = ConfigDict(from_attributes=True)


class WeeklyReportUpsert(BaseModel):
	week_start_date: date
	summary: str = Field(..., min_length=1, max_length=50000)


class AdminDailyStatusRow(BaseModel):
	"""관리자 일일보고 현황(특정 근무일 1일 기준)."""

	user_login_id: str
	user_name: str
	daily_status: AdminDailyReportStatusLiteral


class AdminWeekReportStatusRow(BaseModel):
	"""관리자 주간보고 현황(해당 주 월요일 기준)."""

	user_login_id: str
	user_name: str
	weekly_status: AdminWeeklyReportStatusLiteral = "MISSING"
	weekly_submitted: bool
	weekly_updated_at: Optional[datetime] = None
	weekly_summary_preview: str = ""


class AdminReportBundleOut(BaseModel):
	dailies: list[DailyReportOut]
	weekly: Optional[WeeklyReportOut] = None
