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
	mustChangePassword: bool = False

# 3. 인증 상태 확인 응답 (checkAuth용)
class AuthCheckResponse(BaseModel):
	isLoggedIn: bool
	userName: Optional[str] = None
	userNickname: Optional[str] = None
	role: Optional[str] = None
	access_token: Optional[str] = None
	userId: Optional[str] = None
	user_profile_image_url: Optional[str] = None
	avatar_zoom: Optional[float] = None
	avatar_offset_x: Optional[float] = None
	avatar_offset_y: Optional[float] = None
	join_date: Optional[date] = None
	resignation_date: Optional[date] = None
	mustChangePassword: bool = False
	birth_date: Optional[str] = None

def _normalize_phone_input(v):
	if v is None:
		return None
	from utils.user_identity import normalize_phone_number

	phone = normalize_phone_number(v)
	if phone is None:
		return None
	if not re.match(r"^\d{10,11}$", phone):
		raise ValueError("전화번호는 하이픈(-) 없이 숫자만 10~11자리 입력해주세요.")
	return phone


def _normalize_birth_date_input(v, *, required: bool = False):
	from utils.user_identity import normalize_birth_date

	if v is None or (isinstance(v, str) and not str(v).strip()):
		if required:
			raise ValueError("생년월일을 입력해 주세요. (YYYY-MM-DD)")
		return None
	normalized = normalize_birth_date(v)
	if not normalized:
		raise ValueError("생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD 또는 YYYYMMDD)")
	return normalized


def _normalize_address_input(v, *, required: bool = False):
	if v is None or (isinstance(v, str) and not str(v).strip()):
		if required:
			raise ValueError("주소를 입력해 주세요.")
		return None
	s = str(v).strip()
	if len(s) > 255:
		raise ValueError("주소는 255자 이내로 입력해 주세요.")
	return s


# 4. 사용자 생성 요청 (회원가입/관리자 등록)
class UserCreate(BaseModel):
	user_login_id: str = Field(..., description="아이디")
	user_password: str = Field(..., description="비밀번호")
	user_name: str = Field(..., description="실명")
	user_nickname: Optional[str] = None
	user_phone_number: str = Field(..., description="휴대폰 번호")
	birth_date: str = Field(..., description="생년월일 (YYYY-MM-DD)")
	# 공개 가입은 서비스에서 필수 검증. 관리자 등록은 선택.
	address: Optional[str] = Field(None, description="주소")
	# 사용자 프로필 확장
	user_profile_image_url: Optional[str] = None
	department_id: Optional[int] = None
	position_id: Optional[int] = None
	salary_bank_name: Optional[str] = None
	salary_account_number: Optional[str] = None
	role: str = Field("user", description="권한 (admin/user)")
	joined_at: Optional[date] = Field(
		default=None,
		validation_alias=AliasChoices("joined_at", "join_date", "joinDate"),
	)
	resignation_date: Optional[date] = None
	avatar_zoom: Optional[float] = None
	avatar_offset_x: Optional[float] = None
	avatar_offset_y: Optional[float] = None

	@field_validator("user_phone_number")
	@classmethod
	def validate_phone_number(cls, v):
		phone = _normalize_phone_input(v)
		if not phone:
			raise ValueError("전화번호를 입력해 주세요.")
		return phone

	@field_validator("birth_date", mode="before")
	@classmethod
	def validate_birth_date(cls, v):
		return _normalize_birth_date_input(v, required=True)

	@field_validator("address", mode="before")
	@classmethod
	def validate_address(cls, v):
		return _normalize_address_input(v, required=False)

# 5. 사용자 정보 업데이트 요청
class UserUpdate(BaseModel):
	user_name: Optional[str] = None
	user_nickname: Optional[str] = None
	user_phone_number: Optional[str] = None
	birth_date: Optional[str] = Field(None, description="생년월일 (YYYY-MM-DD)")
	address: Optional[str] = Field(None, description="주소")
	user_profile_image_url: Optional[str] = None
	department_id: Optional[int] = None
	position_id: Optional[int] = None
	salary_bank_name: Optional[str] = None
	salary_account_number: Optional[str] = None
	role: Optional[str] = None
	user_password: Optional[str] = None
	approval_status: Optional[str] = Field(
		None, description="가입 승인 상태: pending | approved | rejected"
	)
	joined_at: Optional[date] = Field(
		default=None,
		validation_alias=AliasChoices("joined_at", "join_date", "joinDate"),
	)
	resignation_date: Optional[date] = None
	avatar_zoom: Optional[float] = None
	avatar_offset_x: Optional[float] = None
	avatar_offset_y: Optional[float] = None

	@field_validator('user_phone_number')
	@classmethod
	def validate_phone_number(cls, v):
		return _normalize_phone_input(v)

	@field_validator("birth_date", mode="before")
	@classmethod
	def validate_birth_date(cls, v):
		return _normalize_birth_date_input(v, required=False)

	@field_validator("address", mode="before")
	@classmethod
	def validate_address(cls, v):
		return _normalize_address_input(v, required=False)

	@field_validator("approval_status")
	@classmethod
	def validate_approval_status(cls, v):
		if v is None:
			return None
		s = str(v).strip().lower()
		if s not in ("pending", "approved", "rejected"):
			raise ValueError("approval_status는 pending, approved, rejected 중 하나여야 합니다.")
		return s

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

	user_name: Optional[str] = Field(None, max_length=50)
	user_nickname: Optional[str] = Field(None, max_length=50)
	user_phone_number: Optional[str] = None
	birth_date: Optional[str] = Field(None, description="생년월일 (YYYY-MM-DD)")
	address: Optional[str] = Field(None, description="주소")
	user_profile_image_url: Optional[str] = None
	join_date: Optional[date] = None
	department_id: Optional[int] = None
	position_id: Optional[int] = None
	salary_bank_name: Optional[str] = None
	salary_account_number: Optional[str] = None
	current_password: Optional[str] = Field(None, description="비밀번호 변경 시 필수")
	new_password: Optional[str] = Field(None, min_length=6, max_length=128, description="새 비밀번호")
	avatar_zoom: Optional[float] = None
	avatar_offset_x: Optional[float] = None
	avatar_offset_y: Optional[float] = None

	@field_validator("user_phone_number")
	@classmethod
	def validate_phone_number(cls, v):
		return _normalize_phone_input(v)

	@field_validator("birth_date", mode="before")
	@classmethod
	def validate_birth_date(cls, v):
		return _normalize_birth_date_input(v, required=False)

	@field_validator("address", mode="before")
	@classmethod
	def validate_address(cls, v):
		return _normalize_address_input(v, required=False)


