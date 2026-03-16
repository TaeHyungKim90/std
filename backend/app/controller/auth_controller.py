from fastapi.responses import RedirectResponse
import httpx
from fastapi import Response, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from app.schemas import auth_schemas
from app.services import auth_service
from app.models.auth_models import User
from sqlalchemy.orm import Session
from jose import JWTError
from config import settings
#환경변수 로드
KAKAO_CLIENT_ID = settings.KAKAO_CLIENT_ID
KAKAO_CLIENT_SECRET = settings.KAKAO_CLIENT_SECRET
KAKAO_REDIRECT_URI = settings.KAKAO_REDIRECT_URI

# 1. 공통 쿠키 옵션 관리 (일관성 유지)
COOKIE_OPTIONS = {
    "key": "accessToken",
    "httponly": True,
    "max_age": 24 * 60 * 60,
    "samesite": "lax",  # 개발 시 lax, 운영 시 none
    "secure": False,    # 개발 시 False, 운영(HTTPS) 시 True
    "path": "/"
}

def login(db: Session, response: Response, login_id: str, pw: str):
    user = db.query(User).filter(User.user_login_id == login_id).first()
    
    # 2. 상세한 에러 처리 (status_code 활용)
    if not user or not auth_service.verify_password(pw, user.user_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="아이디 또는 비밀번호가 틀립니다."
        )

    token_data = {
        "userId": user.user_login_id,
        "userName": user.user_name,
        "userNickname": user.user_nickname,
        "role": user.role
    }
    token = auth_service.create_access_token(token_data)
    print(f"생성된 토큰 확인: {token}")
    # 3. 쿠키 설정 (옵션 언패킹 사용)
    response.set_cookie(value=token, **COOKIE_OPTIONS)
    
    return {
        "success": True,
        "access_token": token,
        "userName": user.user_name,
        "userNickname": user.user_nickname,
        "userId":user.user_login_id,
        "role": user.role
    }

def logout(response: Response):
    # 4. 삭제 시에도 동일 옵션 적용 (value는 비우고 max_age는 0으로)
    response.delete_cookie(
        key=COOKIE_OPTIONS["key"],
        httponly=COOKIE_OPTIONS["httponly"],
        path=COOKIE_OPTIONS["path"], 
        samesite=COOKIE_OPTIONS["samesite"],
        secure=COOKIE_OPTIONS["secure"],
    )
    return {"success": True, "message": "로그아웃 되었습니다."}

def check_auth(request: Request):
    token = request.cookies.get("accessToken")
    if not token:
        return {"isLoggedIn": False, "access_token": None}
    
    try:
        # 5. jwt 모듈 직접 참조 대신 서비스 레이어 활용 권장
        payload = auth_service.jwt.decode(
            token, 
            auth_service.SECRET_KEY, 
            algorithms=[auth_service.ALGORITHM]
        )
        
        # 데이터가 정상적으로 들어있는지 확인
        user_name = payload.get("userName")
        if not user_name:
            return {"isLoggedIn": False, "access_token": None}

        return {
            "isLoggedIn": True,
            "userName": user_name,
            "userNickname": payload.get("userNickname"),
            "role": payload.get("role"),
            "access_token": token,
            "userId":payload.get("userId")
        }
    except (JWTError, AttributeError):
        return {"isLoggedIn": False, "access_token": None}

def check_id(db: Session, login_id: str):
    """아이디 중복 확인 로직"""
    # DB에 동일한 아이디가 있는지 검색
    existing_user = db.query(User).filter(User.user_login_id == login_id).first()
    # 유저가 없으면(None) 사용 가능(True)
    return {"available": existing_user is None}

def signup(db: Session, user_data: auth_schemas.UserCreate):
    """회원가입 처리 로직"""
    # 1. 혹시 모를 중복 가입 방지 (2차 검증)
    existing_user = db.query(User).filter(User.user_login_id == user_data.user_login_id).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 사용 중인 아이디입니다.")
    
    # 2. 비밀번호 해싱 (암호화)
    hashed_password = auth_service.get_password_hash(user_data.user_password)
    
    # 3. DB 모델 생성 (role은 기본적으로 'user' 적용)
    new_user = User(
        user_login_id=user_data.user_login_id,
        user_password=hashed_password,
        user_name=user_data.user_name,
        user_nickname=user_data.user_nickname,
        role=user_data.role or "user" 
    )
    
    # 4. DB에 저장
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"success": True, "message": "회원가입이 완료되었습니다."}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="데이터베이스 오류로 가입에 실패했습니다.")

