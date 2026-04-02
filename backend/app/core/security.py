from datetime import datetime, timedelta, timezone
from typing import Any, cast

from jose import jwt, JWTError
from passlib.context import CryptContext
from core.config import settings

# ==========================================
# ⚙️ 환경 설정 및 보안 인스턴스 초기화
# ==========================================
# BaseSettings 필드 스텁이 str로 좁혀지지 않아 jwt key 인자와 맞지 않는 추론이 나므로 명시.
SECRET_KEY: str = cast(str, settings.SECRET_KEY)
ALGORITHM: str = cast(str, settings.ALGORITHM)
ACCESS_TOKEN_EXPIRE_DAYS: int = settings.ACCESS_TOKEN_EXPIRE_DAYS

# bcrypt 신규 해시 + 기존 DB(sha256_crypt) 검증 호환
pwd_context = CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated="auto")

# ==========================================
# 🔐 코어 보안 & 토큰 유틸리티
# ==========================================
def verify_password(plain_password: str, hashed_password: Any) -> bool:
	"""비밀번호 검증 (ORM password 컬럼 등 Any 허용)."""
	if hashed_password is None:
		return False
	return pwd_context.verify(plain_password, str(hashed_password))

def get_password_hash(password: str) -> str:
	"""비밀번호 단방향 암호화(해싱)"""
	return pwd_context.hash(password)


def looks_like_password_hash(value: Any) -> bool:
	"""passlib 해시 문자열처럼 보이는지(레거시 평문 식별용)."""
	if value is None:
		return False
	s = str(value).strip()
	if not s:
		return False
	# bcrypt: $2a$/$2b$/$2y$
	if s.startswith("$2a$") or s.startswith("$2b$") or s.startswith("$2y$"):
		return True
	# passlib sha256_crypt
	if s.startswith("$sha256_crypt$"):
		return True
	return False

def create_access_token(data: dict) -> str:
	"""JWT 토큰 생성"""
	to_encode = data.copy()
	expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
	to_encode.update({"exp": expire})
	return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_auth_token(token: str) -> dict | None:
	"""JWT 토큰 해독 (공통 헬퍼)"""
	try:
		return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
	except (JWTError, AttributeError):
		return None