import secrets
import re
from fastapi import Request, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models.auth_models import User
from models.tenant_models import Tenant
from schemas import auth_schemas
from core.security import verify_password, get_password_hash, decode_auth_token # 👈 분리된 보안 로직 임포트
from core.tenant import assert_token_tenant_matches, require_tenant, require_tenant_header_or_query

# 💡 핵심: auto_error=False로 설정하여 헤더에 토큰이 없어도 바로 터지지 않고 쿠키를 검사할 기회를 줍니다.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


# ==========================================
# 🛡️ 2. API 인증 의존성 (Middleware / Guards)
# ==========================================
def require_user_login_id(current_user: dict) -> str:
	uid = current_user.get("userId")
	if not isinstance(uid, str) or not uid.strip():
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="인증 정보가 올바르지 않습니다.",
		)
	return uid


async def get_current_user(request: Request, token: str | None = Depends(oauth2_scheme)):
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


async def get_current_user_for_tenant(
	current_user: dict = Depends(get_current_user),
	tenant: Tenant = Depends(require_tenant),
):
	"""JWT 테넌트와 요청 헤더(X-Tenant-Slug) 테넌트 일치 검증."""
	assert_token_tenant_matches(current_user, tenant)
	return current_user


async def get_current_user_for_tenant_media(
	current_user: dict = Depends(get_current_user),
	tenant: Tenant = Depends(require_tenant_header_or_query),
):
	"""파일·이미지 등 브라우저 서브리소스 요청용(헤더 또는 tenant 쿼리)."""
	assert_token_tenant_matches(current_user, tenant)
	return current_user


async def get_current_admin_for_tenant(
	current_user: dict = Depends(get_current_user_for_tenant),
):
	if current_user.get("role") != "admin":
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="관리자 권한이 없습니다.",
		)
	return current_user


# ==========================================
# 🧑‍💻 3. 비즈니스 로직 (DB 조작 - 로그인, 가입)
# ==========================================
def authenticate_user(db: Session, login_id: str, pw: str, tenant_id: int):
	"""일반 로그인 유저 검증 (테넌트 스코프)"""
	# 👈 수정된 부분: 소셜 계정은 일반 로그인 폼으로 접근 불가하도록 차단 (이중 보안)
	if login_id.startswith(("kakao_", "naver_")):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED, 
			detail="소셜 가입 계정입니다. 해당하는 소셜 로그인 버튼을 이용해주세요."
		)
	
	user = (
		db.query(User)
		.filter(User.user_login_id == login_id, User.tenant_id == tenant_id)
		.first()
	)
	if not user or not verify_password(pw, user.user_password):
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED, 
			detail="아이디 또는 비밀번호가 틀립니다."
		)
	return user

def check_user_exists(db: Session, login_id: str, tenant_id: int):
	"""아이디 중복 체크 (테넌트 내)"""
	return (
		db.query(User)
		.filter(User.user_login_id == login_id, User.tenant_id == tenant_id)
		.first()
		is not None
	)

def create_new_user(db: Session, user_data: auth_schemas.UserCreate, tenant_id: int):
	"""일반 회원가입 (신규 유저 DB 등록) — 권한은 항상 user 고정."""
	if check_user_exists(db, user_data.user_login_id, tenant_id):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 사용 중인 아이디입니다.")

	requested_role = (user_data.role or "user").strip()
	if requested_role != "user":
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="공개 회원가입으로 관리자 권한을 부여할 수 없습니다.",
		)

	hashed_password = get_password_hash(user_data.user_password)
	new_user = User(
		tenant_id=tenant_id,
		user_login_id=user_data.user_login_id,
		user_password=hashed_password,
		user_name=user_data.user_name,
		user_nickname=user_data.user_nickname,
		user_phone_number=user_data.user_phone_number,
		role="user",
		join_date=user_data.joined_at,
		resignation_date=user_data.resignation_date
	)
	
	try:
		db.add(new_user)
		db.commit()
		db.refresh(new_user)
		if user_data.joined_at is not None:
			from services.admin.user_service import sync_user_vacation

			sync_user_vacation(db, new_user)
			db.commit()
			db.refresh(new_user)
		return new_user
	except IntegrityError:
		db.rollback()
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="데이터베이스 오류로 가입에 실패했습니다.")

def process_social_login(
	db: Session,
	provider: str,
	provider_id: str,
	name: str,
	nickname: str,
	phone: str | None = None,
	*,
	tenant_id: int,
	allow_create: bool = True,
) -> tuple[User, bool]:
	"""소셜 로그인 유저 통합 관리 (카카오, 네이버 공통) — 테넌트별 계정"""
	user_login_id = f"{provider}_{provider_id}"
	user = (
		db.query(User)
		.filter(User.user_login_id == user_login_id, User.tenant_id == tenant_id)
		.first()
	)
	created = False

	clean_phone = None
	if phone:
		clean_phone = re.sub(r'[^\d]', '', phone)
		# 만약 국제번호 +82 10... 형식으로 들어오면 010...으로 변환 (선택 사항)
		if clean_phone.startswith('82'):
			clean_phone = '0' + clean_phone[2:]
	
	if not user and not allow_create:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="가입되지 않은 소셜 계정입니다. 회원가입 페이지에서 소셜 회원가입을 진행해 주세요.",
		)

	if not user:
		# 최초 소셜 로그인 시 자동 회원가입
		secure_random_password = secrets.token_urlsafe(32)
		hashed_password = get_password_hash(secure_random_password)
		user = User(
			tenant_id=tenant_id,
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
		created = True
	else:
		if not user.user_phone_number and clean_phone:
			user.user_phone_number = clean_phone
			db.commit()
		
	return user, created