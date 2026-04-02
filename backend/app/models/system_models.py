from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from db.session import Base


class Department(Base):
	__tablename__ = "departments"

	id = Column[int](Integer, primary_key=True, index=True)
	department_name = Column[str](String(100), unique=True, nullable=False)
	created_at = Column(DateTime, server_default=func.now())


class Position(Base):
	__tablename__ = "positions"

	id = Column[int](Integer, primary_key=True, index=True)
	position_name = Column[str](String(100), unique=True, nullable=False)
	created_at = Column(DateTime, server_default=func.now())

