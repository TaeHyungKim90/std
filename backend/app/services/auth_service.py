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
from utils.user_identity import (
	find_user_by_identity,
	normalize_birth_date,
	normalize_phone_number,
	normalize_user_name,
)

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


def _provider_column(provider: str) -> str:
	p = (provider or "").strip().lower()
	if p == "kakao":
		return "provider_kakao_id"
	if p == "naver":
		return "provider_naver_id"
	raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 소셜 provider 입니다.")


def is_provider_linked(user: User, provider: str) -> bool:
	col = _provider_column(provider)
	val = getattr(user, col, None)
	if val:
		return True
	login_id = str(user.user_login_id or "")
	return login_id.startswith(f"{provider}_")


def find_user_by_provider(db: Session, *, tenant_id: int, provider: str, provider_id: str) -> User | None:
	"""provider_*_id 컬럼 또는 레거시 user_login_id(kakao_/naver_)로 조회."""
	pid = str(provider_id or "").strip()
	if not pid:
		return None
	col = _provider_column(provider)
	user = (
		db.query(User)
		.filter(User.tenant_id == tenant_id, getattr(User, col) == pid)
		.first()
	)
	if user:
		return user
	legacy_login = f"{provider}_{pid}"
	return (
		db.query(User)
		.filter(User.user_login_id == legacy_login, User.tenant_id == tenant_id)
		.first()
	)


def set_provider_id(user: User, provider: str, provider_id: str) -> None:
	setattr(user, _provider_column(provider), str(provider_id))


def clear_provider_id(user: User, provider: str) -> None:
	setattr(user, _provider_column(provider), None)


# ==========================================
# 🧑‍💻 3. 비즈니스 로직 (DB 조작 - 로그인, 가입)
# ==========================================
def assert_user_approved(user: User) -> None:
	"""가입 승인 상태가 approved가 아니면 로그인 차단."""
	status_val = (getattr(user, "approval_status", None) or "approved").strip().lower()
	if status_val == "pending":
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="가입 승인 대기 중입니다. 관리자 승인 후 로그인해 주세요.",
		)
	if status_val == "rejected":
		raise HTTPException(
			status_code=status.HTTP_403_FORBIDDEN,
			detail="가입이 거절된 계정입니다.",
		)


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
	assert_user_approved(user)
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

	name = normalize_user_name(user_data.user_name)
	birth = normalize_birth_date(user_data.birth_date)
	phone = normalize_phone_number(user_data.user_phone_number)
	address = (user_data.address or "").strip() if getattr(user_data, "address", None) else ""
	if not name or not birth or not phone:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="이름, 생년월일, 전화번호는 필수입니다.",
		)
	if not address:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="주소를 입력해 주세요.",
		)

	existing = find_user_by_identity(
		db,
		tenant_id=tenant_id,
		user_name=name,
		birth_date=birth,
		phone_number=phone,
	)
	if existing:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="이미 가입된 계정이 있습니다.",
		)

	hashed_password = get_password_hash(user_data.user_password)
	new_user = User(
		tenant_id=tenant_id,
		user_login_id=user_data.user_login_id,
		user_password=hashed_password,
		user_name=name,
		user_nickname=user_data.user_nickname,
		user_phone_number=phone,
		birth_date=birth,
		address=address,
		role="user",
		approval_status="pending",
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
	birth_date: str | None = None,
	*,
	tenant_id: int,
	allow_create: bool = True,
) -> tuple[User, bool]:
	"""소셜 로그인 유저 통합 관리 (카카오, 네이버 공통) — 테넌트별 계정.

	1) provider_*_id / 레거시 login_id 로 기존 소셜 계정 조회
	2) 없으면 (이름·생년월일·전화) 신원으로 기존 계정 조회 후 provider 연동
	3) 그래도 없으면 allow_create 시 신규 생성
	"""
	provider = (provider or "").strip().lower()
	pid = str(provider_id or "").strip()
	if provider not in ("kakao", "naver") or not pid:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="소셜 계정 정보가 올바르지 않습니다.")

	clean_phone = normalize_phone_number(phone)
	clean_birth = normalize_birth_date(birth_date)
	clean_name = normalize_user_name(name)

	user = find_user_by_provider(db, tenant_id=tenant_id, provider=provider, provider_id=pid)
	created = False
	linked = False

	if not user and clean_name and clean_birth and clean_phone:
		matched = find_user_by_identity(
			db,
			tenant_id=tenant_id,
			user_name=clean_name,
			birth_date=clean_birth,
			phone_number=clean_phone,
		)
		if matched:
			# 이미 다른 소셜 ID가 같은 provider에 묶여 있으면 충돌
			existing_pid = getattr(matched, _provider_column(provider), None)
			if existing_pid and str(existing_pid) != pid:
				raise HTTPException(
					status_code=status.HTTP_409_CONFLICT,
					detail="이미 다른 소셜 계정과 연동된 사용자입니다.",
				)
			user = matched
			set_provider_id(user, provider, pid)
			linked = True

	if not user and not allow_create:
		raise HTTPException(
			status_code=status.HTTP_404_NOT_FOUND,
			detail="가입되지 않은 소셜 계정입니다. 회원가입 페이지에서 소셜 회원가입을 진행해 주세요.",
		)

	if not user:
		secure_random_password = secrets.token_urlsafe(32)
		hashed_password = get_password_hash(secure_random_password)
		user = User(
			tenant_id=tenant_id,
			user_login_id=f"{provider}_{pid}",
			user_password=hashed_password,
			user_name=clean_name or nickname or f"{provider}유저",
			user_nickname=nickname,
			user_phone_number=clean_phone,
			birth_date=clean_birth,
			role="user",
			approval_status="pending",
		)
		set_provider_id(user, provider, pid)
		db.add(user)
		db.commit()
		db.refresh(user)
		created = True
	else:
		changed = linked
		# 레거시 소셜 계정에 provider 컬럼 백필
		if not getattr(user, _provider_column(provider), None):
			set_provider_id(user, provider, pid)
			changed = True
		if not user.user_phone_number and clean_phone:
			user.user_phone_number = clean_phone
			changed = True
		if not user.birth_date and clean_birth:
			user.birth_date = clean_birth
			changed = True
		if changed:
			db.commit()
			db.refresh(user)
		# 기존 계정 로그인/연동 시에도 승인 상태 검사 (신규 생성 pending은 콜백에서 처리)
		assert_user_approved(user)

	return user, created


