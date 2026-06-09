from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base
from utils.seoul_time import now_seoul_naive

if TYPE_CHECKING:
	from models.system_models import Department, Position


class User(Base):
	__tablename__ = "users"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	user_login_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
	user_password: Mapped[str] = mapped_column(String(255), nullable=False)
	user_name: Mapped[str] = mapped_column(String(50), nullable=False)
	user_nickname: Mapped[str | None] = mapped_column(String(50))
	user_profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
	department_id: Mapped[int | None] = mapped_column(
		Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
	)
	position_id: Mapped[int | None] = mapped_column(
		Integer, ForeignKey("positions.id", ondelete="SET NULL"), nullable=True, index=True
	)
	salary_bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
	salary_account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
	role: Mapped[str | None] = mapped_column(String(20), default="user")
	user_phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
	join_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	resignation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
	preferred_work_location: Mapped[str | None] = mapped_column(String(120), nullable=True)

	vacation: Mapped[UserVacation | None] = relationship(
		"UserVacation", back_populates="user", uselist=False, cascade="all, delete"
	)
	avatar_setting: Mapped[UserAvatarSetting | None] = relationship(
		"UserAvatarSetting", back_populates="user", uselist=False, cascade="all, delete-orphan"
	)
	department: Mapped[Department | None] = relationship("Department", foreign_keys=[department_id])
	position: Mapped[Position | None] = relationship("Position", foreign_keys=[position_id])

	@property
	def avatar_zoom(self) -> float:
		return float(self.avatar_setting.zoom) if self.avatar_setting and self.avatar_setting.zoom is not None else 1.0

	@property
	def avatar_offset_x(self) -> float:
		return (
			float(self.avatar_setting.offset_x)
			if self.avatar_setting and self.avatar_setting.offset_x is not None
			else 0.0
		)

	@property
	def avatar_offset_y(self) -> float:
		return (
			float(self.avatar_setting.offset_y)
			if self.avatar_setting and self.avatar_setting.offset_y is not None
			else 0.0
		)

	@property
	def department_name(self) -> str | None:
		return self.department.department_name if self.department else None

	@property
	def position_name(self) -> str | None:
		return self.position.position_name if self.position else None


class UserVacation(Base):
	__tablename__ = "user_vacations"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	user_id: Mapped[str | None] = mapped_column(
		String(50), ForeignKey("users.user_login_id", ondelete="CASCADE"), unique=True
	)
	total_days: Mapped[int | None] = mapped_column(Integer, default=0)
	used_days: Mapped[float | None] = mapped_column(Float, default=0.0)
	remaining_days: Mapped[float | None] = mapped_column(Float, default=0.0)
	last_updated: Mapped[datetime] = mapped_column(
		DateTime, nullable=False, default=now_seoul_naive, onupdate=now_seoul_naive
	)

	user: Mapped[User | None] = relationship("User", back_populates="vacation")


class UserAvatarSetting(Base):
	__tablename__ = "user_avatar_settings"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	user_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
	)
	zoom: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
	offset_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
	offset_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime, nullable=False, default=now_seoul_naive, onupdate=now_seoul_naive
	)

	user: Mapped[User | None] = relationship("User", back_populates="avatar_setting")
