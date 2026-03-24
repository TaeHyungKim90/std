from sqlalchemy.orm import Session
from fastapi import HTTPException
from services.public import recruitment_service
from schemas.public import recruitment_schemas

def get_public_jobs(db: Session):
    try:
        return recruitment_service.get_public_jobs(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"공고 조회 실패: {str(e)}")

def apply_job(db: Session, data: recruitment_schemas.ApplicationCreate):
    try:
        return recruitment_service.submit_application(db, data)
    except ValueError as ve:
        # 🌟 서비스에서 던진 중복 에러를 잡아서 400 에러로 프론트에 전달!
        db.rollback()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"지원서 제출 실패: {str(e)}")

# 🌟 1. 회원가입 컨트롤러
def signup_applicant(db: Session, data: recruitment_schemas.ApplicantSignup):
    try:
        applicant = recruitment_service.signup_applicant(db, data)
        if not applicant:
            raise HTTPException(status_code=400, detail="이미 가입된 이메일 계정입니다.")
        return {"message": "회원가입이 완료되었습니다.", "applicant_id": applicant.id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"회원가입 실패: {str(e)}")

# 🌟 2. 로그인 컨트롤러
def login_applicant(db: Session, data: recruitment_schemas.ApplicantLogin):
    try:
        applicant = recruitment_service.login_applicant(db, data)
        if not applicant:
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 일치하지 않습니다.")
        
        # 프론트엔드의 세션 스토리지에 담길 정보 반환
        return {
            "message": "로그인 성공", 
            "id": applicant.id, 
            "name": applicant.name,
            "email_id": applicant.email_id,
            "phone": applicant.phone
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"로그인 처리 실패: {str(e)}")

# 🌟 3. 정보 수정 컨트롤러
def update_applicant(db: Session, applicant_id: int, data: recruitment_schemas.ApplicantUpdate):
    try:
        applicant = recruitment_service.update_applicant_info(db, applicant_id, data)
        if not applicant:
            raise HTTPException(status_code=404, detail="계정 정보를 찾을 수 없습니다.")
        
        # 수정 후 갱신된 정보를 프론트(세션)로 다시 내려줌
        return {
            "message": "정보가 성공적으로 수정되었습니다.", 
            "id": applicant.id, 
            "name": applicant.name,
            "email_id": applicant.email_id,
            "phone": applicant.phone
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"정보 수정 실패: {str(e)}")

# 🌟 4. 내 지원 내역 조회 컨트롤러
def get_my_applications(db: Session, applicant_id: int):
    try:
        return recruitment_service.get_my_applications(db, applicant_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지원 내역 조회 실패: {str(e)}")

# 🌟 5. 지원 취소 컨트롤러
def cancel_application(db: Session, applicant_id: int, application_id: int):
    try:
        success, msg = recruitment_service.delete_application(db, applicant_id, application_id)
        if not success:
            raise HTTPException(status_code=400, detail=msg)
        return {"message": msg}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"지원 취소 중 오류 발생: {str(e)}")