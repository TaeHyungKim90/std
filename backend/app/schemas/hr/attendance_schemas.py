from pydantic import BaseModel, ConfigDict
from typing import	Optional
from datetime import date, datetime
#출퇴근
# 출퇴근 공통 요청 형식
class AttendanceRequest(BaseModel):
	location_name: str	# "본사", "재택", "출장" 등 (Select 박스 값)
	latitude: float		# 사용자 현재 위도
	longitude: float	# 사용자 현재 경도
	note: Optional[str] = None

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