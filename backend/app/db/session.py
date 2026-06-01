# session.py
import os
from typing import cast

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import settings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_NAME = "todo.db"
DB_PATH = os.path.join(BASE_DIR, DB_NAME)

_raw_url = (settings.DATABASE_URL or "").strip()
SQLALCHEMY_DATABASE_URL = _raw_url if _raw_url else f"sqlite:///{DB_PATH}"

_connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _ensure_attendance_shift_status_column() -> None:
	"""기존 DB에 attendance.shift_status 컬럼·백필·인덱스 보강(SQLite/PostgreSQL 등 공통 ALTER)."""
	insp = inspect(engine)
	if not insp.has_table("attendance"):
		return
	cols = {c["name"] for c in insp.get_columns("attendance")}
	if "shift_status" not in cols:
		with engine.begin() as conn:
			conn.execute(text("ALTER TABLE attendance ADD COLUMN shift_status VARCHAR(20)"))
	# 신규 create_all 로 생긴 컬럼은 전부 NULL일 수 있어 매 기동 시 NULL 행만 백필
	with engine.begin() as conn:
		conn.execute(
			text(
				"UPDATE attendance SET shift_status = :closed WHERE clock_out_time IS NOT NULL AND shift_status IS NULL"
			),
			{"closed": "CLOSED"},
		)
		conn.execute(
			text(
				"UPDATE attendance SET shift_status = :prog WHERE clock_in_time IS NOT NULL AND clock_out_time IS NULL AND shift_status IS NULL"
			),
			{"prog": "IN_PROGRESS"},
		)
		conn.execute(
			text("UPDATE attendance SET shift_status = :closed WHERE shift_status IS NULL"),
			{"closed": "CLOSED"},
		)
	with engine.begin() as conn:
		conn.execute(
			text(
				"CREATE INDEX IF NOT EXISTS ix_attendance_user_shift_status ON attendance (user_id, shift_status)"
			)
		)


def _ensure_attendance_night_work_minutes_column() -> None:
	"""기존 DB에 attendance.night_work_minutes 보강."""
	insp = inspect(engine)
	if not insp.has_table("attendance"):
		return
	cols = {c["name"] for c in insp.get_columns("attendance")}
	if "night_work_minutes" not in cols:
		with engine.begin() as conn:
			conn.execute(text("ALTER TABLE attendance ADD COLUMN night_work_minutes INTEGER NOT NULL DEFAULT 0"))
	with engine.begin() as conn:
		conn.execute(text("UPDATE attendance SET night_work_minutes = 0 WHERE night_work_minutes IS NULL"))


def _ensure_users_preferred_work_location_column() -> None:
	"""기존 DB에 users.preferred_work_location 보강."""
	insp = inspect(engine)
	if not insp.has_table("users"):
		return
	cols = {c["name"] for c in insp.get_columns("users")}
	if "preferred_work_location" not in cols:
		with engine.begin() as conn:
			conn.execute(text("ALTER TABLE users ADD COLUMN preferred_work_location VARCHAR(120)"))


def _ensure_multi_tenant_schema() -> None:
	"""tenants 테이블 생성 및 기존 행에 tenant_id 백필."""
	from core.config import settings as app_settings
	from models.tenant_models import Tenant

	Base.metadata.create_all(bind=engine, tables=[Tenant.__table__])
	insp = inspect(engine)

	db = SessionLocal()
	try:
		if db.query(Tenant).count() == 0:
			print("--- 🏢 기본 테넌트(valuesplay, naver) 생성 ---")
			db.add_all(
				[
					Tenant(slug="valuesplay", name="가치플레이", is_active=True)
				]
			)
			db.commit()
		default_tenant = (
			db.query(Tenant)
			.filter(Tenant.slug == app_settings.DEFAULT_TENANT_SLUG)
			.first()
		)
		if not default_tenant:
			default_tenant = db.query(Tenant).order_by(Tenant.id).first()
		default_tid = cast(int, default_tenant.id) if default_tenant else 1
	finally:
		db.close()

	tenant_column_tables = (
		"users",
		"departments",
		"positions",
		"work_locations",
		"todo_category_type",
		"holidays",
		"resume_templates",
		"applicants",
		"job_postings",
		"office_location",
	)
	for table in tenant_column_tables:
		if not insp.has_table(table):
			continue
		cols = {c["name"] for c in insp.get_columns(table)}
		if "tenant_id" in cols:
			continue
		print(f"--- 🏢 {table}.tenant_id 컬럼 추가 ---")
		with engine.begin() as conn:
			conn.execute(
				text(f"ALTER TABLE {table} ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT {default_tid}")
			)
		with engine.begin() as conn:
			conn.execute(
				text(f"UPDATE {table} SET tenant_id = :tid WHERE tenant_id IS NULL"),
				{"tid": default_tid},
			)

	_drop_legacy_single_column_unique_indexes(insp)


