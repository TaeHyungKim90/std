from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base
from utils.seoul_time import now_seoul_naive


class Department(Base):
	__tablename__ = "departments"
	__table_args__ = (
		UniqueConstraint("tenant_id", "department_name", name="uq_departments_tenant_name"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	department_name: Mapped[str] = mapped_column(String(100), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)


class Position(Base):
	__tablename__ = "positions"
	__table_args__ = (
		UniqueConstraint("tenant_id", "position_name", name="uq_positions_tenant_name"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	position_name: Mapped[str] = mapped_column(String(100), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)


class WorkLocation(Base):
	__tablename__ = "work_locations"
	__table_args__ = (
		CheckConstraint("length(trim(location_key)) > 0", name="ck_work_locations_key_not_blank"),
		CheckConstraint("length(trim(location_value)) > 0", name="ck_work_locations_value_not_blank"),
		UniqueConstraint("tenant_id", "location_key", name="uq_work_locations_tenant_key"),
		UniqueConstraint("tenant_id", "location_value", name="uq_work_locations_tenant_value"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	tenant_id: Mapped[int] = mapped_column(
		Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
	)
	location_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
	location_value: Mapped[str] = mapped_column(String(120), nullable=False)
	description: Mapped[str | None] = mapped_column(String(255), nullable=True)
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
