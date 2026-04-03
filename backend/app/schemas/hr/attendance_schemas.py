from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date, datetime


class AttendanceRequest(BaseModel):
	location_name: str
	latitude: float
	longitude: float
	note: Optional[str] = None
	confirm_full_day_vacation: bool = Field(
		default=False,
		description="종일 연차(휴가) 일정이 있을 때 출근 확인에 동의한 경우 true",
	)
	confirm_official_leave: bool = Field(
		default=False,
		description="공가 일정이 있을 때 출근 기록 등록 확인에 동의한 경우 true",
	)

class AttendanceResponse(BaseModel):
	id: int
	user_id: str
	work_date: date
	clock_in_time: Optional[datetime]
	clock_out_time: Optional[datetime]
	clock_in_location: Optional[str]
	clock_out_location: Optional[str]
	status: str
	work_minutes: int
	note: Optional[str]

	model_config = ConfigDict(from_attributes=True)


class AttendanceClockContextResponse(BaseModel):
	"""출퇴근 버튼·확인 팝업 분기용(당일 또는 지정일)."""

	work_date: date
	requires_full_day_vacation_confirm: bool
	requires_official_leave_confirm: bool
	has_half_day_vacation: bool
	has_sick_or_special_vacation: bool
	is_weekend: bool
	is_public_holiday: bool
	holiday_name: Optional[str] = None