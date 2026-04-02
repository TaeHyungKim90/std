from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from datetime import datetime, date
import re

# 1. 로그인 요청 시 사용하는 스키마
class LoginRequest(BaseModel):
	id: str = Field(..., description="사용자 아이디")
	pw: str = Field(..., description="사용자 비밀번호")

# 2. 로그인 성공 후 사용자 정보를 응답할 때
class LoginResponse(BaseModel):
	success: bool
	userName: str
	userNickname: Optional[str] = None
	role: str
	access_token: Optional[str] = None
	userId: Optional[str] = None
	join_date: Optional[date] = None
	resignation_date: Optional[date] = None

# 3. 인증 상태 확인 응답 (checkAuth용)
class AuthCheckResponse(BaseModel):
	isLoggedIn: bool
	userName: Optional[str] = None
	userNickname: Optional[str] = None
	role: Optional[str] = None
	access_token: Optional[str] = None
	userId: Optional[str] = None
	join_date: Optional[date] = None
	resignation_date: Optional[date] = None

# 4. 사용자 생성 요청 (회원가입/관리자 등록)
class UserCreate(BaseModel):
	user_login_id: str = Field(..., description="아이디")
	user_password: str = Field(..., description="비밀번호")
	user_name: str = Field(..., description="실명")
	user_nickname: Optional[str] = None
	user_phone_number: Optional[str] = None
	role: str = Field("user", description="권한 (admin/user)")
	joined_at: Optional[date] = Field(
		default=None,
		validation_alias=AliasChoices("joined_at", "join_date", "joinDate"),
	)
	resignation_date: Optional[date] = None

	# 전화번호 숫자 10~11자리 검증
	@field_validator('user_phone_number')
	@classmethod
	def validate_phone_number(cls, v):
		if v:
			pattern = r'^\d{10,11}$'
			if not re.match(pattern, v):
				raise ValueError('전화번호는 하이픈(-) 없이 숫자만 10~11자리 입력해주세요.')
		return v

# 5. 사용자 정보 업데이트 요청
class UserUpdate(BaseModel):
	user_name: Optional[str] = None
	user_nickname: Optional[str] = None
	user_phone_number: Optional[str] = None
	role: Optional[str] = None
	user_password: Optional[str] = None 
	joined_at: Optional[date] = Field(
		default=None,
		validation_alias=AliasChoices("joined_at", "join_date", "joinDate"),
	)
	resignation_date: Optional[date] = None

	@field_validator('user_phone_number')
	@classmethod
	def validate_phone_number(cls, v):
		if v:
			pattern = r'^\d{10,11}$'
			if not re.match(pattern, v):
				raise ValueError('전화번호는 하이픈(-) 없이 숫자만 10~11자리 입력해주세요.')
		return v

# 6. 아이디 중복 확인 요청/응답
class CheckIdRequest(BaseModel):
	user_login_id: str = Field(..., description="중복 확인할 아이디")

class CheckIdResponse(BaseModel):
	available: bool = Field(..., description="사용 가능 여부")

# 7. 연차 정보 응답 스키마
class UserVacationResponse(BaseModel):
	total_days: int
	used_days: float
	remaining_days: float
	
	model_config = ConfigDict(from_attributes=True)

# 8. 마이페이지 본인 정보 수정 (PATCH /auth/me)
class MeProfilePatch(BaseModel):
	"""로그인 사용자 본인만 수정. 빈 문자열은 미전송과 동일하게 취급하지 않고 명시적 null/빈값 처리는 라우터에서 수행."""

	user_nickname: Optional[str] = Field(None, max_length=50)
	user_phone_number: Optional[str] = None
	current_password: Optional[str] = Field(None, description="비밀번호 변경 시 필수")
	new_password: Optional[str] = Field(None, min_length=6, max_length=128, description="새 비밀번호")

	@field_validator("user_phone_number")
	@classmethod
	def validate_phone_number(cls, v):
		if v is None:
			return None
		s = str(v).strip()
		if not s:
			return None
		pattern = r"^\d{10,11}$"
		if not re.match(pattern, s):
			raise ValueError("전화번호는 하이픈(-) 없이 숫자만 10~11자리 입력해 주세요.")
		return s


# 9. 최종 통합 사용자 정보 응답 (✅ 중복 제거 및 필드 통합)
class UserResponse(BaseModel):
	id: int
	user_login_id: str
	user_name: str
	user_nickname: Optional[str]
	user_phone_number: Optional[str] = None
	role: str
	created_at: datetime
	join_date: Optional[date] = None 
	resignation_date: Optional[date] = None
	
	# 연차 정보 포함
	vacation: Optional[UserVacationResponse] = None 

	model_config = ConfigDict(from_attributes=True)