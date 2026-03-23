# auth.py
import uuid
from core.config import settings
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from sqlalchemy.orm import Session
from db.session import get_db
from schemas import auth_schemas
from controllers import auth_controller

router = APIRouter()

@router.post("/login", response_model=auth_schemas.LoginResponse)
async def login(data: auth_schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    result = auth_controller.login(db, response, data.id, data.pw)
    return result

@router.post("/logout")
async def logout(response: Response):
    return auth_controller.logout(response)

@router.get("/check", response_model=auth_schemas.AuthCheckResponse)
async def check_auth(request: Request):
    return auth_controller.check_auth(request)

@router.post("/check-id", response_model=auth_schemas.CheckIdResponse)
async def check_id(data: auth_schemas.CheckIdRequest, db: Session = Depends(get_db)):
    return auth_controller.check_id(db, data.user_login_id)

@router.post("/signup")
async def signup(data: auth_schemas.UserCreate, db: Session = Depends(get_db)):
    return auth_controller.signup(db, data)

@router.get("/kakao/login")
async def kakao_login():
    """사용자를 카카오 로그인 페이지로 보내는 URL 생성"""
    kakao_auth_url = (
        f"https://kauth.kakao.com/oauth/authorize?"
        f"client_id={settings.KAKAO_CLIENT_ID}&"
        f"redirect_uri={settings.KAKAO_REDIRECT_URI}&"
        f"response_type=code"
    )
    return {"url": kakao_auth_url}

@router.get("/kakao/callback")
async def kakao_callback_handler(code: str,db: Session = Depends(get_db)):
    """카카오 인증 완료 후 돌아오는 지점"""
    # 2026년 기준 리다이렉트 시 보안 검증 로직이 포함될 수 있습니다.
    result = await auth_controller.kakao_callback(db, code)
    # 로그인 성공 후 프론트엔드 메인 페이지로 리다이렉트
    
    return result

@router.get("/naver/login")
async def naver_login():
    """네이버 로그인 창으로 보내는 URL 생성"""
    state = str(uuid.uuid4()) # 보안을 위한 랜덤 문자열 생성
    naver_auth_url = (
        f"https://nid.naver.com/oauth2.0/authorize?response_type=code"
        f"&client_id={settings.NAVER_CLIENT_ID}"
        f"&redirect_uri={settings.NAVER_REDIRECT_URI}"
        f"&state={state}"
    )
    return {"url": naver_auth_url}

@router.get("/naver/callback")
async def naver_callback_handler(code: str, state: str, db: Session = Depends(get_db)):
    """네이버 인증 완료 후 돌아오는 지점"""
    # 네이버는 state 값을 같이 돌려주므로 파라미터로 받아야 합니다.
    return await auth_controller.naver_callback(db, code, state)