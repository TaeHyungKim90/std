from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base
from utils.seoul_time import now_seoul_naive


class Department(Base):
	__tablename__ = "departments"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	department_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)


class Position(Base):
	__tablename__ = "positions"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	position_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)


class WorkLocation(Base):
	__tablename__ = "work_locations"
	__table_args__ = (
		CheckConstraint("length(trim(location_key)) > 0", name="ck_work_locations_key_not_blank"),
		CheckConstraint("length(trim(location_value)) > 0", name="ck_work_locations_value_not_blank"),
	)

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	location_key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
	location_value: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
	description: Mapped[str | None] = mapped_column(String(255), nullable=True)
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="1")
	created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=now_seoul_naive)
