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
	note: Optional[str] = None
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

	clock_in_time: Optional[str] = Field(None, description="출근 시각 (HH:MM 또는 ISO)")
	clock_out_time: Optional[str] = Field(None, description="퇴근 시각 (HH:MM 또는 ISO)")
	status: Optional[str] = Field(None, description="상태 코드 (NORMAL, LATE, ABSENT, VACATION 등)")


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
