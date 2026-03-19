from datetime import date, datetime


from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# --- 1. 외부 지원자용 테이블 (Applicants) ---
class Applicant(Base):
    __tablename__ = "applicants"

    id = Column[int](Integer, primary_key=True, index=True)
    email_id = Column[str](String(100), unique=True, nullable=False, index=True) # 지원자 로그인용 아이디 (이메일)
    password = Column[str](String(255), nullable=False) # 해싱된 비밀번호
    name = Column[str](String(50), nullable=False)
    phone = Column[str](String(20), nullable=True)
    created_at = Column[datetime](DateTime, server_default=func.now())

    # 관계 설정: 한 명의 지원자가 여러 공고에 지원할 수 있음
    applications = relationship("Application", back_populates="applicant", cascade="all, delete")


# --- 2. 채용 공고 테이블 (Job Postings) ---
class JobPosting(Base):
    __tablename__ = "job_postings"

    id = Column[int](Integer, primary_key=True, index=True)
    title = Column[str](String(100), nullable=False)
    description = Column[str](Text, nullable=False)
    status = Column[str](String(20), default="open") # open(진행중), closed(마감), draft(임시저장)
    deadline = Column[date](Date, nullable=True)
    # 내부 직원/관리자 테이블(users)과 연결
    author_id = Column[str](String(50), ForeignKey("users.user_login_id", ondelete="SET NULL")) 
    created_at = Column[datetime](DateTime, server_default=func.now())

    # 관계 설정: 하나의 공고에 여러 지원서가 접수됨
    applications = relationship("Application", back_populates="job_posting", cascade="all, delete")


# --- 3. 지원서 제출 내역 테이블 (Applications) ---
class Application(Base):
    __tablename__ = "applications"

    id = Column[int](Integer, primary_key=True, index=True)
    job_id = Column[int](Integer, ForeignKey("job_postings.id", ondelete="CASCADE"))
    applicant_id = Column[int](Integer, ForeignKey("applicants.id", ondelete="CASCADE"))
    
    # 첨부 항목 (물리적 파일 경로와 URL을 명확히 분리)
    resume_file_url = Column[str](String(255), nullable=True)    # 이력서 파일 경로 (필수)
    portfolio_file_url = Column[str](String(255), nullable=True)  # 포트폴리오 파일 경로 (선택)
    reference_url = Column[str](String(500), nullable=True)       # GitHub/Notion 등 URL (선택)
    
    # 전형 상태: applied(서류접수), document_passed(서류합격), interviewing(면접중), final_passed(최종합격), rejected(불합격)
    status = Column[str](String(30), default="applied") 
    applied_at = Column[datetime](DateTime, server_default=func.now())

    # 관계 설정
    job_posting = relationship("JobPosting", back_populates="applications")
    applicant = relationship("Applicant", back_populates="applications")
    interviews = relationship("Interview", back_populates="application", cascade="all, delete")


# --- 4. 면접 평가 테이블 (Interviews) ---
class Interview(Base):
    __tablename__ = "interviews"

    id = Column[int](Integer, primary_key=True, index=True)
    application_id = Column[int](Integer, ForeignKey("applications.id", ondelete="CASCADE"))
    
    # 면접관은 내부 직원(users)이므로 users 테이블과 연결
    interviewer_id = Column[str](String(50), ForeignKey("users.user_login_id", ondelete="SET NULL")) 
    
    interview_date = Column[datetime](DateTime, nullable=True)
    score = Column[int](Integer, nullable=True) # 평가 점수 (예: 1~5점)
    feedback = Column[str](Text, nullable=True) # 면접관 정성 평가 코멘트

    # 관계 설정
    application = relationship("Application", back_populates="interviews")