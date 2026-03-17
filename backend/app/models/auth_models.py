from sqlalchemy import Column, Integer, String, DateTime, Date, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_login_id = Column(String(50), unique=True, nullable=False) # id
    user_password = Column(String(255), nullable=False)            # 해싱된 pw
    user_name = Column(String(50), nullable=False)                 # 실명
    user_nickname = Column(String(50))                             # 닉네임
    role = Column(String(20), default="user")                      # 권한
    created_at = Column(DateTime, server_default=func.now())
    join_date = Column(Date, nullable=True) 
    resignation_date = Column(Date, nullable=True)
    vacation = relationship("UserVacation", back_populates="user", uselist=False, cascade="all, delete")

class UserVacation(Base):
    __tablename__ = "user_vacations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.user_login_id", ondelete="CASCADE"), unique=True)
    total_days = Column(Integer, default=0)       # 총 발생 연차
    used_days = Column(Float, default=0.0)        # 사용 연차 (반차를 위해 Float)
    remaining_days = Column(Float, default=0.0)   # 잔여 연차
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now()) # 최근 정산일
    
    # User 테이블과의 연결 고리
    user = relationship("User", back_populates="vacation")