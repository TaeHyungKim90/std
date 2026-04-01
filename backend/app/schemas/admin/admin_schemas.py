from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import date

class AdminStats(BaseModel):
	user_count: int
	vacation_count: int
	category_count: int

class TodayVacation(BaseModel):
	id: int
	user_name: str
	category: str
	start_date: date
	end_date: date

	model_config = ConfigDict(from_attributes=True)

# 2. 대시보드 전체 응답 모델
class DashboardResponse(BaseModel):
	user_count: int
	vacation_count: int
	category_count: int
	today_vacations: List[TodayVacation]