def _drop_legacy_single_column_unique_indexes(insp) -> None:
	"""SQLite 레거시 전역 UNIQUE 인덱스 제거 → 테넌트별 복합 UNIQUE 허용."""
	if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
		return
	legacy_columns = {
		"todo_category_type": "category_key",
		"users": "user_login_id",
		"departments": "department_name",
		"positions": "position_name",
		"work_locations": "location_key",
		"holidays": "holiday_date",
		"resume_templates": "saved_name",
		"applicants": "email_id",
	}
	with engine.begin() as conn:
		for table, col in legacy_columns.items():
			if not insp.has_table(table):
				continue
			rows = conn.execute(text(f'PRAGMA index_list("{table}")')).fetchall()
			for idx in rows:
				idx_name = idx[1]
				is_unique = bool(idx[2])
				if not is_unique:
					continue
				info = conn.execute(text(f'PRAGMA index_info("{idx_name}")')).fetchall()
				if len(info) == 1 and info[0][2] == col:
					print(f"--- 🏢 레거시 UNIQUE 인덱스 제거: {idx_name} ({table}.{col}) ---")
					conn.execute(text(f'DROP INDEX IF EXISTS "{idx_name}"'))


def _seed_tenant_defaults(db, tenant_id: int) -> None:
	"""테넌트별 마스터 데이터(카테고리·근무장소) 시드."""
	from models.hr_models import TodoCategoryType
	from models.system_models import WorkLocation

	if db.query(TodoCategoryType).filter(TodoCategoryType.tenant_id == tenant_id).count() == 0:
		default_categories = [
			TodoCategoryType(
				tenant_id=tenant_id,
				category_key="vacation_full",
				category_name="연차",
				icon="🌴",
			),
			TodoCategoryType(
				tenant_id=tenant_id,
				category_key="vacation_am",
				category_name="오전반차",
				icon="🌤️",
			),
			TodoCategoryType(
				tenant_id=tenant_id,
				category_key="vacation_pm",
				category_name="오후반차",
				icon="⛅",
			),
			TodoCategoryType(
				tenant_id=tenant_id,
				category_key="vacation_special",
				category_name="경조휴가",
				icon="💌",
			),
			TodoCategoryType(
				tenant_id=tenant_id,
				category_key="vacation_sick",
				category_name="병가",
				icon="🤒",
			),
			TodoCategoryType(
				tenant_id=tenant_id,
				category_key="official_leave",
				category_name="공가",
				icon="🪖",
			),
		]
		db.add_all(default_categories)

	if db.query(WorkLocation).filter(WorkLocation.tenant_id == tenant_id).count() == 0:
		db.add(
			WorkLocation(
				tenant_id=tenant_id,
				location_key="company",
				location_value="회사",
				description="기본 근무장소",
				is_active=True,
			)
		)


