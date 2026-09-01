from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
	Boolean,
	Date,
	DateTime,
	Float,
	ForeignKey,
	Index,
	Integer,
	String,
	Text,
	UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.session import Base
from utils.seoul_time import now_seoul_naive

if TYPE_CHECKING:
	from models.auth_models import User


class Todo(Base):
	__tablename__ = "todos"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.user_login_id"))
	title: Mapped[str] = mapped_column(String(200), nullable=False)
	description: Mapped[str | None] = mapped_column(Text)
	start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
	end_date: Mapped[datetime | None] = mapped_column(DateTime)
	color: Mapped[str | None] = mapped_column(String(7))
	category: Mapped[str | None] = mapped_column(String(20))
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime, nullable=False, default=now_seoul_naive, onupdate=now_seoul_naive
	)

	author: Mapped[User | None] = relationship(
		"User",
		primaryjoin="and_(Todo.tenant_id == User.tenant_id, Todo.user_id == User.user_login_id)",
		foreign_keys="[Todo.tenant_id, Todo.user_id]",
	)


class TodoCategoryType(Base):
	__tablename__ = "todo_category_type"
	__table_args__ = (
		UniqueConstraint("tenant_id", "category_key", name="uq_todo_category_tenant_key"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	category_key: Mapped[str] = mapped_column(String(20), nullable=False)
	category_name: Mapped[str] = mapped_column(String(50), nullable=False)
	icon: Mapped[str | None] = mapped_column(String(10))
	is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class TodoConfig(Base):
	__tablename__ = "todo_config"
	__table_args__ = (
		UniqueConstraint("tenant_id", "user_id", "category_key", name="uq_todo_config_tenant_user_category"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.user_login_id"))
	category_key: Mapped[str | None] = mapped_column(
		String(20), ForeignKey("todo_category_type.category_key")
	)
	color: Mapped[str | None] = mapped_column(String(7), default="#3788d8")
	default_description: Mapped[str | None] = mapped_column(Text)
	category_type: Mapped[TodoCategoryType | None] = relationship("TodoCategoryType")


class OfficeLocation(Base):
	__tablename__ = "office_location"
	__table_args__ = (
		UniqueConstraint("tenant_id", "name", name="uq_office_location_tenant_name"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	name: Mapped[str | None] = mapped_column(String)
	latitude: Mapped[float | None] = mapped_column(Float)
	longitude: Mapped[float | None] = mapped_column(Float)
	radius: Mapped[int | None] = mapped_column(Integer, default=100)


class Attendance(Base):
	__tablename__ = "attendance"
	__table_args__ = (
		Index("ix_attendance_user_shift_status", "user_id", "shift_status"),
		Index("ix_attendance_tenant_user_date", "tenant_id", "user_id", "work_date"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	user_id: Mapped[str | None] = mapped_column(String, index=True)
	work_date: Mapped[date | None] = mapped_column(Date, index=True)
	clock_in_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
	clock_out_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
	clock_in_location: Mapped[str | None] = mapped_column(String, nullable=True)
	clock_in_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
	clock_in_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
	clock_out_location: Mapped[str | None] = mapped_column(String, nullable=True)
	clock_out_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
	clock_out_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
	location_name: Mapped[str | None] = mapped_column(String, nullable=True)
	status: Mapped[str | None] = mapped_column(String, default="NORMAL")
	work_minutes: Mapped[int | None] = mapped_column(Integer, default=0)
	night_work_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
	note: Mapped[str | None] = mapped_column(String, nullable=True)
	shift_status: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)


class AttendanceDailySummary(Base):
	"""동일 user·work_date CLOSED 세션 합산(연장·야간 합)."""

	__tablename__ = "attendance_daily_summary"
	__table_args__ = (
		UniqueConstraint(
			"tenant_id", "user_id", "work_date", name="uq_attendance_daily_summary_tenant_user_date"
		),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	user_id: Mapped[str] = mapped_column(
		String(50), ForeignKey("users.user_login_id"), index=True, nullable=False
	)
	work_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
	total_work_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
	overtime_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
	total_night_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class DailyReport(Base):
	__tablename__ = "daily_reports"
	__table_args__ = (
		UniqueConstraint("tenant_id", "user_id", "report_date", name="uq_daily_reports_tenant_user_date"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	user_id: Mapped[str] = mapped_column(
		String(50), ForeignKey("users.user_login_id"), index=True, nullable=False
	)
	report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
	content: Mapped[str] = mapped_column(Text, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime, nullable=False, default=now_seoul_naive, onupdate=now_seoul_naive
	)


class WeeklyReport(Base):
	__tablename__ = "weekly_reports"
	__table_args__ = (
		UniqueConstraint(
			"tenant_id", "user_id", "week_start_date", name="uq_weekly_reports_tenant_user_week"
		),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	user_id: Mapped[str] = mapped_column(
		String(50), ForeignKey("users.user_login_id"), index=True, nullable=False
	)
	week_start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
	summary: Mapped[str] = mapped_column(Text, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime, nullable=False, default=now_seoul_naive, onupdate=now_seoul_naive
	)


class MonthlyReport(Base):
	__tablename__ = "monthly_reports"
	__table_args__ = (
		UniqueConstraint(
			"tenant_id", "user_id", "month_start_date", name="uq_monthly_reports_tenant_user_month"
		),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	user_id: Mapped[str] = mapped_column(
		String(50), ForeignKey("users.user_login_id"), index=True, nullable=False
	)
	month_start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
	summary: Mapped[str] = mapped_column(Text, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime, nullable=False, default=now_seoul_naive, onupdate=now_seoul_naive
	)
