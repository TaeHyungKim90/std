from sqlalchemy import Column, Integer, String, DateTime
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