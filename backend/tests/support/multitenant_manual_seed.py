"""멀티테넌트 수동 테스트 플랜용 시드 데이터 (valuesplay + naver)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time

from sqlalchemy.orm import Session

from core.security import get_password_hash
from models.auth_models import User
from models.hr_models import Attendance, Todo, TodoCategoryType
from models.recruitment_models import JobPosting
from models.system_models import Department, Position, WorkLocation
from models.tenant_models import Tenant
from services.admin.user_service import sync_user_vacation

MANUAL_TEST_PASSWORD = "1234"
SLUG_A = "valuesplay"
SLUG_B = "naver"
MARKER = "mt-manual-test"


@dataclass(frozen=True)
class ManualTestSeedContext:
	tid_a: int
	tid_b: int
	slug_a: str = SLUG_A
	slug_b: str = SLUG_B
	work_date: date = date(2026, 6, 8)
	password: str = MANUAL_TEST_PASSWORD


def _ensure_tenant_b(db: Session) -> int:
	t_b = db.query(Tenant).filter(Tenant.slug == SLUG_B).first()
	if not t_b:
		t_b = Tenant(slug=SLUG_B, name="네이버", is_active=True)
		db.add(t_b)
		db.flush()
	return int(t_b.id)


def _upsert_user(
	db: Session,
	*,
	tenant_id: int,
	login_id: str,
	name: str,
	role: str = "user",
	join_date: date | None = None,
	department_id: int | None = None,
) -> User:
	row = (
		db.query(User)
		.filter(User.tenant_id == tenant_id, User.user_login_id == login_id)
		.first()
	)
	pw = get_password_hash(MANUAL_TEST_PASSWORD)
	if row:
		row.user_name = name
		row.role = role
		row.join_date = join_date
		row.department_id = department_id
		row.visible_in_user_list = login_id != "admin"
		return row
	user = User(
		tenant_id=tenant_id,
		user_login_id=login_id,
		user_password=pw,
		user_name=name,
		role=role,
		join_date=join_date,
		department_id=department_id,
		visible_in_user_list=login_id != "admin",
	)
	db.add(user)
	db.flush()
	return user


def _ensure_vacation_category(db: Session, tenant_id: int) -> None:
	if (
		db.query(TodoCategoryType)
		.filter(
			TodoCategoryType.tenant_id == tenant_id,
			TodoCategoryType.category_key == "vacation_full",
		)
		.count()
		== 0
	):
		db.add(
			TodoCategoryType(
				tenant_id=tenant_id,
				category_key="vacation_full",
				category_name="연차",
				icon="🌴",
			)
		)


def seed_manual_test_data(db: Session, *, work_date: date | None = None) -> ManualTestSeedContext:
	"""valuesplay·naver 수동 테스트 플랜 시드. idempotent."""
	work_date = work_date or date(2026, 6, 8)
	tid_a = 1
	tid_b = _ensure_tenant_b(db)

	for tid in (tid_a, tid_b):
		_ensure_vacation_category(db, tid)

	dept_a = (
		db.query(Department)
		.filter(Department.tenant_id == tid_a, Department.department_name == "A개발팀")
		.first()
	)
	if not dept_a:
		dept_a = Department(tenant_id=tid_a, department_name="A개발팀")
		db.add(dept_a)
		db.flush()

	dept_b = (
		db.query(Department)
		.filter(Department.tenant_id == tid_b, Department.department_name == "B마케팅")
		.first()
	)
	if not dept_b:
		dept_b = Department(tenant_id=tid_b, department_name="B마케팅")
		db.add(dept_b)
		db.flush()

	pos_a = (
		db.query(Position)
		.filter(Position.tenant_id == tid_a, Position.position_name == "A직급")
		.first()
	)
	if not pos_a:
		pos_a = Position(tenant_id=tid_a, position_name="A직급")
		db.add(pos_a)
		db.flush()

	for tid, key, value in (
		(tid_a, "MAIN", "Seoul Head Office"),
		(tid_b, "MAIN", "New York Branch"),
	):
		loc = (
			db.query(WorkLocation)
			.filter(WorkLocation.tenant_id == tid, WorkLocation.location_key == key)
			.first()
		)
		if not loc:
			db.add(
				WorkLocation(
					tenant_id=tid,
					location_key=key,
					location_value=value,
					is_active=True,
				)
			)

	admin_a = _upsert_user(
		db,
		tenant_id=tid_a,
		login_id="admin",
		name="Admin A",
		role="admin",
		join_date=date(2026, 1, 2),
	)
	admin_b = _upsert_user(
		db,
		tenant_id=tid_b,
		login_id="admin",
		name="Admin B",
		role="admin",
		join_date=date(2020, 1, 1),
	)
	emp_a = _upsert_user(
		db,
		tenant_id=tid_a,
		login_id="emp_a",
		name="직원 A",
		join_date=date(2026, 1, 2),
		department_id=int(dept_a.id),
	)
	_upsert_user(
		db,
		tenant_id=tid_b,
		login_id="emp_b",
		name="직원 B",
		join_date=date(2020, 1, 1),
		department_id=int(dept_b.id),
	)
	shared_a = _upsert_user(
		db,
		tenant_id=tid_a,
		login_id="shared01",
		name="공유직원 A",
		join_date=date(2024, 3, 1),
	)
	shared_b = _upsert_user(
		db,
		tenant_id=tid_b,
		login_id="shared01",
		name="공유직원 B",
		join_date=date(2024, 3, 1),
	)

	clock_in = datetime.combine(work_date, time(9, 0))
	for tid, login_id in (
		(tid_a, "admin"),
		(tid_a, "shared01"),
		(tid_b, "admin"),
		(tid_b, "shared01"),
	):
		exists = (
			db.query(Attendance)
			.filter(
				Attendance.tenant_id == tid,
				Attendance.user_id == login_id,
				Attendance.work_date == work_date,
			)
			.first()
		)
		if not exists:
			db.add(
				Attendance(
					tenant_id=tid,
					user_id=login_id,
					work_date=work_date,
					clock_in_time=clock_in,
					clock_in_location="MAIN",
				)
			)
		# 중복 세션(플랜: 같은 날 복수 출근도 1행)
		dup = (
			db.query(Attendance)
			.filter(
				Attendance.tenant_id == tid,
				Attendance.user_id == login_id,
				Attendance.work_date == work_date,
			)
			.count()
		)
		if dup < 2 and login_id == "admin":
			db.add(
				Attendance(
					tenant_id=tid,
					user_id=login_id,
					work_date=work_date,
					clock_in_time=datetime.combine(work_date, time(18, 0)),
					clock_in_location="MAIN",
				)
			)

	st = datetime.combine(work_date, time(9, 0))
	en = datetime.combine(work_date, time(18, 0))
	for tid, login_id, title in (
		(tid_a, "emp_a", f"{MARKER}-todo-a"),
		(tid_b, "emp_b", f"{MARKER}-todo-b"),
		(tid_a, "shared01", f"{MARKER}-shared-a"),
		(tid_b, "shared01", f"{MARKER}-shared-b"),
	):
		if (
			db.query(Todo)
			.filter(Todo.tenant_id == tid, Todo.title == title)
			.count()
			== 0
		):
			db.add(
				Todo(
					tenant_id=tid,
					user_id=login_id,
					title=title,
					start_date=st,
					end_date=en,
					category="vacation_full",
				)
			)

	for tid, title in (
		(tid_a, f"{MARKER}-job-a"),
		(tid_b, f"{MARKER}-job-b"),
	):
		if (
			db.query(JobPosting)
			.filter(JobPosting.tenant_id == tid, JobPosting.title == title)
			.count()
			== 0
		):
			db.add(
				JobPosting(
					tenant_id=tid,
					title=title,
					description=f"채용 공고 {title}",
					status="open",
					author_id="admin",
				)
			)

	db.flush()
	shared_b_user = (
		db.query(User)
		.filter(User.tenant_id == tid_b, User.user_login_id == "shared01")
		.one()
	)
	for u in (admin_a, admin_b, emp_a, shared_a, shared_b_user):
		db.refresh(u)
		if u.join_date:
			sync_user_vacation(db, u, work_date)
	db.commit()

	return ManualTestSeedContext(tid_a=tid_a, tid_b=tid_b, work_date=work_date)
