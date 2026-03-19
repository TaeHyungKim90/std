from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

# --- 1. 채용 공고 (Job Posting) ---
class JobPostingBase(BaseModel):
    title: str
    description: str
    deadline: Optional[date] = None
    status: Optional[str] = "open"

class JobPostingCreate(JobPostingBase):
    pass

class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[str] = None

class JobPostingResponse(JobPostingBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# --- 2. 지원자 계정 (Applicant) ---
class ApplicantResponse(BaseModel):
    id: int
    email_id: str
    name: str
    phone: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

# --- 3. 지원서 내역 (Application) ---
class ApplicationStatusUpdate(BaseModel):
    status: str # applied, document_passed, interviewing, final_passed, rejected

class ApplicationResponse(BaseModel):
    id: int
    job_id: int
    applicant_id: int
    resume_file_url: Optional[str] = None
    portfolio_file_url: Optional[str] = None
    reference_url: Optional[str] = None
    status: str
    applied_at: datetime
    # 칸반 보드에서 이름을 보여주기 위해 관계 데이터 포함
    applicant: Optional[ApplicantResponse] = None 

    class Config:
        from_attributes = True

# --- 4. 면접 평가 (Interview) ---
class InterviewCreate(BaseModel):
    interview_date: datetime
    score: Optional[int] = Field(None, ge=1, le=5)
    feedback: Optional[str] = None

class InterviewResponse(InterviewCreate):
    id: int
    application_id: int
    interviewer_id: str
    class Config:
        from_attributes = True