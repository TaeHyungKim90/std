from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date, datetime


class AttendanceRequest(BaseModel):
	"""출퇴근 요청: location_name에는 location_key 또는 활성 location_value를 넣을 수 있음(저장은 key)."""

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


class PreferredWorkLocationPatch(BaseModel):
	"""본인 선호 출퇴근 근무장소. 활성 work_locations의 location_key 또는 location_value."""

	location_name: str = Field(..., min_length=1, max_length=120)


class PreferredWorkLocationResponse(BaseModel):
	preferred_work_location: str

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
	night_work_minutes: int = 0
	note: Optional[str]
	shift_status: Optional[str] = None

	model_config = ConfigDict(from_attributes=True)


class AttendanceDailySummaryOut(BaseModel):
	"""동일 근무일 CLOSED 세션 합산."""

	total_work_minutes: int
	overtime_minutes: int
	total_night_minutes: int


class AttendanceDaySessionsResponse(BaseModel):
	"""당일 다회 출근 세션 목록 + 일별 합계."""

	items: list[AttendanceResponse]
	summary: Optional[AttendanceDailySummaryOut] = None


class AttendanceCalendarStampOut(BaseModel):
	"""직원 캘린더 표시용 도장 상태. 점수·순위 정보는 포함하지 않습니다."""

	work_date: date
	stamp_type: str
	label: str
	image_key: str
	has_clock_in: bool
	has_clock_out: bool
	is_vacation: bool
	vacation_label: Optional[str] = None
	clock_in_time: Optional[datetime] = None
	clock_out_time: Optional[datetime] = None


class AttendanceCalendarStampsResponse(BaseModel):
	year: int
	month: int
	items: list[AttendanceCalendarStampOut]


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
	preferred_work_location: Optional[str] = None