# app/schemas/admin/recruitment_schemas.py
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List
from datetime import date, datetime

# ==========================================
# 1. 채용 공고 (Job Posting) Schemas
# ==========================================
class JobPostingBase(BaseModel):
    title: str = Field(..., example="2026년 상반기 프론트엔드 개발자 채용")
    description: str = Field(..., example="React 기반 인사 관리 시스템 개발 업무...")
    deadline: Optional[date] = None
    status: Optional[str] = "open" # open, closed, draft

class JobPostingCreate(JobPostingBase):
    pass # 관리자가 공고를 생성할 때 사용하는 데이터 (author_id는 토큰에서 추출하므로 생략)

class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[str] = None

class JobPostingResponse(JobPostingBase):
    id: int
    author_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True # SQLAlchemy 모델을 Pydantic 객체로 자동 변환 (orm_mode의 최신 문법)

# ==========================================
# 2. 지원자 계정 (Applicant) Schemas (관리자 조회용)
# ==========================================
class ApplicantResponse(BaseModel):
    id: int
    email_id: str
    name: str
    phone: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# 3. 지원서 내역 (Application) Schemas
# ==========================================
class ApplicationStatusUpdate(BaseModel):
    status: str = Field(..., description="applied, document_passed, interviewing, final_passed, rejected 중 하나")

class ApplicationResponse(BaseModel):
    id: int
    job_id: int
    applicant_id: int
    resume_file_url: str
    portfolio_file_url: Optional[str]
    reference_url: Optional[str]
    status: str
    applied_at: datetime
    
    # 조인(Join)된 정보를 함께 내려주기 위해 포함
    applicant: Optional[ApplicantResponse] = None 

    class Config:
        from_attributes = True

# ==========================================
# 4. 면접 평가 (Interview) Schemas
# ==========================================
class InterviewCreate(BaseModel):
    interview_date: datetime
    score: Optional[int] = Field(None, ge=1, le=5, description="1~5점 척도")
    feedback: Optional[str] = None

class InterviewResponse(BaseModel):
    id: int
    application_id: int
    interviewer_id: Optional[str]
    interview_date: Optional[datetime]
    score: Optional[int]
    feedback: Optional[str]

    class Config:
        from_attributes = True