import base64
import binascii
import hashlib
import hmac
import json
import uuid
import re
import time
from datetime import date, datetime
from urllib.parse import urlencode
import httpx
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload

from core.config import settings
from core.tenant import (
	get_tenant_by_slug,
	get_tenant_slug_header,
	normalize_tenant_slug,
	require_tenant,
	tenant_pk,
	tenant_slug_str,
)
from core.security import create_access_token, decode_auth_token, get_password_hash, verify_password
from core.limiter import limiter
from db.session import get_db
from models.auth_models import User, UserAvatarSetting
from models.system_models import Department, Position
from models.tenant_models import Tenant
from schemas import auth_schemas
from constants.bootstrap_admin import is_bootstrap_system_admin
from services.admin.user_service import sync_user_vacation
from services import auth_service as service

router = APIRouter()


def _user_response(user: User) -> auth_schemas.UserResponse:
	base = auth_schemas.UserResponse.model_validate(user)
	return base.model_copy(update={"join_date_editable": not is_bootstrap_system_admin(user)})


# ==========================================
# ⚙️ 환경 설정 및 공통 변수
# ==========================================
KAKAO_CLIENT_ID = settings.KAKAO_CLIENT_ID
KAKAO_CLIENT_SECRET = settings.KAKAO_CLIENT_SECRET
KAKAO_REDIRECT_URI = settings.KAKAO_REDIRECT_URI

NAVER_CLIENT_ID = settings.NAVER_CLIENT_ID
NAVER_CLIENT_SECRET = settings.NAVER_CLIENT_SECRET
NAVER_REDIRECT_URI = settings.NAVER_REDIRECT_URI

IS_PROD = settings.ENVIRONMENT == "production"

COOKIE_OPTIONS = {
	"key": "accessToken",
	"httponly": True,
	"max_age": settings.ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
	"samesite": "lax",
	"secure": IS_PROD,
	"path": "/",
}
def generate_user_token(user, *, tenant_slug: str | None = None):
	"""공통 헬퍼: JWT 토큰 생성 (tenantId/tenantSlug 포함)"""
	slug = tenant_slug
	if slug is None and getattr(user, "tenant", None) is not None:
		slug = user.tenant.slug
	token_data = {
		"userId": user.user_login_id,
		"userName": user.user_name,
		"userNickname": user.user_nickname,
		"role": user.role,
		"id": user.id,
		"tenantId": user.tenant_id,
		"tenantSlug": slug,
		"join_date": user.join_date.isoformat() if user.join_date else None,
		"resignation_date": user.resignation_date.isoformat() if user.resignation_date else None,
	}
	return create_access_token(token_data)


def _normalize_social_mode(mode: str | None) -> str:
	return "signup" if mode == "signup" else "login"


def _create_oauth_state(mode: str | None, tenant_slug: str) -> str:
	payload = {
		"nonce": str(uuid.uuid4()),
		"mode": _normalize_social_mode(mode),
		"tenant": tenant_slug,
		"iat": int(time.time()),
	}
	raw_payload = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
	encoded_payload = base64.urlsafe_b64encode(raw_payload).decode("ascii").rstrip("=")
	signature = hmac.new(
		settings.SECRET_KEY.encode("utf-8"),
		encoded_payload.encode("ascii"),
		hashlib.sha256,
	).digest()
	encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
	return f"{encoded_payload}.{encoded_signature}"


