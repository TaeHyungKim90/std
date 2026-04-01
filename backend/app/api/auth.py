import uuid
from datetime import date, datetime
import httpx
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from core.config import settings
from core.security import create_access_token, decode_auth_token
from core.limiter import limiter
from db.session import get_db
from models.auth_models import User
from schemas import auth_schemas
from services import auth_service as service

router = APIRouter()

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
def generate_user_token(user):
	"""💡 공통 헬퍼 함수: 유저 객체로 JWT 토큰 생성"""
	token_data = {
		"userId": user.user_login_id, 
		"userName": user.user_name,
		"userNickname": user.user_nickname, 
		"role": user.role, 
		"id": user.id,
		"join_date": user.join_date.isoformat() if user.join_date else None,
		"resignation_date": user.resignation_date.isoformat() if user.resignation_date else None,
	}
	return create_access_token(token_data)
def _create_social_login_response(user):
	"""💡 공통 헬퍼 함수: 소셜 로그인 토큰 발급 & 쿠키 세팅"""
	
	token = generate_user_token(user)
	response = RedirectResponse(url=f"{settings.FRONTEND_URL}/oauth/callback")
	response.set_cookie(value=token, **COOKIE_OPTIONS)
	return response

# ==========================================
# 🚀 API 엔드포인트 (Router + Controller 통합)
# ==========================================

@router.post("/login", response_model=auth_schemas.LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: auth_schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
	"""일반 로그인: ID/PW 검증 후 쿠키와 토큰 반환"""
	user = service.authenticate_user(db, data.id, data.pw)
	
	token = generate_user_token(user)
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


@router.get("/check", response_model=auth_schemas.AuthCheckResponse)
async def check_auth(request: Request, db: Session = Depends(get_db)):
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
		return {"isLoggedIn": False, "access_token": None}

	join_date = None
	resignation_date = None
	user_pk = payload.get("id")
	if user_pk is not None:
		user = db.query(User).filter(User.id == user_pk).first()
		if user:
			join_date = user.join_date
			resignation_date = user.resignation_date
	if join_date is None:
		join_date = _optional_date_from_payload(payload.get("join_date"))
	if resignation_date is None:
		resignation_date = _optional_date_from_payload(payload.get("resignation_date"))

	return {
		"isLoggedIn": True,
		"userName": payload.get("userName"),
		"userNickname": payload.get("userNickname"),
		"role": payload.get("role"),
		"userId": payload.get("userId"),
		"join_date": join_date,
		"resignation_date": resignation_date,
	}

@router.post("/check-id", response_model=auth_schemas.CheckIdResponse)
async def check_id(data: auth_schemas.CheckIdRequest, db: Session = Depends(get_db)):
	"""아이디 중복 검사"""
	exists = service.check_user_exists(db, data.user_login_id)
	return {"available": not exists}

@router.post("/signup")
async def signup(data: auth_schemas.UserCreate, db: Session = Depends(get_db)):
	"""회원 가입"""
	service.create_new_user(db, data)
	return {"success": True, "message": "회원가입이 완료되었습니다."}

# ==========================================
# 📱 소셜 로그인 연동 로직
# ==========================================

@router.get("/kakao/login")
async def kakao_login(response: Response):
	"""사용자를 카카오 로그인 페이지로 보내는 URL 생성"""
	state = str(uuid.uuid4())
	response.set_cookie(
		key="kakao_oauth_state",
		value=state,
		httponly=True,
		secure=IS_PROD,
		samesite="lax",
		max_age=300,
		path="/",
	)
	kakao_auth_url = (
		f"https://kauth.kakao.com/oauth/authorize?"
		f"client_id={KAKAO_CLIENT_ID}&"
		f"redirect_uri={KAKAO_REDIRECT_URI}&"
		f"response_type=code&"
		f"state={state}"
	)
	return {"url": kakao_auth_url}

@router.get("/kakao/callback")
async def kakao_callback_handler(
	code: str,
	state: str,
	request: Request,
	db: Session = Depends(get_db),
):
	"""카카오 인증 완료 후 돌아오는 지점"""
	cookie_state = request.cookies.get("kakao_oauth_state")
	if not cookie_state or cookie_state != state:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 OAuth state 입니다.")

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
	
	# DB 조회 및 자동가입 로직은 Service에 맡깁니다.
	user = service.process_social_login(db, "kakao", kakao_id, nickname, nickname, phone)
	response = _create_social_login_response(user)
	response.delete_cookie(key="kakao_oauth_state", path="/")
	return response

@router.get("/naver/login")
async def naver_login(response: Response):
	"""네이버 로그인 창으로 보내는 URL 생성"""
	state = str(uuid.uuid4())
	# OAuth CSRF 방어: 콜백에서 검증할 state를 httpOnly 쿠키로 보관
	response.set_cookie(
		key="naver_oauth_state",
		value=state,
		httponly=True,
		secure=IS_PROD,
		samesite="lax",
		max_age=300,
		path="/",
	)
	naver_auth_url = (
		f"https://nid.naver.com/oauth2.0/authorize?response_type=code"
		f"&client_id={NAVER_CLIENT_ID}"
		f"&redirect_uri={NAVER_REDIRECT_URI}"
		f"&state={state}"
	)
	return {"url": naver_auth_url}

@router.get("/naver/callback")
async def naver_callback_handler(
	code: str,
	state: str,
	request: Request,
	db: Session = Depends(get_db),
):
	"""네이버 인증 완료 후 돌아오는 지점"""
	cookie_state = request.cookies.get("naver_oauth_state")
	if not cookie_state or cookie_state != state:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 OAuth state 입니다.")

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

	# DB 조회 및 자동가입
	user = service.process_social_login(db, "naver", naver_id, name, nickname, phone)
	response = _create_social_login_response(user)
	response.delete_cookie(key="naver_oauth_state", path="/")
	return response