def _ensure_attendance_daily_summary_table() -> None:
	"""attendance_daily_summary 테이블이 없으면 생성."""
	insp = inspect(engine)
	if insp.has_table("attendance_daily_summary"):
		return
	from models.hr_models import AttendanceDailySummary

	AttendanceDailySummary.__table__.create(bind=engine, checkfirst=True)


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()
def init_db():
	from db import base
	from models.auth_models import User
	from models.hr_models import TodoCategoryType
	from models.system_models import Department, Position, WorkLocation
	from core.security import get_password_hash
	
	# 테이블 생성 (이미 있으면 무시됨)
	print("🚀 테이블 생성 시도 중...")
	Base.metadata.create_all(bind=engine)
	try:
		_ensure_multi_tenant_schema()
	except Exception as ex:
		print(f"ℹ️ 멀티테넌트 스키마 보강 실패(무시 가능): {ex}")
	try:
		_ensure_attendance_shift_status_column()
	except Exception as ex:
		print(f"ℹ️ attendance.shift_status 보강 실패(무시 가능): {ex}")
	try:
		_ensure_attendance_night_work_minutes_column()
	except Exception as ex:
		print(f"ℹ️ attendance.night_work_minutes 보강 실패(무시 가능): {ex}")
	try:
		_ensure_attendance_daily_summary_table()
	except Exception as ex:
		print(f"ℹ️ attendance_daily_summary 테이블 생성 실패(무시 가능): {ex}")
	try:
		_ensure_users_preferred_work_location_column()
	except Exception as ex:
		print(f"ℹ️ users.preferred_work_location 보강 실패(무시 가능): {ex}")

	# 기존 SQLite DB에 신규 컬럼이 없을 경우, 런타임에서 안전하게 ALTER TABLE을 시도합니다.
	# (운영에서는 마이그레이션(Alembic 등)을 권장합니다.)
	try:
		if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
			conn = engine.connect()
			try:
				existing_cols = {row["name"] for row in conn.execute(text("PRAGMA table_info(users)")).mappings()}
				add_cols = {
					"user_profile_image_url": "TEXT",
					"department_id": "INTEGER",
					"position_id": "INTEGER",
					"salary_bank_name": "TEXT",
					"salary_account_number": "TEXT",
				}
				for col, col_type in add_cols.items():
					if col not in existing_cols:
						conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))

				# 레거시 컬럼(user_department/user_position)이 남아있다면 FK로 1회 백필
				if "user_department" in existing_cols or "user_position" in existing_cols:
					rows = conn.execute(text(
						"""
						SELECT id, user_department, user_position
						FROM users
						WHERE (department_id IS NULL AND user_department IS NOT NULL AND TRIM(user_department) != '')
						   OR (position_id IS NULL AND user_position IS NOT NULL AND TRIM(user_position) != '')
						"""
					)).mappings().all()
					for row in rows:
						dept_id = None
						pos_id = None
						dept_name = (row.get("user_department") or "").strip()
						pos_name = (row.get("user_position") or "").strip()

						if dept_name:
							dept_row = conn.execute(
								text("SELECT id FROM departments WHERE department_name = :name LIMIT 1"),
								{"name": dept_name},
							).mappings().first()
							if dept_row:
								dept_id = dept_row["id"]

						if pos_name:
							pos_row = conn.execute(
								text("SELECT id FROM positions WHERE position_name = :name LIMIT 1"),
								{"name": pos_name},
							).mappings().first()
							if pos_row:
								pos_id = pos_row["id"]

						conn.execute(
							text("UPDATE users SET department_id = :dept_id, position_id = :pos_id WHERE id = :user_id"),
							{"dept_id": dept_id, "pos_id": pos_id, "user_id": row["id"]},
						)
				# 채용 공고: 이력서 템플릿 FK 컬럼 (SQLite 런타임 보강)
				try:
					jp_cols = {r["name"] for r in conn.execute(text("PRAGMA table_info(job_postings)")).mappings()}
					if "resume_template_id" not in jp_cols:
						conn.execute(text("ALTER TABLE job_postings ADD COLUMN resume_template_id INTEGER"))
				except Exception as jp_e:
					print(f"ℹ️ job_postings resume_template_id ALTER 시도 실패(무시): {jp_e}")
				conn.commit()
			finally:
				conn.close()
	except Exception as e:
		print(f"ℹ️ users 프로필 컬럼 ALTER TABLE 시도 실패(무시): {e}")
	
	db = SessionLocal()
	try:
		from models.platform_models import PlatformAdmin
		from models.tenant_models import Tenant

		if settings.BOOTSTRAP_PLATFORM_ADMIN:
			platform_admin = (
				db.query(PlatformAdmin)
				.filter(PlatformAdmin.login_id == "platform")
				.first()
			)
			if not platform_admin:
				print("--- 🛠️ 플랫폼 관리자(platform/platform) 생성 (BOOTSTRAP_PLATFORM_ADMIN) ---")
				db.add(
					PlatformAdmin(
						login_id="platform",
						password_hash=get_password_hash("platform"),
						name="플랫폼 관리자",
						is_active=True,
					)
				)
				db.commit()
				print("--- ✅ platform/platform — 운영 배포 전 반드시 변경 ---")
		elif settings.ENVIRONMENT == "production":
			print("--- ℹ️ BOOTSTRAP_PLATFORM_ADMIN=false — 플랫폼 관리자 자동 생성을 건너뜁니다. ---")

		tenants = db.query(Tenant).filter(Tenant.is_active.is_(True)).all()
		if not tenants:
			tenants = db.query(Tenant).all()

		# 개발용 기본 관리자(admin/1234) — 테넌트별 1회
		if settings.BOOTSTRAP_DEFAULT_ADMIN:
			for tenant in tenants:
				tid = cast(int, tenant.id)
				admin = (
					db.query(User)
					.filter(User.user_login_id == "admin", User.tenant_id == tid)
					.first()
				)
				if not admin:
					print(
						f"--- 🛠️ [{tenant.slug}] 초기 관리자(admin) 생성 (BOOTSTRAP_DEFAULT_ADMIN) ---"
					)
					db.add(
						User(
							tenant_id=tid,
							user_login_id="admin",
							user_password=get_password_hash("1234"),
							user_name="관리자",
							user_nickname="관리자",
							role="admin",
						)
					)
			print("--- ✅ 테넌트별 admin/1234 — 운영 배포 전 반드시 변경 ---")
		elif settings.ENVIRONMENT == "production":
			print("--- ℹ️ BOOTSTRAP_DEFAULT_ADMIN=false — 기본 관리자 자동 생성을 건너뜁니다. ---")

		for tenant in tenants:
			try:
				_seed_tenant_defaults(db, cast(int, tenant.id))
				db.commit()
			except Exception as seed_err:
				db.rollback()
				print(
					f"ℹ️ [{getattr(tenant, 'slug', tenant.id)}] 테넌트 시드 일부 실패 "
					f"(레거시 DB unique 제약일 수 있음): {seed_err}"
				)
		# 이력서 템플릿 시드: DB에 행이 없으면 assets 기본 .docx를 uploads로 복사 후 1건 등록
		try:
			import shutil
			import uuid
			from pathlib import Path

			from models.recruitment_models import JobPosting, ResumeTemplate
			from services import common_service as _common_paths

			if db.query(ResumeTemplate).count() == 0:
				asset = Path(BASE_DIR) / "app" / "assets" / "templates" / "default_resume_template.docx"
				upload_root = _common_paths.UPLOAD_DIR
				os.makedirs(upload_root, exist_ok=True)
				saved = f"{uuid.uuid4().hex}.docx"
				dest = os.path.join(upload_root, saved)
				if asset.is_file():
					shutil.copy2(str(asset), dest)
				else:
					print(f"⚠️ 기본 이력서 템플릿 파일이 없습니다: {asset}")
					raise FileNotFoundError(str(asset))
				default_tid = cast(int, tenants[0].id) if tenants else 1
				tpl = ResumeTemplate(
					tenant_id=default_tid,
					name="기본 양식 (v1)",
					saved_name=saved,
					file_path=f"/uploads/{saved}",
					is_default=True,
					is_deleted=False,
				)
				db.add(tpl)
				db.flush()
				db.query(JobPosting).filter(JobPosting.resume_template_id.is_(None)).update(
					{JobPosting.resume_template_id: tpl.id},
					synchronize_session=False,
				)
				print("--- ✅ 기본 이력서 템플릿(시드) 등록 완료 ---")
		except Exception as seed_e:
			print(f"ℹ️ 이력서 템플릿 시드 건너뜀 또는 실패: {seed_e}")
		db.commit()
	except Exception as e:
		print(f"❌ 초기화 에러: {e}")
		db.rollback()
	finally:
		db.close()

	# 레거시: attendance·users에 저장된 표시 문자열을 location_key로 치환
	try:
		from services.hr.attendance_service import backfill_legacy_work_location_values_to_keys

		_bf = SessionLocal()
		try:
			backfill_legacy_work_location_values_to_keys(_bf)
		finally:
			_bf.close()
	except Exception as ex:
		print(f"ℹ️ 근무장소 value→key 백필 실패(무시 가능): {ex}")