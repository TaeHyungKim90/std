"""테넌트별 DB 쿼리 스코핑 헬퍼 — 서비스 레이어에서 재사용."""

from typing import cast

from fastapi import HTTPException
from sqlalchemy.orm import Query, Session

from models.auth_models import User
from models.holiday_models import Holiday
from models.auth_models import UserVacation
from models.hr_models import (
	Attendance,
	AttendanceDailySummary,
	DailyReport,
	MonthlyReport,
	OfficeLocation,
	Todo,
	TodoConfig,
	TodoCategoryType,
	WeeklyReport,
)
from models.recruitment_models import Applicant, JobPosting, ResumeTemplate
from models.system_models import Department, Position, WorkLocation


def users_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(User).filter(User.tenant_id == tenant_id)


def directory_users_in_tenant(db: Session, tenant_id: int) -> Query:
	"""직원 목록·보고 현황 등 UI 디렉터리용(부트스트랩 system admin 제외)."""
	return users_in_tenant(db, tenant_id).filter(User.visible_in_user_list.is_(True))


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


def login_ids_in_tenant(db: Session, tenant_id: int) -> set[str]:
	rows = (
		db.query(User.user_login_id)
		.filter(User.tenant_id == tenant_id)
		.all()
	)
	return {cast(str, r[0]) for r in rows}


def todos_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(Todo).filter(Todo.tenant_id == tenant_id)


def todo_configs_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(TodoConfig).filter(TodoConfig.tenant_id == tenant_id)


def attendance_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(Attendance).filter(Attendance.tenant_id == tenant_id)


def attendance_daily_summaries_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(AttendanceDailySummary).filter(AttendanceDailySummary.tenant_id == tenant_id)


def daily_reports_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(DailyReport).filter(DailyReport.tenant_id == tenant_id)


def weekly_reports_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(WeeklyReport).filter(WeeklyReport.tenant_id == tenant_id)


def monthly_reports_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(MonthlyReport).filter(MonthlyReport.tenant_id == tenant_id)


def user_vacations_in_tenant(db: Session, tenant_id: int) -> Query:
	return db.query(UserVacation).filter(UserVacation.tenant_id == tenant_id)
