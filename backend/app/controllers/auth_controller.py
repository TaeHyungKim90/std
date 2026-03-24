# app/controller/auth_controller.py
from fastapi.responses import RedirectResponse
import httpx
from fastapi import Response, Request
from schemas import auth_schemas
from services import auth_service
from sqlalchemy.orm import Session
from core.config import settings
from core.security import create_access_token, decode_auth_token
KAKAO_CLIENT_ID = settings.KAKAO_CLIENT_ID
KAKAO_CLIENT_SECRET = settings.KAKAO_CLIENT_SECRET
KAKAO_REDIRECT_URI = settings.KAKAO_REDIRECT_URI

NAVER_CLIENT_ID = settings.NAVER_CLIENT_ID
NAVER_CLIENT_SECRET = settings.NAVER_CLIENT_SECRET
IS_PROD = settings.ENVIRONMENT == "production"

COOKIE_OPTIONS = {
    "key": "accessToken",
    "httponly": True,
    "max_age": 24 * 60 * 60,
    "samesite": "lax",
    "secure": IS_PROD,
    "path": "/"
}

# --- 💡 공통 헬퍼 함수: 소셜 로그인 토큰 발급 & 쿠키 세팅 (중복 완벽 제거) ---
def _create_social_login_response(user):
    token_data = {
        "userId": user.user_login_id, "userName": user.user_name,
        "userNickname": user.user_nickname, "role": user.role
    }
    token = create_access_token(token_data)
    response = RedirectResponse(url="http://localhost:3000/")
    response.set_cookie(value=token, **COOKIE_OPTIONS)
    return response

# ==========================================
# 🚀 컨트롤러 (라우팅 로직)
# ==========================================

def login(db: Session, response: Response, login_id: str, pw: str):
    user = auth_service.authenticate_user(db, login_id, pw) # 서비스로 로직 위임
    
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

def logout(response: Response):
    response.delete_cookie(
        key=COOKIE_OPTIONS["key"], httponly=COOKIE_OPTIONS["httponly"],
        path=COOKIE_OPTIONS["path"], samesite=COOKIE_OPTIONS["samesite"], secure=COOKIE_OPTIONS["secure"],
    )
    return {"success": True, "message": "로그아웃 되었습니다."}

def check_auth(request: Request):
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
        if raw_token and raw_token != "null": # "null" 문자열 방어
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

def check_id(db: Session, login_id: str):
    exists = auth_service.check_user_exists(db, login_id)
    return {"available": not exists}

def signup(db: Session, user_data: auth_schemas.UserCreate):
    auth_service.create_new_user(db, user_data)
    return {"success": True, "message": "회원가입이 완료되었습니다."}

# --- 소셜 로그인 컨트롤러 ---
async def kakao_callback(db: Session, code: str):
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
    user = auth_service.process_social_login(db, "kakao", kakao_id, nickname, nickname, phone)
    return _create_social_login_response(user)

async def naver_callback(db: Session, code: str, state: str):
    async with httpx.AsyncClient() as client:
        token_res = await client.get("https://nid.naver.com/oauth2.0/token", params={
            "grant_type": "authorization_code", "client_id": NAVER_CLIENT_ID,
            "client_secret": NAVER_CLIENT_SECRET, "code": code, "state": state
        })
        access_token = token_res.json().get("access_token")
        user_res = await client.get("https://openapi.naver.com/v1/nid/me", headers={"Authorization": f"Bearer {access_token}"})
        user_info = user_res.json().get("response", {})
        
    print("user_info:",user_info)
    naver_data = user_info.get("response", {})
    naver_id = naver_data.get("id")
    nickname = naver_data.get("nickname") or naver_data.get("name") or "네이버유저"
    name = naver_data.get("name")
    phone = naver_data.get("mobile")

    # DB 조회 및 자동가입 로직은 Service에 맡깁니다.
    user = auth_service.process_social_login(db, "naver", naver_id, name, nickname, phone)
    return _create_social_login_response(user)