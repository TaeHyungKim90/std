"""테넌트별 DB 쿼리 스코핑 헬퍼 — 서비스 레이어에서 재사용."""

from fastapi import HTTPException
from sqlalchemy.orm import Query, Session

from models.auth_models import User
from models.holiday_models import Holiday
from models.hr_models import OfficeLocation, TodoCategoryType
from models.recruitment_models import Applicant, JobPosting, ResumeTemplate
from models.system_models import Department, Position, WorkLocation


def users_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(User).filter(User.tenant_id == tenant_id)


def departments_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(Department).filter(Department.tenant_id == tenant_id)


def positions_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(Position).filter(Position.tenant_id == tenant_id)


def work_locations_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(WorkLocation).filter(WorkLocation.tenant_id == tenant_id)


def categories_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(TodoCategoryType).filter(TodoCategoryType.tenant_id == tenant_id)


def holidays_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(Holiday).filter(Holiday.tenant_id == tenant_id)


def job_postings_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(JobPosting).filter(JobPosting.tenant_id == tenant_id)


def applicants_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(Applicant).filter(Applicant.tenant_id == tenant_id)


def resume_templates_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(ResumeTemplate).filter(ResumeTemplate.tenant_id == tenant_id)


def office_locations_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(OfficeLocation).filter(OfficeLocation.tenant_id == tenant_id)


def get_user_by_login_id(db: Session, tenant_id: int, login_id: str) -> User | None:
	return (
		users_in_tenant(db, tenant_id)
		.filter(User.user_login_id == login_id)
		.first()
	)


def require_user_by_login_id(db: Session, tenant_id: int, login_id: str) -> User:
	user = get_user_by_login_id(db, tenant_id, login_id)
	if not user:
		raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
	return user


def get_user_by_pk(db: Session, tenant_id: int, user_pk: int) -> User | None:
	return users_in_tenant(db, tenant_id).filter(User.id == user_pk).first()


def require_user_by_pk(db: Session, tenant_id: int, user_pk: int) -> User:
	user = get_user_by_pk(db, tenant_id, user_pk)
	if not user:
		raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
	return user
