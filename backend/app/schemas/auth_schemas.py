from pydantic import BaseModel, Field
from typing import Optional
from datetime import  datetime

# 1. 로그인 요청 시 사용하는 스키마 (리액트 -> 백엔드)
class LoginRequest(BaseModel):
    id: str = Field(..., description="사용자 아이디")
    pw: str = Field(..., description="사용자 비밀번호")

# 2. 로그인 성공 후 사용자 정보를 응답할 때 (백엔드 -> 리액트)
class LoginResponse(BaseModel):
    success: bool
    userName: str
    userNickname: Optional[str] = None
    role: str
    access_token: Optional[str] = None
    userId: Optional[str] = None

# 3. 인증 상태 확인 응답 (checkAuth용)
class AuthCheckResponse(BaseModel):
    isLoggedIn: bool
    userName: Optional[str] = None
    userNickname: Optional[str] = None
    role: Optional[str] = None
    access_token: Optional[str] = None
    userId: Optional[str] = None

class UserCreate(BaseModel):
    user_login_id: str = Field(..., description="아이디")
    user_password: str = Field(..., description="비밀번호")
    user_name: str = Field(..., description="실명")
    user_nickname: Optional[str] = None
    role: str = Field("user", description="권한 (admin/user)")

class UserUpdate(BaseModel):
    user_name: Optional[str] = None
    user_nickname: Optional[str] = None
    role: Optional[str] = None
    # 비밀번호 변경이 필요한 경우 추가 가능
    user_password: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    user_login_id: str
    user_name: str
    user_nickname: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class CheckIdRequest(BaseModel):
    user_login_id: str = Field(..., description="중복 확인할 아이디")

class CheckIdResponse(BaseModel):
    available: bool = Field(..., description="사용 가능 여부")