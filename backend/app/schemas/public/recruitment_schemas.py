from pydantic import BaseModel
from typing import Optional, List
from datetime import date

# 1. 일반 지원자가 보는 공고 리스트 응답 포맷 (내부 정보 숨김)
class JobPostingPublicResponse(BaseModel):
    id: int
    title: str
    description: str
    deadline: Optional[date] = None

    class Config:
        from_attributes = True

# 2. 일반 지원자가 폼을 제출할 때 사용하는 포맷
class ApplicationCreate(BaseModel):
    job_id: int
    email_id: str
    password: str
    name: str
    phone: Optional[str] = None
    resume_file_url: str  # 필수
    portfolio_file_url: Optional[str] = None  # 선택