class SocialSignupComplete(BaseModel):
	"""소셜 OAuth 이후 가입 완료 (아이디/비번은 서버 생성)."""

	user_name: str = Field(..., description="실명")
	user_nickname: Optional[str] = None
	user_phone_number: str = Field(..., description="휴대폰 번호")
	birth_date: str = Field(..., description="생년월일 (YYYY-MM-DD)")
	address: str = Field(..., description="주소")

	@field_validator("user_name")
	@classmethod
	def validate_user_name(cls, v):
		s = str(v or "").strip()
		if not s:
			raise ValueError("이름을 입력해 주세요.")
		return s

	@field_validator("user_phone_number")
	@classmethod
	def validate_phone_number(cls, v):
		phone = _normalize_phone_input(v)
		if not phone:
			raise ValueError("전화번호를 입력해 주세요.")
		return phone

	@field_validator("birth_date", mode="before")
	@classmethod
	def validate_birth_date(cls, v):
		return _normalize_birth_date_input(v, required=True)

	@field_validator("address", mode="before")
	@classmethod
	def validate_address(cls, v):
		return _normalize_address_input(v, required=True)


class SocialSignupTicketResponse(BaseModel):
	provider: str
	user_name: Optional[str] = None
	user_nickname: Optional[str] = None
	user_phone_number: Optional[str] = None
	birth_date: Optional[str] = None


class LinkSocialRequest(BaseModel):
	"""수동 소셜 연동/해제 요청."""

	provider: str = Field(..., description="kakao | naver")
	action: str = Field(..., description="link | unlink")

	@field_validator("provider")
	@classmethod
	def validate_provider(cls, v):
		p = str(v or "").strip().lower()
		if p not in ("kakao", "naver"):
			raise ValueError("provider는 kakao 또는 naver 여야 합니다.")
		return p

	@field_validator("action")
	@classmethod
	def validate_action(cls, v):
		a = str(v or "").strip().lower()
		if a not in ("link", "unlink"):
			raise ValueError("action은 link 또는 unlink 여야 합니다.")
		return a


class LinkSocialResponse(BaseModel):
	success: bool = True
	message: str
	provider: str
	action: str
	linked: bool
	# action=link 일 때 프론트가 이동할 OAuth URL
	url: Optional[str] = None


class UserApprovalPatch(BaseModel):
	"""관리자 가입 승인/거절."""

	approval_status: str = Field(..., description="pending, approved, rejected")

	@field_validator("approval_status")
	@classmethod
	def validate_approval_status(cls, v):
		s = str(v or "").strip().lower()
		if s not in ("pending", "approved", "rejected"):
			raise ValueError("approval_status는 pending, approved, rejected 중 하나여야 합니다.")
		return s


# 9. 최종 통합 사용자 정보 응답 (✅ 중복 제거 및 필드 통합)
class UserResponse(BaseModel):
	id: int
	user_login_id: str
	user_name: str
	user_nickname: Optional[str]
	user_phone_number: Optional[str] = None
	birth_date: Optional[str] = None
	address: Optional[str] = None
	provider_kakao_id: Optional[str] = None
	provider_naver_id: Optional[str] = None
	kakao_linked: bool = False
	naver_linked: bool = False
	user_profile_image_url: Optional[str] = None
	department_id: Optional[int] = None
	position_id: Optional[int] = None
	department_name: Optional[str] = None
	position_name: Optional[str] = None
	salary_bank_name: Optional[str] = None
	salary_account_number: Optional[str] = None
	role: str
	approval_status: str = "approved"
	created_at: datetime
	join_date: Optional[date] = None 
	resignation_date: Optional[date] = None
	join_date_editable: bool = True
	avatar_zoom: float = 1.0
	avatar_offset_x: float = 0.0
	avatar_offset_y: float = 0.0
	
	# 연차 정보 포함
	vacation: Optional[UserVacationResponse] = None 

	model_config = ConfigDict(from_attributes=True)