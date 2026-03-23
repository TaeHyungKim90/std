from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from core.config import settings

# ==========================================
# ⚙️ 환경 설정 및 보안 인스턴스 초기화
# ==========================================
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_DAYS = settings.ACCESS_TOKEN_EXPIRE_DAYS

# 비밀번호 해싱 도구 (기존 사용자 호환성을 위해 sha256_crypt 유지)
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# ==========================================
# 🔐 코어 보안 & 토큰 유틸리티
# ==========================================
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """비밀번호 단방향 암호화(해싱)"""
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    """JWT 토큰 생성"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_auth_token(token: str) -> dict | None:
    """JWT 토큰 해독 (공통 헬퍼)"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except (JWTError, AttributeError):
        return None