def _read_oauth_state(state: str) -> tuple[str, str]:
	try:
		encoded_payload, encoded_signature = state.split(".", 1)
		expected_signature = hmac.new(
			settings.SECRET_KEY.encode("utf-8"),
			encoded_payload.encode("ascii"),
			hashlib.sha256,
		).digest()
		actual_signature = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
		raw_payload = base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4))
		payload = json.loads(raw_payload.decode("utf-8"))
	except (binascii.Error, ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 OAuth state 입니다.")

	if not hmac.compare_digest(actual_signature, expected_signature):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 OAuth state 입니다.")

	try:
		issued_at = int(payload.get("iat") or 0)
	except (TypeError, ValueError):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 OAuth state 입니다.")
	if issued_at <= 0 or int(time.time()) - issued_at > 300:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth 인증 시간이 만료되었습니다. 다시 시도해 주세요.")
	tenant_slug = normalize_tenant_slug(payload.get("tenant"))
	if not tenant_slug:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth state에 테넌트 정보가 없습니다.")
	return _normalize_social_mode(payload.get("mode")), tenant_slug


def _oauth_callback_url(tenant_slug: str, **params: str) -> str:
	query = urlencode(params)
	base = f"{settings.FRONTEND_URL}/{tenant_slug}/oauth/callback"
	return f"{base}?{query}" if query else base


def _create_social_login_response(user, *, social_status: str, provider: str, tenant_slug: str):
	"""소셜 로그인 토큰 발급 후 프론트 콜백에 처리 결과를 전달합니다."""
	token = generate_user_token(user, tenant_slug=tenant_slug)
	response = RedirectResponse(
		url=_oauth_callback_url(tenant_slug, social_status=social_status, provider=provider)
	)
	response.set_cookie(value=token, **COOKIE_OPTIONS)
	return response


def _create_social_notice_response(*, social_status: str, provider: str, tenant_slug: str):
	return RedirectResponse(
		url=_oauth_callback_url(tenant_slug, social_status=social_status, provider=provider)
	)


def _process_social_callback(
	db: Session,
	*,
	provider: str,
	provider_id: str,
	name: str,
	nickname: str,
	phone: str | None,
	social_mode: str,
	tenant: Tenant,
):
	try:
		user, created = service.process_social_login(
			db,
			provider,
			provider_id,
			name,
			nickname,
			phone,
			tenant_id=tenant_pk(tenant),
			allow_create=social_mode == "signup",
		)
	except HTTPException as exc:
		if exc.status_code == status.HTTP_404_NOT_FOUND and social_mode == "login":
			return _create_social_notice_response(
				social_status="not_registered", provider=provider, tenant_slug=tenant_slug_str(tenant)
			)
		raise

	if social_mode == "signup" and not created:
		return _create_social_notice_response(
			social_status="already_registered", provider=provider, tenant_slug=tenant_slug_str(tenant)
		)
	return _create_social_login_response(
		user,
		social_status="signed_up" if created else "logged_in",
		provider=provider,
		tenant_slug=tenant_slug_str(tenant),
	)

# ==========================================
# 🚀 API 엔드포인트 (Router + Controller 통합)
# ==========================================

@router.post("/login", response_model=auth_schemas.LoginResponse)
@limiter.limit("5/minute")
async def login(
	request: Request,
	data: auth_schemas.LoginRequest,
	response: Response,
	db: Session = Depends(get_db),
	tenant: Tenant = Depends(require_tenant),
):
	"""일반 로그인: ID/PW 검증 후 쿠키와 토큰 반환 (테넌트 스코프)"""
	user = service.authenticate_user(db, data.id, data.pw, tenant_pk(tenant))

	token = generate_user_token(user, tenant_slug=tenant_slug_str(tenant))
	response.set_cookie(value=token, **COOKIE_OPTIONS)
	# access_token은 httpOnly 쿠키로만 전달 (응답 JSON에 넣지 않음 → XSS로 토큰 유출 방지)
	return {
		"success": True,
		"userName": user.user_name,
		"userNickname": user.user_nickname,
		"userId": user.user_login_id,
		"role": user.role,
		"join_date": user.join_date,
		"resignation_date": user.resignation_date,
		"mustChangePassword": bool(user.must_change_password),
	}

@router.post("/logout")
async def logout(response: Response):
	"""로그아웃: 쿠키 삭제"""
	delete_options = {k: v for k, v in COOKIE_OPTIONS.items() if k != "max_age"}
	response.delete_cookie(**delete_options)
	
	return {"success": True, "message": "로그아웃 되었습니다."}
def _optional_date_from_payload(value):
	"""JWT 등에서 온 날짜 문자열을 date로 변환 (없으면 None)."""
	if value is None:
		return None
	if isinstance(value, date):
		return value
	if isinstance(value, str):
		try:
			return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
		except ValueError:
			return None
	return None


def _auth_check_logged_out() -> dict:
	return {"isLoggedIn": False, "access_token": None}


def _token_matches_request_tenant(db: Session, payload: dict, tenant_slug: str | None) -> bool:
	"""X-Tenant-Slug 요청과 JWT tenantId가 다르면 이 테넌트에서는 비로그인 처리."""
	if not tenant_slug:
		return True
	token_tid = payload.get("tenantId")
	if token_tid is None:
		return False
	try:
		tenant = get_tenant_by_slug(db, tenant_slug)
	except HTTPException:
		return False
	return int(token_tid) == tenant_pk(tenant)


@router.get("/check", response_model=auth_schemas.AuthCheckResponse)
async def check_auth(
	request: Request,
	db: Session = Depends(get_db),
	tenant_slug: str | None = Depends(get_tenant_slug_header),
):
	"""인증 상태 확인: 헤더 또는 쿠키의 토큰 검증. 입사일/퇴사일은 DB 최신값 우선."""
	token = None
	auth_header = request.headers.get("Authorization")
	
	# 🌟 개선 2-1: 1단계 - 토큰부터 찾기 (헤더 먼저, 없으면 쿠키)
	if auth_header and auth_header.startswith("Bearer "):
		raw_token = auth_header.split(" ")[1]
		if raw_token and raw_token != "null":
			token = raw_token			

	# 헤더에 토큰이 없다면 쿠키에서 찾음
	if not token:
		token = request.cookies.get("accessToken") # COOKIE_OPTIONS["key"] 로 써도 좋습니다.

	# 🌟 개선 2-2: 2단계 - 토큰 해독은 딱 1번만!
	payload = decode_auth_token(token) if token else None

	# 3단계 - 검증 및 반환
	if not payload or not payload.get("userName"):
		return _auth_check_logged_out()
	if not _token_matches_request_tenant(db, payload, tenant_slug):
		return _auth_check_logged_out()

	join_date = None
	resignation_date = None
	user_profile_image_url = None
	avatar_zoom = 1.0
	avatar_offset_x = 0.0
	avatar_offset_y = 0.0
	user_name = payload.get("userName")
	user_nickname = payload.get("userNickname")
	user_role = payload.get("role")
	user_login_id = payload.get("userId")
	user_pk = payload.get("id")
	must_change_password = False
	if user_pk is not None:
		user = db.query(User).filter(User.id == user_pk).first()
		if user:
			user_name = user.user_name
			user_nickname = user.user_nickname
			user_role = user.role
			user_login_id = user.user_login_id
			join_date = user.join_date
			resignation_date = user.resignation_date
			user_profile_image_url = user.user_profile_image_url
			avatar_zoom = float(user.avatar_zoom)
			avatar_offset_x = float(user.avatar_offset_x)
			avatar_offset_y = float(user.avatar_offset_y)
			must_change_password = bool(user.must_change_password)
	if join_date is None:
		join_date = _optional_date_from_payload(payload.get("join_date"))
	if resignation_date is None:
		resignation_date = _optional_date_from_payload(payload.get("resignation_date"))

	return {
		"isLoggedIn": True,
		"userName": user_name,
		"userNickname": user_nickname,
		"role": user_role,
		"userId": user_login_id,
		"user_profile_image_url": user_profile_image_url,
		"avatar_zoom": avatar_zoom,
		"avatar_offset_x": avatar_offset_x,
		"avatar_offset_y": avatar_offset_y,
		"join_date": join_date,
		"resignation_date": resignation_date,
		"mustChangePassword": must_change_password,
	}

@router.post("/check-id", response_model=auth_schemas.CheckIdResponse)
async def check_id(
	data: auth_schemas.CheckIdRequest,
	db: Session = Depends(get_db),
	tenant: Tenant = Depends(require_tenant),
):
	"""아이디 중복 검사 (테넌트별)"""
	exists = service.check_user_exists(db, data.user_login_id, tenant_pk(tenant))
	return {"available": not exists}

@router.post("/signup")
async def signup(
	data: auth_schemas.UserCreate,
	db: Session = Depends(get_db),
	tenant: Tenant = Depends(require_tenant),
):
	"""회원 가입"""
	service.create_new_user(db, data, tenant_pk(tenant))
	return {"success": True, "message": "회원가입이 완료되었습니다."}


@router.get("/me", response_model=auth_schemas.UserResponse)
def get_my_profile(
	db: Session = Depends(get_db),
	current_user: dict = Depends(service.get_current_user_for_tenant),
):
	"""로그인 사용자 본인 정보 + 연차(UserVacation) 조회."""
	user_pk = current_user.get("id")
	if user_pk is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 올바르지 않습니다.")
	user = (
		db.query(User)
		.options(joinedload(User.vacation), joinedload(User.avatar_setting), joinedload(User.department), joinedload(User.position))
		.filter(User.id == user_pk)
		.first()
	)
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")
	sync_user_vacation(db, user)
	db.commit()
	refreshed_user = (
		db.query(User)
		.options(
			joinedload(User.vacation),
			joinedload(User.avatar_setting),
			joinedload(User.department),
			joinedload(User.position),
		)
		.filter(User.id == user_pk)
		.first()
	)
	return _user_response(refreshed_user or user)


@router.patch("/me", response_model=auth_schemas.UserResponse)
def patch_my_profile(
	body: auth_schemas.MeProfilePatch,
	db: Session = Depends(get_db),
	current_user: dict = Depends(service.get_current_user_for_tenant),
):
	"""로그인 사용자 본인 연락처·닉네임·비밀번호 수정 (비밀번호는 해시 저장)."""
	user_pk = current_user.get("id")
	if user_pk is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="인증 정보가 올바르지 않습니다.")
	user = (
		db.query(User)
		.options(joinedload(User.vacation), joinedload(User.avatar_setting), joinedload(User.department), joinedload(User.position))
		.filter(User.id == user_pk)
		.first()
	)
	if not user:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자를 찾을 수 없습니다.")

	data = body.model_dump(exclude_unset=True)
	login_id = str(user.user_login_id or "")
	is_social = login_id.startswith(("kakao_", "naver_"))

	if is_social and (data.get("current_password") or data.get("new_password")):
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.",
		)

	if data.get("new_password") or data.get("current_password"):
		if not data.get("new_password") or not data.get("current_password"):
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="비밀번호 변경 시 현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.",
			)
		if not verify_password(data["current_password"], user.user_password):
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="현재 비밀번호가 일치하지 않습니다.")
		if verify_password(data["new_password"], user.user_password):
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="새 비밀번호는 현재 비밀번호와 달라야 합니다.",
			)
		user.user_password = get_password_hash(data["new_password"])
		user.must_change_password = False

	if "user_nickname" in data:
		raw = data["user_nickname"]
		if raw is None:
			user.user_nickname = None
		else:
			s = str(raw).strip()
			user.user_nickname = s if s else None

	if "user_name" in data:
		raw = data["user_name"]
		s = str(raw or "").strip()
		if not s:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이름을 입력해 주세요.")
		user.user_name = s

	if "user_phone_number" in data:
		user.user_phone_number = data["user_phone_number"]

	avatar_zoom = data.pop("avatar_zoom", None)
	avatar_offset_x = data.pop("avatar_offset_x", None)
	avatar_offset_y = data.pop("avatar_offset_y", None)
	if avatar_zoom is not None or avatar_offset_x is not None or avatar_offset_y is not None:
		setting = db.query(UserAvatarSetting).filter(UserAvatarSetting.user_id == user.id).first()
		if not setting:
			setting = UserAvatarSetting(user_id=user.id)
			db.add(setting)
		if avatar_zoom is not None:
			setting.zoom = avatar_zoom
		if avatar_offset_x is not None:
			setting.offset_x = avatar_offset_x
		if avatar_offset_y is not None:
			setting.offset_y = avatar_offset_y

	# 사용자 프로필 확장 필드(부서/직급/급여계좌/사진 URL)
	if "user_profile_image_url" in data:
		user.user_profile_image_url = data["user_profile_image_url"] or None

	if "join_date" in data:
		if is_bootstrap_system_admin(user):
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="테넌트 운영용 admin 계정은 입사일을 변경할 수 없습니다.",
			)
		user.join_date = data["join_date"]
		sync_user_vacation(db, user)

	if "department_id" in data:
		if data["department_id"] is None:
			user.department_id = None
		else:
			dept = db.query(Department).filter(Department.id == data["department_id"]).first()
			if not dept:
				raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 부서입니다.")
			user.department_id = dept.id

	if "position_id" in data:
		if data["position_id"] is None:
			user.position_id = None
		else:
			pos = db.query(Position).filter(Position.id == data["position_id"]).first()
			if not pos:
				raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 직급입니다.")
			user.position_id = pos.id

	if "salary_bank_name" in data:
		raw = data["salary_bank_name"]
		user.salary_bank_name = str(raw).strip() if raw else None

	if "salary_account_number" in data:
		raw = data["salary_account_number"]
		if raw is None:
			user.salary_account_number = None
		else:
			# 숫자만 저장(입력값에 하이픈/공백이 섞여도 방어)
			s = re.sub(r"\D+", "", str(raw)).strip()
			user.salary_account_number = s if s else None

	db.commit()
	updated_user = (
		db.query(User)
		.options(joinedload(User.vacation), joinedload(User.avatar_setting), joinedload(User.department), joinedload(User.position))
		.filter(User.id == user_pk)
		.first()
	)
	return _user_response(updated_user or user)


