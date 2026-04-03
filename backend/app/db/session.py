# session.py
import os
from sqlalchemy import create_engine, text
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
	from models.system_models import Department, Position
	from core.security import get_password_hash
	
	# 테이블 생성 (이미 있으면 무시됨)
	print("🚀 테이블 생성 시도 중...")
	Base.metadata.create_all(bind=engine)

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
		# 개발용 기본 관리자(admin/1234) — BOOTSTRAP_DEFAULT_ADMIN=true 일 때만 (운영에서는 False 권장)
		if settings.BOOTSTRAP_DEFAULT_ADMIN:
			admin = db.query(User).filter(User.user_login_id == "admin").first()
			if not admin:
				print("--- 🛠️ 초기 관리자 계정(admin)을 생성합니다 (BOOTSTRAP_DEFAULT_ADMIN) ---")
				new_admin = User(
					user_login_id="admin",
					user_password=get_password_hash("1234"),
					user_name="관리자",
					user_nickname="관리자",
					role="admin"
				)
				db.add(new_admin)
				print("--- ✅ 생성 완료: ID(admin) / PW(1234) — 운영 배포 전 반드시 변경 또는 비활성화 ---")
		elif settings.ENVIRONMENT == "production":
			print("--- ℹ️ BOOTSTRAP_DEFAULT_ADMIN=false — 기본 관리자 자동 생성을 건너뜁니다. ---")
		category_count = db.query(TodoCategoryType).count()
		if category_count == 0:
			print("--- 🏷️ 기본 카테고리(휴가·근태 등) 생성 중 ---")
			default_categories = [
				# 🛑 [연차 차감 O 카테고리]
				TodoCategoryType(category_key="vacation_full", category_name="연차", icon="🌴"),
				TodoCategoryType(category_key="vacation_am", category_name="오전반차", icon="🌤️"),
				TodoCategoryType(category_key="vacation_pm", category_name="오후반차", icon="⛅"),
				# 🟢 [연차 차감 X 카테고리 (근태 기록용)]
				TodoCategoryType(category_key="vacation_special", category_name="경조휴가", icon="💌"),
				TodoCategoryType(category_key="vacation_sick", category_name="병가", icon="🤒"),
				TodoCategoryType(category_key="official_leave", category_name="공가", icon="🪖"),
			]
			db.add_all(default_categories)
			print("--- ✅ 기본 카테고리 설정 완료 ---")
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
				tpl = ResumeTemplate(
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