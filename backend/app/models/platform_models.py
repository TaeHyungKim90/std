from sqlalchemy import Boolean, Column, DateTime, Integer, String

from db.session import Base
from utils.seoul_time import now_seoul_naive


class PlatformAdmin(Base):
	"""SaaS 플랫폼 운영자 — 테넌트와 무관한 전역 관리 계정."""

	__tablename__ = "platform_admins"

	id = Column(Integer, primary_key=True, index=True)
	login_id = Column(String(50), unique=True, nullable=False, index=True)
	password_hash = Column(String(255), nullable=False)
	name = Column(String(100), nullable=False)
	is_active = Column(Boolean, nullable=False, default=True)
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)