# ==========================================
# 📱 소셜 로그인 연동 로직
# ==========================================

@router.get("/kakao/login")
async def kakao_login(
	mode: str | None = None,
	tenant: Tenant = Depends(require_tenant),
):
	"""사용자를 카카오 로그인 페이지로 보내는 URL 생성"""
	state = _create_oauth_state(mode, tenant_slug_str(tenant))
	kakao_auth_url = "https://kauth.kakao.com/oauth/authorize?" + urlencode({
		"client_id": KAKAO_CLIENT_ID,
		"redirect_uri": KAKAO_REDIRECT_URI,
		"response_type": "code",
		"state": state,
	})
	return {"url": kakao_auth_url}

@router.get("/kakao/callback")
async def kakao_callback_handler(
	code: str,
	state: str,
	db: Session = Depends(get_db),
):
	"""카카오 인증 완료 후 돌아오는 지점"""
	social_mode, tenant_slug = _read_oauth_state(state)
	tenant = get_tenant_by_slug(db, tenant_slug)

	async with httpx.AsyncClient() as client:
		token_res = await client.post("https://kauth.kakao.com/oauth/token", data={
			"grant_type": "authorization_code", "client_id": KAKAO_CLIENT_ID,
			"client_secret": KAKAO_CLIENT_SECRET, "redirect_uri": KAKAO_REDIRECT_URI, "code": code
		})
		access_token = token_res.json().get("access_token")
		user_res = await client.get("https://kapi.kakao.com/v2/user/me", headers={"Authorization": f"Bearer {access_token}"})
		user_info = user_res.json()

	kakao_id = str(user_info.get("id"))
	properties = user_info.get("properties", {})
	kakao_account = user_info.get("kakao_account", {})
	nickname = properties.get("nickname", "카카오유저")
	phone = kakao_account.get("phone_number")
	
	response = _process_social_callback(
		db,
		provider="kakao",
		provider_id=kakao_id,
		name=nickname,
		nickname=nickname,
		phone=phone,
		social_mode=social_mode,
		tenant=tenant,
	)
	response.delete_cookie(key="kakao_oauth_state", path="/")
	response.delete_cookie(key="kakao_oauth_mode", path="/")
	return response

