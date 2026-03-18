import secrets
import re
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Request, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from config import settings
from app.models.auth_models import User
from app.schemas import auth_schemas

# ==========================================
# ⚙️ 0. 환경 설정 및 보안 인스턴스 초기화
# ==========================================
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_DAYS = settings.ACCESS_TOKEN_EXPIRE_DAYS

# 비밀번호 해싱 도구
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

# 💡 핵심: auto_error=False로 설정하여 헤더에 토큰이 없어도 바로 터지지 않고 쿠키를 검사할 기회를 줍니다.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


# ==========================================
# 🔐 1. 코어 보안 & 토큰 유틸리티
# ==========================================
def verify_password(plain_password, hashed_password):
    """비밀번호 검증"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """비밀번호 단방향 암호화(해싱)"""
    return pwd_context.hash(password)

def create_access_token(data: dict):
    """JWT 토큰 생성"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_auth_token(token: str):
    """JWT 토큰 해독 (공통 헬퍼)"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except (JWTError, AttributeError):
        return None


# ==========================================
# 🛡️ 2. API 인증 의존성 (Middleware / Guards)
# ==========================================
async def get_current_user(request: Request, token: str = Depends(oauth2_scheme)):
    """
    모든 API 요청 시 사용자 신분을 확인하는 핵심 문지기
    (토큰 우선 검사, 없으면 편의상 쿠키 검사)
    """
    # 🥇 1순위: 헤더의 Bearer 토큰 / 🥈 2순위: 쿠키의 accessToken
    if not token:
        token = request.cookies.get("accessToken")
        
    # 둘 다 없으면 컷!
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="인증 정보가 없습니다."
        )

    # 토큰 해독 로직 재사용
    payload = decode_auth_token(token)
    if not payload or not payload.get("userId"):
        raise HTTPException(status_code=401, detail="유효하지 않거나 만료된 토큰입니다.")
        
    return payload # 유저 정보가 담긴 payload 반환

def get_current_admin(current_user: dict = Depends(get_current_user)):
    """
    현재 로그인한 사용자가 관리자(admin)인지 검증하는 2차 문지기
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="관리자 권한이 없습니다."
        )
    return current_user


# ==========================================
# 🧑‍💻 3. 비즈니스 로직 (DB 조작 - 로그인, 가입)
# ==========================================
def authenticate_user(db: Session, login_id: str, pw: str):
    """일반 로그인 유저 검증"""
    # 👈 수정된 부분: 소셜 계정은 일반 로그인 폼으로 접근 불가하도록 차단 (이중 보안)
    if login_id.startswith(("kakao_", "naver_")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="소셜 가입 계정입니다. 해당하는 소셜 로그인 버튼을 이용해주세요."
        )
    
    user = db.query(User).filter(User.user_login_id == login_id).first()
    if not user or not verify_password(pw, user.user_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="아이디 또는 비밀번호가 틀립니다."
        )
    return user

def check_user_exists(db: Session, login_id: str):
    """아이디 중복 체크"""
    return db.query(User).filter(User.user_login_id == login_id).first() is not None

def create_new_user(db: Session, user_data: auth_schemas.UserCreate):
    """일반 회원가입 (신규 유저 DB 등록)"""
    if check_user_exists(db, user_data.user_login_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 사용 중인 아이디입니다.")
    
    hashed_password = get_password_hash(user_data.user_password)
    new_user = User(
        user_login_id=user_data.user_login_id,
        user_password=hashed_password,
        user_name=user_data.user_name,
        user_nickname=user_data.user_nickname,
        user_phone_number=user_data.user_phone_number,
        role=user_data.role or "user",
        join_date=user_data.join_date,
        resignation_date=user_data.resignation_date
    )
    
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="데이터베이스 오류로 가입에 실패했습니다.")

def process_social_login(db: Session, provider: str, provider_id: str, name: str, nickname: str, phone: str = None):
    """소셜 로그인 유저 통합 관리 (카카오, 네이버 공통)"""
    user_login_id = f"{provider}_{provider_id}"
    user = db.query(User).filter(User.user_login_id == user_login_id).first()

    clean_phone = None
    if phone:
        clean_phone = re.sub(r'[^\d]', '', phone)
        # 만약 국제번호 +82 10... 형식으로 들어오면 010...으로 변환 (선택 사항)
        if clean_phone.startswith('82'):
            clean_phone = '0' + clean_phone[2:]
    
    if not user:
        # 최초 소셜 로그인 시 자동 회원가입
        secure_random_password = secrets.token_urlsafe(32)
        hashed_password = get_password_hash(secure_random_password)
        user = User(
            user_login_id=user_login_id,
            user_password=hashed_password, 
            user_name=name,
            user_nickname=nickname,
            user_phone_number=clean_phone,
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.user_phone_number and clean_phone:
            user.user_phone_number = clean_phone
            db.commit()
        
    return user