def complete_social_signup(
	db: Session,
	*,
	tenant_id: int,
	provider: str,
	provider_id: str,
	user_name: str,
	user_nickname: str | None,
	phone: str,
	birth_date: str,
	address: str,
) -> User:
	"""소셜 OAuth 티켓 검증 후 가입 완료 — 아이디/비번 서버 생성, pending."""
	provider = (provider or "").strip().lower()
	pid = str(provider_id or "").strip()
	if provider not in ("kakao", "naver") or not pid:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="소셜 계정 정보가 올바르지 않습니다.")

	clean_name = normalize_user_name(user_name)
	clean_phone = normalize_phone_number(phone)
	clean_birth = normalize_birth_date(birth_date)
	clean_address = (address or "").strip()
	nick = (user_nickname or "").strip() or None

	if not clean_name or not clean_phone or not clean_birth:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="이름, 생년월일, 전화번호는 필수입니다.",
		)
	if not clean_address:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="주소를 입력해 주세요.")

	existing = find_user_by_provider(db, tenant_id=tenant_id, provider=provider, provider_id=pid)
	if existing:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="이미 가입된 소셜 계정입니다. 로그인해 주세요.",
		)

	matched = find_user_by_identity(
		db,
		tenant_id=tenant_id,
		user_name=clean_name,
		birth_date=clean_birth,
		phone_number=clean_phone,
	)
	if matched:
		existing_pid = getattr(matched, _provider_column(provider), None)
		if existing_pid and str(existing_pid) != pid:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail="이미 다른 소셜 계정과 연동된 사용자입니다.",
			)
		# 동일 신원 기존 계정에 provider만 연동 (주소는 비어 있을 때만 채움)
		set_provider_id(matched, provider, pid)
		if not matched.address:
			matched.address = clean_address
		db.commit()
		db.refresh(matched)
		return matched

	secure_random_password = secrets.token_urlsafe(32)
	hashed_password = get_password_hash(secure_random_password)
	user = User(
		tenant_id=tenant_id,
		user_login_id=f"{provider}_{pid}",
		user_password=hashed_password,
		user_name=clean_name,
		user_nickname=nick or clean_name,
		user_phone_number=clean_phone,
		birth_date=clean_birth,
		address=clean_address,
		role="user",
		approval_status="pending",
	)
	set_provider_id(user, provider, pid)
	try:
		db.add(user)
		db.commit()
		db.refresh(user)
		return user
	except IntegrityError:
		db.rollback()
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="데이터베이스 오류로 가입에 실패했습니다.",
		)


def link_social_provider_to_user(
	db: Session,
	user: User,
	*,
	provider: str,
	provider_id: str,
) -> User:
	"""로그인 사용자에게 소셜 provider ID를 연동."""
	provider = (provider or "").strip().lower()
	pid = str(provider_id or "").strip()
	if provider not in ("kakao", "naver") or not pid:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="소셜 계정 정보가 올바르지 않습니다.")

	other = find_user_by_provider(db, tenant_id=user.tenant_id, provider=provider, provider_id=pid)
	if other and other.id != user.id:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="이미 다른 계정에 연동된 소셜 계정입니다.",
		)

	set_provider_id(user, provider, pid)
	db.commit()
	db.refresh(user)
	return user


def unlink_social_provider(db: Session, user: User, *, provider: str) -> User:
	"""소셜 연동 해제. 해당 provider로만 가입된 순수 소셜 계정은 해제 불가."""
	provider = (provider or "").strip().lower()
	if provider not in ("kakao", "naver"):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="지원하지 않는 소셜 provider 입니다.")

	if not is_provider_linked(user, provider):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="연동되지 않은 소셜 계정입니다.")

	login_id = str(user.user_login_id or "")
	# 로그인 ID 자체가 해당 소셜 전용인 경우 해제하면 로그인 수단이 사라질 수 있음
	if login_id.startswith(f"{provider}_"):
		other_linked = is_provider_linked(user, "naver" if provider == "kakao" else "kakao")
		# 비밀번호 로그인 불가(소셜 전용 login_id)이고 다른 소셜도 없으면 차단
		if not other_linked:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="이 계정은 해당 소셜로만 로그인할 수 있어 연동을 해제할 수 없습니다.",
			)

	clear_provider_id(user, provider)
	db.commit()
	db.refresh(user)
	return user
