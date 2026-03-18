# app/services/admin/recruitment_service.py
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime

# 모델과 스키마 임포트
from app.models import recruitment_models, auth_models
from app.schemas.admin import recruitment_schemas

# 비밀번호 해싱 함수 재사용
from app.services import auth_service 

# ==========================================
# 1. 채용 공고 관리 (Job Postings)
# ==========================================
def create_job_posting(db: Session, data: recruitment_schemas.JobPostingCreate, author_id: str):
    """새로운 채용 공고를 등록합니다."""
    new_job = recruitment_models.JobPosting(
        title=data.title,
        description=data.description,
        deadline=data.deadline,
        status=data.status,
        author_id=author_id
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

def get_all_job_postings(db: Session):
    """모든 채용 공고를 최신순으로 조회합니다."""
    return db.query(recruitment_models.JobPosting).order_by(recruitment_models.JobPosting.created_at.desc()).all()


# ==========================================
# 2. 지원서 및 전형 상태 관리 (Applications)
# ==========================================
def get_applications_by_job(db: Session, job_id: int):
    """특정 공고에 들어온 지원서 목록을 조회합니다."""
    return db.query(recruitment_models.Application).filter(recruitment_models.Application.job_id == job_id).all()

def update_application_status(db: Session, application_id: int, new_status: str):
    """
    지원자의 전형 상태를 업데이트합니다.
    🔥 상태가 'final_passed'(최종합격)로 변경될 경우, Users 테이블로 데이터를 이관합니다.
    """
    application = db.query(recruitment_models.Application).filter(recruitment_models.Application.id == application_id).first()
    
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지원서를 찾을 수 없습니다.")

    # 상태 업데이트
    application.status = new_status
    
    # 🔄 [핵심 로직] 최종 합격자 자동 마이그레이션
    if new_status == "final_passed":
        applicant = application.applicant
        
        # 사번 생성 규칙: (예) 입사년월일_지원자PK -> 20260318_1
        new_emp_id = f"{datetime.now().strftime('%Y%m%d')}_{applicant.id}"
        
        # 이미 이관된 직원인지 중복 체크
        existing_user = db.query(auth_models.User).filter(auth_models.User.user_login_id == new_emp_id).first()
        
        if not existing_user:
            # 초기 비밀번호는 임시로 사번과 동일하게 설정 (해싱)
            temp_password = auth_service.get_password_hash(new_emp_id)
            
            new_employee = auth_models.User(
                user_login_id=new_emp_id,
                user_password=temp_password,
                user_name=applicant.name,
                user_nickname=f"{applicant.name} 사원", # 기본 닉네임 부여
                role="user",
                join_date=datetime.now().date()
            )
            db.add(new_employee)
            
            # 💡 추후 여기에 연차(UserVacation) 초기 데이터를 세팅하는 로직을 추가할 수 있습니다.

    try:
        db.commit()
        db.refresh(application)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="데이터베이스 처리 중 오류가 발생했습니다.")
        
    return application


# ==========================================
# 3. 면접 평가 관리 (Interviews)
# ==========================================
def create_interview(db: Session, application_id: int, data: recruitment_schemas.InterviewCreate, interviewer_id: str):
    """합격자에 대한 면접 일정 및 평가 결과를 기록합니다."""
    # 지원서가 존재하는지 먼저 확인
    app_exists = db.query(recruitment_models.Application).filter(recruitment_models.Application.id == application_id).first()
    if not app_exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="평가할 지원서를 찾을 수 없습니다.")

    new_interview = recruitment_models.Interview(
        application_id=application_id,
        interviewer_id=interviewer_id,
        interview_date=data.interview_date,
        score=data.score,
        feedback=data.feedback
    )
    db.add(new_interview)
    db.commit()
    db.refresh(new_interview)
    return new_interview