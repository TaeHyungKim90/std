from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import date, datetime


class AdminAttendanceRecordOut(BaseModel):
	id: int
	user_id: str
	work_date: date
	clock_in_time: Optional[datetime] = None
	clock_out_time: Optional[datetime] = None
	clock_in_location: Optional[str] = None
	clock_out_location: Optional[str] = None
	status: Optional[str] = None
	work_minutes: Optional[int] = None
	night_work_minutes: Optional[int] = None
	note: Optional[str] = None
	shift_status: Optional[str] = None
	vacation_todo_summary: Optional[str] = None
	half_day_type: Optional[str] = None
	review_hint: Optional[str] = None
	is_weekend: bool = False
	is_public_holiday: bool = False
	holiday_name: Optional[str] = None

	model_config = ConfigDict(from_attributes=True)


class AdminAttendanceRangeResponse(BaseModel):
	items: List[AdminAttendanceRecordOut]


class AdminAttendanceUpdate(BaseModel):
	"""관리자 근태 수정. 전달된 필드만 갱신(부분 수정). clock_* 는 'HH:MM' 또는 ISO datetime 문자열."""

	clock_in_time: Optional[str] = Field(
		None, description="출근 일시: HH:MM(근무일 벽시계) 또는 ISO datetime (예: datetime-local)"
	)
	clock_out_time: Optional[str] = Field(
		None, description="퇴근 일시: HH:MM 또는 ISO datetime (예: datetime-local)"
	)
	status: Optional[str] = Field(None, description="상태 코드 (NORMAL, LATE, ABSENT, VACATION 등)")


class AdminAttendanceCreate(BaseModel):
	"""관리자: 해당 근무일에 실제 행이 없을 때(가상 결근 등) 근태 1건 생성."""

	user_login_id: str = Field(..., min_length=1, description="직원 로그인 ID")
	work_date: date = Field(..., description="근무일 YYYY-MM-DD")
	clock_in_time: Optional[str] = Field(
		None, description="출근 일시: HH:MM 또는 ISO datetime (예: datetime-local)"
	)
	clock_out_time: Optional[str] = Field(
		None, description="퇴근 일시: HH:MM 또는 ISO datetime (예: datetime-local)"
	)
	status: Optional[str] = Field(None, description="상태 코드 (미입력 시 NORMAL)")


class AdminAttendanceRecomputeChange(BaseModel):
	record_id: int
	user_id: str
	work_date: date
	old_work_minutes: int
	new_work_minutes: int


class AdminAttendanceRecomputeResponse(BaseModel):
	"""출·퇴근 시각 기준 work_minutes 일괄 재계산 결과(잘못 저장된 분 단위 정정용)."""

	dry_run: bool
	examined: int
	updated: int
	unchanged: int
	changes: List[AdminAttendanceRecomputeChange] = Field(default_factory=list)


class AdminAttendanceRewardPointsPolicy(BaseModel):
	attendance_complete: int
	vacation: int


class AdminAttendanceRewardItem(BaseModel):
	rank: int
	user_id: str
	user_name: str
	score: int
	attendance_completed_days: int
	vacation_days: int
	longest_streak_days: int
	eligible_days: int
	coupon_target: bool


class AdminAttendanceMonthlyRewardsResponse(BaseModel):
	year: int
	month: int
	generated_at: datetime
	points_policy: AdminAttendanceRewardPointsPolicy
	winner: Optional[AdminAttendanceRewardItem] = None
	items: List[AdminAttendanceRewardItem] = Field(default_factory=list)
