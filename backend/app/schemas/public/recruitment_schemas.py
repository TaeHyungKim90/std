from pydantic import BaseModel
from typing import Optional, List
from datetime import date

# 1. 일반 지원자가 보는 공고 리스트 응답 포맷
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
	resume_file_url: str
	portfolio_file_url: Optional[str] = None

# 🌟 3. 지원자 회원가입 포맷 (추가)
class ApplicantSignup(BaseModel):
	email_id: str
	password: str
	name: str
	phone: str

# 🌟 4. 지원자 로그인 포맷 (추가)
class ApplicantLogin(BaseModel):
	email_id: str
	password: str

# 🌟 5. 지원자 정보 수정 포맷
class ApplicantUpdate(BaseModel):
	name: str
	phone: str
	password: Optional[str] = None