async def kakao_callback(db: Session, code: str):
    # 1. 인가 코드로 토큰 요청
    token_url = "https://kauth.kakao.com/oauth/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": KAKAO_CLIENT_ID,
        "client_secret": KAKAO_CLIENT_SECRET,
        "redirect_uri": KAKAO_REDIRECT_URI,
        "code": code
    }
    
    async with httpx.AsyncClient() as client:
        token_res = await client.post(token_url, data=data)
        token_data = token_res.json()
        access_token = token_data.get("access_token")

        # 2. 토큰으로 유저 정보 요청
        user_info_url = "https://kapi.kakao.com/v2/user/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_res = await client.get(user_info_url, headers=headers)
        user_info = user_res.json()

    # 3. 우리 DB에서 유저 확인 또는 자동 가입
    kakao_id = str(user_info.get("id"))
    nickname = user_info.get("properties", {}).get("nickname")
    
    # 카카오 ID를 login_id로 사용 (중복 방지를 위해 kakao_ 접두어 활용)
    user_login_id = f"kakao_{kakao_id}"
    user = db.query(User).filter(User.user_login_id == user_login_id).first()

    if not user:
        # 가입된 적 없으면 신규 생성
        user = User(
            user_login_id=user_login_id,
            user_password="social_login_dummy", # 소셜은 비번 불필요
            user_name=nickname,
            user_nickname=nickname,
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 4. 우리 서비스 전용 JWT 토큰 발행 및 쿠키 설정
    # 이전 로그인 로직과 동일하게 처리합니다.
    token_data = {
        "userId": user.user_login_id,
        "userName": user.user_name,
        "userNickname": user.user_nickname,
        "role": user.role
    }
    token = auth_service.create_access_token(token_data)
    response=RedirectResponse(url="http://localhost:3000/")
    response.set_cookie(value=token, **COOKIE_OPTIONS)

    return response

async def naver_callback(db: Session, code: str, state: str):
    # 1. 인가 코드로 토큰 요청 (네이버는 파라미터로 데이터를 보냅니다)
    token_url = "https://nid.naver.com/oauth2.0/token"
    params = {
        "grant_type": "authorization_code",
        "client_id": settings.NAVER_CLIENT_ID,
        "client_secret": settings.NAVER_CLIENT_SECRET,
        "code": code,
        "state": state
    }
    
    async with httpx.AsyncClient() as client:
        token_res = await client.get(token_url, params=params)
        token_data = token_res.json()
        access_token = token_data.get("access_token")

        # 2. 토큰으로 유저 정보 요청
        user_info_url = "https://openapi.naver.com/v1/nid/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        user_res = await client.get(user_info_url, headers=headers)
        
        # 네이버는 json 안에 'response'라는 딕셔너리가 한 겹 더 있습니다.
        user_info = user_res.json().get("response", {})

    # 3. 우리 DB에서 유저 확인 또는 자동 가입
    naver_id = user_info.get("id")
    nickname = user_info.get("nickname") or user_info.get("name") or "네이버유저"
    name = user_info.get("name")
    # 네이버 ID를 login_id로 사용 (중복 방지를 위해 naver_ 접두어 활용)
    user_login_id = f"naver_{naver_id}"
    user = db.query(User).filter(User.user_login_id == user_login_id).first()

    if not user:
        # 가입된 적 없으면 신규 생성
        user = User(
            user_login_id=user_login_id,
            user_password="social_login_dummy", 
            user_name=name,
            user_nickname=nickname,
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 4. 우리 서비스 전용 JWT 토큰 발행
    token_data = {
        "userId": user.user_login_id,
        "userName": user.user_name,
        "userNickname": user.user_nickname,
        "role": user.role
    }
    token = auth_service.create_access_token(token_data)

    # 5. 리다이렉트 응답 객체 생성 및 쿠키 설정 (카카오와 완벽히 동일!)
    redirect_res = RedirectResponse(url="http://localhost:3000/")
    redirect_res.set_cookie(value=token, **COOKIE_OPTIONS)

    return redirect_res