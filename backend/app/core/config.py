import os
from typing import Optional

from pydantic_settings import BaseSettings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
ENV_PATH = os.path.join(BASE_DIR, ".env")


class Settings(BaseSettings):
	SECRET_KEY: str
	ALGORITHM: str = "HS256"
	#ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
	ACCESS_TOKEN_EXPIRE_DAYS: int = 1
	KAKAO_CLIENT_ID: str
	KAKAO_CLIENT_SECRET: str
	KAKAO_REDIRECT_URI: str = "http://localhost:8000/api/auth/kakao/callback"
	NAVER_CLIENT_ID: str
	NAVER_CLIENT_SECRET: str
	NAVER_REDIRECT_URI: str = "http://localhost:8000/api/auth/naver/callback"
	PUBLIC_DATA_API_KEY: str
	ENVIRONMENT: str = "development"
	CORS_ORIGINS: str = "http://localhost:3000,http://10.44.100.52:3000,http://127.0.0.1:3000"
	FRONTEND_URL: str = "http://localhost:3000"
	# 비어 있으면 SQLite 기본 경로(db/session.py). 예: postgresql+psycopg2://user:pass@localhost/todo
	DATABASE_URL: Optional[str] = None
	# True일 때만 admin/1234 기본 계정 자동 생성. 운영(ENVIRONMENT=production)에서는 반드시 False 권장.
	BOOTSTRAP_DEFAULT_ADMIN: bool = False

	class Config:
		env_file = ENV_PATH


settings = Settings()

# 배포 로그에 .env 절대 경로가 남지 않도록, 개발 환경에서만 경로 힌트 출력
if settings.ENVIRONMENT == "development":
	print(f"[config] ENVIRONMENT=development, .env 경로: {ENV_PATH}")
