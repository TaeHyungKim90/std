from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from models import recruitment_models, auth_models
from schemas.admin import recruitment_schemas
from services import auth_service 

# --- 1. 채용 공고 관리 ---
def create_job_posting(db: Session, data: recruitment_schemas.JobPostingCreate, author_id: str):
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

def get_all_job_postings(db: Session, skip: int = 0, limit: int = 20):
	q = db.query(recruitment_models.JobPosting).order_by(recruitment_models.JobPosting.created_at.desc())
	total = q.count()
	items = q.offset(skip).limit(limit).all()
	return {"items": items, "total": total}

def update_job_posting(db: Session, job_id: int, data: recruitment_schemas.JobPostingUpdate):
	job = db.query(recruitment_models.JobPosting).filter(recruitment_models.JobPosting.id == job_id).first()
	if not job:
		raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
	for key, value in data.model_dump(exclude_unset=True).items():
		setattr(job, key, value)
	db.commit()
	db.refresh(job)
	return job

def delete_job_posting(db: Session, job_id: int):
	job = db.query(recruitment_models.JobPosting).filter(recruitment_models.JobPosting.id == job_id).first()
	if not job:
		raise HTTPException(status_code=404, detail="공고를 찾을 수 없습니다.")
	db.delete(job)
	db.commit()
	return {"message": "삭제 완료"}

# --- 2. 지원자 현황 및 상태 변경 (칸반 로직) ---
def get_applications_by_job(db: Session, job_id: int):
	return db.query(recruitment_models.Application)\
			 .filter(recruitment_models.Application.job_id == job_id)\
			 .all()

def update_application_status(db: Session, application_id: int, status_str: str):
	application = db.query(recruitment_models.Application).filter(recruitment_models.Application.id == application_id).first()
	if not application:
		raise HTTPException(status_code=404, detail="지원 내역을 찾을 수 없습니다.")

	application.status = status_str

	# 🔥 최종 합격(final_passed) 시 임직원으로 자동 등록
	if status_str == "final_passed":
		applicant = application.applicant
		# 이미 등록된 유저인지 체크
		existing_user = db.query(auth_models.User).filter(auth_models.User.user_login_id == applicant.email_id).first()
		if not existing_user:
			new_employee = auth_models.User(
				user_login_id=applicant.email_id,
				user_password=applicant.password, # 지원 시 사용한 비밀번호 계승
				user_name=applicant.name,
				user_nickname=f"{applicant.name} 사원",
				role="user",
				join_date=datetime.now().date()
			)
			db.add(new_employee)

	db.commit()
	db.refresh(application)
	return application

# --- 3. 면접 평가 기록 ---
def create_interview(db: Session, application_id: int, data: recruitment_schemas.InterviewCreate, interviewer_id: str):
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