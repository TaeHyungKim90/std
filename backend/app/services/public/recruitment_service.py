from sqlalchemy.orm import Session
from models import recruitment_models
from schemas.public import recruitment_schemas

def get_public_jobs(db: Session):
    """현재 진행 중(open)인 채용 공고만 가져옵니다."""
    return db.query(recruitment_models.JobPosting).filter(recruitment_models.JobPosting.status == "open").all()

def submit_application(db: Session, data: recruitment_schemas.ApplicationCreate):
    """지원자 계정을 확인/생성하고 지원 내역을 접수합니다."""
    # 1. 지원자 계정 확인
    applicant = db.query(recruitment_models.Applicant).filter(
        recruitment_models.Applicant.email_id == data.email_id
    ).first()

    if not applicant:
        # 새 지원자 계정 생성 (실무에서는 비밀번호 해싱 필수)
        applicant = recruitment_models.Applicant(
            email_id=data.email_id,
            password=data.password, 
            name=data.name,
            phone=data.phone
        )
        db.add(applicant)
        db.flush()

    # 2. 지원 내역 생성
    new_application = recruitment_models.Application(
        job_id=data.job_id,
        applicant_id=applicant.id,
        resume_file_url=data.resume_file_url,
        portfolio_file_url=data.portfolio_file_url,
        status="applied"
    )
    db.add(new_application)
    db.commit()
    db.refresh(new_application)
    
    return {"message": "입사 지원이 완료되었습니다.", "application_id": new_application.id}