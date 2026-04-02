from typing import Any


from datetime import date, datetime


from sqlalchemy import Column, Integer, String, DateTime, Date, Float, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.session import Base

class User(Base):
	__tablename__ = "users"

	id = Column[int](Integer, primary_key=True, index=True)
	user_login_id = Column[str](String(50), unique=True, nullable=False) 	# id
	user_password = Column[str](String(255), nullable=False)				# 해싱된 pw
	user_name = Column[str](String(50), nullable=False)				 		# 실명
	user_nickname = Column[str](String(50))							 		# 닉네임
	# 사용자 프로필 확장 필드(사진/부서/직급/급여계좌)
	user_profile_image_url = Column[str](String(500), nullable=True)		# 파일 저장 경로(/uploads/...)
	department_id = Column[int](Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True)
	position_id = Column[int](Integer, ForeignKey("positions.id", ondelete="SET NULL"), nullable=True, index=True)
	salary_bank_name = Column[str](String(100), nullable=True)				# 급여 은행명
	salary_account_number = Column[str](String(50), nullable=True)			# 급여 계좌번호
	role = Column[str](String(20), default="user")					 		# 권한
	user_phone_number = Column[str](String(20), nullable=True)
	created_at = Column[datetime](DateTime, server_default=func.now())
	join_date = Column[date](Date, nullable=True) 
	resignation_date = Column[date](Date, nullable=True)
	vacation = relationship("UserVacation", back_populates="user", uselist=False, cascade="all, delete")
	avatar_setting = relationship("UserAvatarSetting", back_populates="user", uselist=False, cascade="all, delete-orphan")
	department = relationship("Department", foreign_keys=[department_id])
	position = relationship("Position", foreign_keys=[position_id])

	@property
	def avatar_zoom(self) -> float:
		return float(self.avatar_setting.zoom) if self.avatar_setting and self.avatar_setting.zoom is not None else 1.0

	@property
	def avatar_offset_x(self) -> float:
		return float(self.avatar_setting.offset_x) if self.avatar_setting and self.avatar_setting.offset_x is not None else 0.0

	@property
	def avatar_offset_y(self) -> float:
		return float(self.avatar_setting.offset_y) if self.avatar_setting and self.avatar_setting.offset_y is not None else 0.0

	@property
	def department_name(self) -> str | None:
		return self.department.department_name if self.department else None

	@property
	def position_name(self) -> str | None:
		return self.position.position_name if self.position else None

class UserVacation(Base):
	__tablename__ = "user_vacations"
	
	id = Column[int](Integer, primary_key=True, index=True)
	user_id = Column[str](String(50), ForeignKey("users.user_login_id", ondelete="CASCADE"), unique=True)
	total_days = Column[int](Integer, default=0)												# 총 발생 연차
	used_days = Column[Any](Float, default=0.0)													# 사용 연차 (반차를 위해 Float)
	remaining_days = Column[Any](Float, default=0.0)											# 잔여 연차
	last_updated = Column[datetime](DateTime, server_default=func.now(), onupdate=func.now()) 	# 최근 정산일
	
	# User 테이블과의 연결 고리
	user = relationship("User", back_populates="vacation")


class UserAvatarSetting(Base):
	__tablename__ = "user_avatar_settings"

	id = Column[int](Integer, primary_key=True, index=True)
	user_id = Column[int](Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
	zoom = Column[Any](Float, nullable=False, default=1.0)
	offset_x = Column[Any](Float, nullable=False, default=0.0)
	offset_y = Column[Any](Float, nullable=False, default=0.0)
	created_at = Column[datetime](DateTime, server_default=func.now())
	updated_at = Column[datetime](DateTime, server_default=func.now(), onupdate=func.now())

	user = relationship("User", back_populates="avatar_setting")