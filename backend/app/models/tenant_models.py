from sqlalchemy import Boolean, Column, DateTime, Integer, String

from db.session import Base
from utils.seoul_time import now_seoul_naive


class Tenant(Base):
	"""SaaS 테넌트(기업) — URL 경로 slug로 식별 (예: /valuesplay, /naver)."""

	__tablename__ = "tenants"

	id = Column(Integer, primary_key=True, index=True)
	slug = Column(String(50), unique=True, nullable=False, index=True)
	name = Column(String(200), nullable=False)
	is_active = Column(Boolean, nullable=False, default=True)
	logo_url = Column(String(500), nullable=True)
	icon_url = Column(String(500), nullable=True)
	created_at = Column(DateTime, nullable=False, default=now_seoul_naive)
