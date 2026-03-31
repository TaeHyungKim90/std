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

# bcrypt 신규 해시 + 기존 DB(sha256_crypt) 검증 호환
pwd_context = CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated="auto")

# ==========================================
# 🔐 코어 보안 & 토큰 유틸리티
# ==========================================
def verify_password(plain_password: str, hashed_password: str) -> bool:
	"""비밀번호 검증"""
	return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
	"""비밀번호 단방향 암호화(해싱)"""
	return pwd_context.hash(password)


def looks_like_password_hash(value: str | None) -> bool:
	"""passlib 해시 문자열처럼 보이는지(레거시 평문 식별용)."""
	if not value:
		return False
	# bcrypt: $2a$/$2b$/$2y$
	if value.startswith("$2a$") or value.startswith("$2b$") or value.startswith("$2y$"):
		return True
	# passlib sha256_crypt
	if value.startswith("$sha256_crypt$"):
		return True
	return False

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