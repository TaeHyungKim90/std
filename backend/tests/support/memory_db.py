"""단위 테스트용 인메모리 SQLite 세션(FK 순서 포함 전 스키마)."""

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

import db.base  # noqa: F401
from db.session import Base
from models.system_models import Department, Position, WorkLocation  # noqa: F401
from models.tenant_models import Tenant

DEFAULT_TEST_TENANT_ID = 1


@contextmanager
def memory_db_session() -> Iterator[Session]:
	engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
	Base.metadata.create_all(bind=engine)
	Sess = sessionmaker(bind=engine)
	s = Sess()
	s.add(Tenant(id=DEFAULT_TEST_TENANT_ID, slug="valuesplay", name="Test Tenant", is_active=True))
	s.commit()
	try:
		yield s
	finally:
		s.close()
