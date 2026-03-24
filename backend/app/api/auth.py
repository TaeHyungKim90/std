import uuid
import httpx
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from core.config import settings
from core.security import create_access_token, decode_auth_token
from db.session import get_db
from schemas import auth_schemas
from services import auth_service as service

router = APIRouter(tags=["Auth"])

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
    "max_age": 24 * 60 * 60,
    "samesite": "lax",
    "secure": IS_PROD,
    "path": "/"
}

def _create_social_login_response(user):
    """💡 공통 헬퍼 함수: 소셜 로그인 토큰 발급 & 쿠키 세팅"""
    token_data = {
        "userId": user.user_login_id, "userName": user.user_name,
        "userNickname": user.user_nickname, "role": user.role
    }
    token = create_access_token(token_data)
    response = RedirectResponse(url="http://localhost:3000/")
    response.set_cookie(value=token, **COOKIE_OPTIONS)
    return response

# ==========================================
# 🚀 API 엔드포인트 (Router + Controller 통합)
# ==========================================

@router.post("/login", response_model=auth_schemas.LoginResponse)
async def login(data: auth_schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    """일반 로그인: ID/PW 검증 후 쿠키와 토큰 반환"""
    user = service.authenticate_user(db, data.id, data.pw)
    
    token_data = {
        "userId": user.user_login_id, "userName": user.user_name,
        "userNickname": user.user_nickname, "role": user.role
    }
    token = create_access_token(token_data)
    response.set_cookie(value=token, **COOKIE_OPTIONS)
    
    return {
        "success": True, "access_token": token, "userName": user.user_name,
        "userNickname": user.user_nickname, "userId": user.user_login_id, "role": user.role
    }

@router.post("/logout")
async def logout(response: Response):
    """로그아웃: 쿠키 삭제"""
    response.delete_cookie(
        key=COOKIE_OPTIONS["key"], httponly=COOKIE_OPTIONS["httponly"],
        path=COOKIE_OPTIONS["path"], samesite=COOKIE_OPTIONS["samesite"], secure=COOKIE_OPTIONS["secure"],
    )
    return {"success": True, "message": "로그아웃 되었습니다."}

@router.get("/check", response_model=auth_schemas.AuthCheckResponse)
async def check_auth(request: Request):
    """인증 상태 확인: 헤더 또는 쿠키의 토큰 검증"""
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
        if raw_token and raw_token != "null":
            token = raw_token            

    payload = decode_auth_token(token) if token else None

    if not payload:
        cookie_token = request.cookies.get("accessToken")
        if cookie_token:
            token = cookie_token
            payload = decode_auth_token(token)

    if not payload or not payload.get("userName"):
        return {"isLoggedIn": False, "access_token": None}

    return {
        "isLoggedIn": True, 
        "userName": payload.get("userName"),
        "userNickname": payload.get("userNickname"), 
        "role": payload.get("role"),
        "access_token": token,
        "userId": payload.get("userId")
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
async def kakao_login():
    """사용자를 카카오 로그인 페이지로 보내는 URL 생성"""
    kakao_auth_url = (
        f"https://kauth.kakao.com/oauth/authorize?"
        f"client_id={KAKAO_CLIENT_ID}&"
        f"redirect_uri={KAKAO_REDIRECT_URI}&"
        f"response_type=code"
    )
    return {"url": kakao_auth_url}

@router.get("/kakao/callback")
async def kakao_callback_handler(code: str, db: Session = Depends(get_db)):
    """카카오 인증 완료 후 돌아오는 지점"""
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
    return _create_social_login_response(user)

@router.get("/naver/login")
async def naver_login():
    """네이버 로그인 창으로 보내는 URL 생성"""
    state = str(uuid.uuid4())
    naver_auth_url = (
        f"https://nid.naver.com/oauth2.0/authorize?response_type=code"
        f"&client_id={NAVER_CLIENT_ID}"
        f"&redirect_uri={NAVER_REDIRECT_URI}"
        f"&state={state}"
    )
    return {"url": naver_auth_url}

@router.get("/naver/callback")
async def naver_callback_handler(code: str, state: str, db: Session = Depends(get_db)):
    """네이버 인증 완료 후 돌아오는 지점"""
    async with httpx.AsyncClient() as client:
        token_res = await client.get("https://nid.naver.com/oauth2.0/token", params={
            "grant_type": "authorization_code", "client_id": NAVER_CLIENT_ID,
            "client_secret": NAVER_CLIENT_SECRET, "code": code, "state": state
        })
        access_token = token_res.json().get("access_token")
        user_res = await client.get("https://openapi.naver.com/v1/nid/me", headers={"Authorization": f"Bearer {access_token}"})
        user_info = user_res.json().get("response", {})

    naver_data = user_info.get("response", {})
    naver_id = naver_data.get("id")
    nickname = naver_data.get("nickname") or naver_data.get("name") or "네이버유저"
    name = naver_data.get("name")
    phone = naver_data.get("mobile")

    # DB 조회 및 자동가입
    user = service.process_social_login(db, "naver", naver_id, name, nickname, phone)
    return _create_social_login_response(user)