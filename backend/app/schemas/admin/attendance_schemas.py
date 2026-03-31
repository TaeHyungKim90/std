from pydantic import BaseModel, Field
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

	class Config:
		from_attributes = True


class AdminAttendanceRangeResponse(BaseModel):
	items: List[AdminAttendanceRecordOut]


class AdminAttendanceUpdate(BaseModel):
	"""관리자 근태 수정. 전달된 필드만 갱신(부분 수정). clock_* 는 'HH:MM' 또는 ISO datetime 문자열."""

	clock_in_time: Optional[str] = Field(None, description="출근 시각 (HH:MM 또는 ISO)")
	clock_out_time: Optional[str] = Field(None, description="퇴근 시각 (HH:MM 또는 ISO)")
	status: Optional[str] = Field(None, description="상태 코드 (NORMAL, LATE, ABSENT, VACATION 등)")
