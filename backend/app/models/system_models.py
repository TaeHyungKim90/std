from sqlalchemy import Boolean, CheckConstraint, Column, Integer, String, DateTime

from db.session import Base
from utils.seoul_time import now_seoul_naive


class Department(Base):
	__tablename__ = "departments"

	id = Column[int](Integer, primary_key=True, index=True)
	department_name = Column[str](String(100), unique=True, nullable=False)
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)


class Position(Base):
	__tablename__ = "positions"

	id = Column[int](Integer, primary_key=True, index=True)
	position_name = Column[str](String(100), unique=True, nullable=False)
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)


class WorkLocation(Base):
	__tablename__ = "work_locations"
	__table_args__ = (
		CheckConstraint("length(trim(location_key)) > 0", name="ck_work_locations_key_not_blank"),
		CheckConstraint("length(trim(location_value)) > 0", name="ck_work_locations_value_not_blank"),
	)

	id = Column[int](Integer, primary_key=True, index=True)
	location_key = Column[str](String(50), unique=True, nullable=False, index=True)
	location_value = Column[str](String(120), unique=True, nullable=False)
	description = Column[str](String(255), nullable=True)
	is_active = Column[bool](Boolean, nullable=False, server_default="1")
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)

