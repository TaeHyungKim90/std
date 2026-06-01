from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, String, DateTime, UniqueConstraint

from db.session import Base
from utils.seoul_time import now_seoul_naive


class Department(Base):
	__tablename__ = "departments"
	__table_args__ = (
		UniqueConstraint("tenant_id", "department_name", name="uq_departments_tenant_name"),
	)

	id = Column[int](Integer, primary_key=True, index=True)
	tenant_id = Column[int](Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
	department_name = Column[str](String(100), nullable=False)
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)


class Position(Base):
	__tablename__ = "positions"
	__table_args__ = (
		UniqueConstraint("tenant_id", "position_name", name="uq_positions_tenant_name"),
	)

	id = Column[int](Integer, primary_key=True, index=True)
	tenant_id = Column[int](Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
	position_name = Column[str](String(100), nullable=False)
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)


class WorkLocation(Base):
	__tablename__ = "work_locations"
	__table_args__ = (
		CheckConstraint("length(trim(location_key)) > 0", name="ck_work_locations_key_not_blank"),
		CheckConstraint("length(trim(location_value)) > 0", name="ck_work_locations_value_not_blank"),
		UniqueConstraint("tenant_id", "location_key", name="uq_work_locations_tenant_key"),
		UniqueConstraint("tenant_id", "location_value", name="uq_work_locations_tenant_value"),
	)

	id = Column[int](Integer, primary_key=True, index=True)
	tenant_id = Column[int](Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
	location_key = Column[str](String(50), nullable=False, index=True)
	location_value = Column[str](String(120), nullable=False)
	description = Column[str](String(255), nullable=True)
	is_active = Column[bool](Boolean, nullable=False, server_default="1")
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)

