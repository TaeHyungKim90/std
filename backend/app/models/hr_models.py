from sqlalchemy import Column, Integer,Float, String, Date,DateTime, ForeignKey, Text, Boolean,  func
from sqlalchemy.orm import relationship
from database import Base # 상위 폴더의 database.py를 참조하도록 설정
#일정
class Todo(Base):
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True) #교유식별자
    user_id = Column(String, ForeignKey("users.user_login_id"))    # 유저 아이디
    title = Column(String(200), nullable=False)     # 휴가/보고 제목
    description = Column(Text)                      # 상세 내용
    start_date = Column(DateTime, nullable=False)        # 시작 일시
    end_date = Column(DateTime)                          # 종료 일시
    color = Column(String(7))                       # 색상 (#HEX)
    category = Column(String(20))                   # vacation / report
    
    # --- 날짜 기록 컬럼 추가 ---
    created_at = Column(DateTime, server_default=func.now()) # 처음 생성 시 자동 기록
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now()) # 수정 시마다 자동 갱신
    
    author = relationship("User", foreign_keys=[user_id])
#일정 카테고리
class TodoCategoryType(Base):
    __tablename__ = "todo_category_type"

    id = Column(Integer, primary_key=True, index=True)
    category_key = Column(String(20), unique=True, nullable=False) # 'report', 'vacation'
    category_name = Column(String(50), nullable=False)           # '주간보고', '휴가'
    icon = Column(String(10))                                     # '📝', '✈️'
    is_active = Column(Boolean, default=True)
#일정 개인샛팅
class TodoConfig(Base):
    __tablename__ = "todo_config"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_login_id"))
    category_key = Column(String(20), ForeignKey("todo_category_type.category_key"))
    color = Column(String(7), default="#3788d8") 
    default_description=Column(Text)
    category_type = relationship("TodoCategoryType")
# 🌟 1. 회사 지정 장소 마스터 테이블 (어드민에서 관리)
class OfficeLocation(Base):
    __tablename__ = "office_location"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)            # 예: "본사", "강남지사"
    latitude = Column(Float)         # 위도 (예: 37.4979)
    longitude = Column(Float)        # 경도 (예: 127.0276)
    radius = Column(Integer, default=100) # 허용 반경 (미터 단위, 기본 100m)

# 🌟 2. 기존 Attendance 테이블에 좌표 컬럼 추가
class Attendance(Base):
    __tablename__ = "attendance"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    work_date = Column(Date, index=True)
    clock_in_time = Column(DateTime, nullable=True)
    clock_out_time = Column(DateTime, nullable=True)
    clock_in_location = Column(String, nullable=True)
    clock_in_lat = Column(Float, nullable=True)
    clock_in_lng = Column(Float, nullable=True)
    clock_out_location = Column(String, nullable=True)
    clock_out_lat = Column(Float, nullable=True)
    clock_out_lng = Column(Float, nullable=True)
    location_name = Column(String, nullable=True)
    status = Column(String, default="NORMAL")
    work_minutes = Column(Integer, default=0)
    note = Column(String, nullable=True)