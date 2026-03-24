from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from db.session import get_db # 🚨 마스터님의 db경로에 맞게 확인
from schemas.public import recruitment_schemas
from controllers.public import recruitment_controller

router = APIRouter()

# 1. [공개] 진행 중인 채용 공고 리스트 조회
@router.get("/jobs", response_model=List[recruitment_schemas.JobPostingPublicResponse])
def get_public_jobs(db: Session = Depends(get_db)):
    return recruitment_controller.get_public_jobs(db)

# 2. [공개] 입사 지원서 제출
@router.post("/apply")
def submit_application(data: recruitment_schemas.ApplicationCreate, db: Session = Depends(get_db)):
    return recruitment_controller.apply_job(db, data)

# 🌟 3. [공개] 지원자 전용 회원가입
@router.post("/signup")
def signup_applicant(data: recruitment_schemas.ApplicantSignup, db: Session = Depends(get_db)):
    return recruitment_controller.signup_applicant(db, data)

# 🌟 4. [공개] 지원자 전용 로그인
@router.post("/login")
def login_applicant(data: recruitment_schemas.ApplicantLogin, db: Session = Depends(get_db)):
    return recruitment_controller.login_applicant(db, data)

# 🌟 5. [공개] 지원자 정보 수정
@router.put("/update/{applicant_id}")
def update_applicant(applicant_id: int, data: recruitment_schemas.ApplicantUpdate, db: Session = Depends(get_db)):
    return recruitment_controller.update_applicant(db, applicant_id, data)

# 🌟 6. [공개] 내 지원 내역 조회
@router.get("/my-applications/{applicant_id}")
def get_my_applications(applicant_id: int, db: Session = Depends(get_db)):
    return recruitment_controller.get_my_applications(db, applicant_id)

# 🌟 7. [공개] 내 지원 내역 취소 (삭제)
@router.delete("/my-applications/{applicant_id}/{application_id}")
def cancel_application(applicant_id: int, application_id: int, db: Session = Depends(get_db)):
    return recruitment_controller.cancel_application(db, applicant_id, application_id)