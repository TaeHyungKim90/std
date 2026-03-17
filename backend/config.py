import os
from pydantic_settings import BaseSettings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
print(f"🔍 지금 .env 파일을 찾는 위치: {ENV_PATH}")
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
    class Config:
        env_file = ENV_PATH

settings = Settings()
