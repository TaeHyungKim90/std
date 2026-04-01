import os
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
ENV_PATH = os.path.join(BASE_DIR, ".env")

# ---------------------------------------------------------------------------
# OAuth2 리다이렉트 URI
# - pydantic-settings: 환경 변수 `KAKAO_REDIRECT_URI`, `NAVER_REDIRECT_URI` 가 있으면
#   아래 개발용 기본값보다 우선합니다 (.env 또는 실행 환경에 주입).
# - 배포(스테이징/운영) 시: 반드시 실제 공개 API 도메인 + 콜백 경로로 .env 를 설정할 것.
#   예) https://api.example.com/api/auth/kakao/callback
#   미설정 채로 운영 배포하면 카카오/네이버 개발자 콘솔의 Redirect URI 와 불일치하여 로그인 실패합니다.
# ---------------------------------------------------------------------------
_DEV_KAKAO_REDIRECT_URI = "http://localhost:8000/api/auth/kakao/callback"
_DEV_NAVER_REDIRECT_URI = "http://localhost:8000/api/auth/naver/callback"


class Settings(BaseSettings):
	SECRET_KEY: str
	ALGORITHM: str = "HS256"
	#ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
	ACCESS_TOKEN_EXPIRE_DAYS: int = 1
	KAKAO_CLIENT_ID: str
	KAKAO_CLIENT_SECRET: str
	KAKAO_REDIRECT_URI: str = _DEV_KAKAO_REDIRECT_URI
	NAVER_CLIENT_ID: str
	NAVER_CLIENT_SECRET: str
	NAVER_REDIRECT_URI: str = _DEV_NAVER_REDIRECT_URI
	PUBLIC_DATA_API_KEY: str
	# 공공데이터포털(공휴일) API 엔드포인트. 필요 시 버전/도메인 변경을 .env로 대응.
	HOLIDAY_API_URL: str = "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
	ENVIRONMENT: str = "development"
	APP_PORT: int = 8000
	CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
	FRONTEND_URL: str = "http://localhost:3000"
	# 비어 있으면 SQLite 기본 경로(db/session.py). 예: postgresql+psycopg2://user:pass@localhost/todo
	DATABASE_URL: Optional[str] = None
	# True일 때만 admin/1234 기본 계정 자동 생성. 운영(ENVIRONMENT=production)에서는 반드시 False 권장.
	BOOTSTRAP_DEFAULT_ADMIN: bool = False
	# True일 때만 /uploads 를 정적 파일로 직접 노출. 운영에서는 False + /api/common/files/{id} 사용 권장.
	SERVE_UPLOADS_STATIC: bool = True
	# True일 때만 `python main.py` 실행 시 프론트 npm start를 함께 띄움. 운영·CI에서는 False.
	DEV_AUTO_START_REACT: bool = False
	# 레거시 공개 지원서 제출(/api/public/recruitment/apply) 허용 여부.
	# 운영에서는 False 권장(지원자 쿠키 세션 기반 /apply/me만 사용).
	ALLOW_LEGACY_PUBLIC_APPLY: bool = True
	# 레거시 지원자 API(/update/{applicant_id}, /my-applications/{applicant_id} 등) 허용 여부.
	# 운영에서는 False 권장(지원자 /me 기반 API만 사용).
	ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS: bool = True

	model_config = SettingsConfigDict(env_file=ENV_PATH)


settings = Settings()

# 배포 로그에 .env 절대 경로가 남지 않도록, 개발 환경에서만 경로 힌트 출력
if settings.ENVIRONMENT == "development":
	print(f"[config] ENVIRONMENT=development, .env 경로: {ENV_PATH}")
