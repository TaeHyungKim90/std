# database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = "todo.db"
DB_PATH = os.path.join(BASE_DIR, DB_NAME)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
def init_db():
    from app.models.auth_models import User
    from app.models.hr_models import TodoCategoryType
    from app.services.auth_service import get_password_hash
    
    # 테이블 생성 (이미 있으면 무시됨)
    print("🚀 테이블 생성 시도 중...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 관리자 계정 존재 여부 확인
        admin = db.query(User).filter(User.user_login_id == "admin").first()
        if not admin:
            print("--- 🛠️ 초기 관리자 계정(admin)을 생성합니다 ---")
            new_admin = User(
                user_login_id="admin",
                user_password=get_password_hash("1234"),
                user_name="관리자",
                user_nickname="관리자",
                role="admin"
            )
            db.add(new_admin)
            print("--- ✅ 생성 완료: ID(admin) / PW(1234) ---")
        category_count = db.query(TodoCategoryType).count()
        if category_count == 0:
            print("--- 🏷️ 기본 카테고리(휴가, 주간보고) 생성 중 ---")
            default_categories = [
                # 🛑 [연차 차감 O 카테고리]
                TodoCategoryType(category_key="vacation_full", category_name="연차", icon="🌴"),
                TodoCategoryType(category_key="vacation_am", category_name="오전반차", icon="🌤️"),
                TodoCategoryType(category_key="vacation_pm", category_name="오후반차", icon="⛅"),
                # 🟢 [연차 차감 X 카테고리 (근태 기록용)]
                TodoCategoryType(category_key="vacation_special", category_name="경조휴가", icon="💌"),
                TodoCategoryType(category_key="vacation_sick", category_name="병가", icon="🤒"),
                TodoCategoryType(category_key="official_leave", category_name="공가", icon="🪖"),
                
                # 📝 [일반 업무용]
                TodoCategoryType(category_key="weekly", category_name="주간보고", icon="📝")
            ]
            db.add_all(default_categories)
            print("--- ✅ 기본 카테고리 설정 완료 ---")
        db.commit()
    except Exception as e:
        print(f"❌ 초기화 에러: {e}")
        db.rollback()
    finally:
        db.close()