@router.get("/naver/login")
async def naver_login(
	mode: str | None = None,
	tenant: Tenant = Depends(require_tenant),
):
	"""네이버 로그인 창으로 보내는 URL 생성"""
	state = _create_oauth_state(mode, tenant_slug_str(tenant))
	naver_auth_url = "https://nid.naver.com/oauth2.0/authorize?" + urlencode({
		"response_type": "code",
		"client_id": NAVER_CLIENT_ID,
		"redirect_uri": NAVER_REDIRECT_URI,
		"state": state,
	})
	return {"url": naver_auth_url}

@router.get("/naver/callback")
async def naver_callback_handler(
	code: str,
	state: str,
	db: Session = Depends(get_db),
):
	"""네이버 인증 완료 후 돌아오는 지점"""
	social_mode, tenant_slug = _read_oauth_state(state)
	tenant = get_tenant_by_slug(db, tenant_slug)

	async with httpx.AsyncClient() as client:
		token_res = await client.get("https://nid.naver.com/oauth2.0/token", params={
			"grant_type": "authorization_code", "client_id": NAVER_CLIENT_ID,
			"client_secret": NAVER_CLIENT_SECRET, "code": code, "state": state
		})
		access_token = token_res.json().get("access_token")
		user_res = await client.get("https://openapi.naver.com/v1/nid/me", headers={"Authorization": f"Bearer {access_token}"})
		user_info = user_res.json()

	naver_data = user_info.get("response", {})
	naver_id = naver_data.get("id")
	nickname = naver_data.get("nickname") or naver_data.get("name") or "네이버유저"
	name = naver_data.get("name")
	phone = naver_data.get("mobile")

	response = _process_social_callback(
		db,
		provider="naver",
		provider_id=naver_id,
		name=name,
		nickname=nickname,
		phone=phone,
		social_mode=social_mode,
		tenant=tenant,
	)
	response.delete_cookie(key="naver_oauth_state", path="/")
	response.delete_cookie(key="naver_oauth_mode", path="/")
	return response