# Todo 프로젝트 — Backend / Frontend 기술 분석 (상세)

본 문서는 저장소 루트(`std`) 하위 **`backend/app`**(FastAPI)와 **`frontend/src`**(Create React App)를 **폴더 구조·라우팅·대표 코드** 기준으로 정리한 연구 노트입니다. 배포 시 실제 URL·`.env` 값은 환경마다 다릅니다.

---

## 1. 전체 개요

| 구분 | 기술 | 역할 |
|------|------|------|
| Backend | Python 3, FastAPI, SQLAlchemy, Uvicorn, SlowAPI, python-jose, passlib, pydantic-settings | REST API `/api/*`, JWT(httpOnly 쿠키), HR·관리자·공개 채용·메시지·파일 |
| Frontend | React 19, React Router 7, Axios, FullCalendar, react-hot-toast 등 | SPA: 직원 `/my/*`, 관리자 `/admin/*`, 공개 채용 `/careers/*` |

**API 프리픽스**: `backend/app/main.py`에서 `app.include_router(api_router, prefix="/api")`.

**프론트 베이스 URL**: `frontend/.env` / `.env.example`의 `REACT_APP_API_BASE_URL` (예: `http://localhost:8000/api`). Axios는 `withCredentials: true`로 **쿠키 세션**을 사용합니다.

---

## 2. 저장소 상위 구조

```
std/
├── backend/
│   ├── app/                 # FastAPI 애플리케이션 패키지 (PYTHONPATH 대상)
│   ├── scripts/             # 운영·개발 보조 CLI (근태 재계산, docx 생성 등)
│   └── tests/               # pytest (conftest, api, services, support)
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
├── requirements.txt         # 백엔드 의존성 (루트)
├── update.md                # 출퇴근·휴가 정책 계획안(별도 문서)
├── research.md              # 본 문서
└── manual.md                # 직원(일반 사용자) 화면 안내 — 지원자·관리자 메뉴 제외
```

---

## 3. Backend — `backend/app/` 폴더 구조 (상세)

```
backend/app/
├── main.py                  # FastAPI 앱, CORS, SlowAPI, 정적 파일, /api 라우터
├── api/
│   ├── __init__.py          # api_router: auth, admin, hr, common, public, messages
│   ├── auth.py              # 로그인·회원가입·OAuth·/me·check
│   ├── common.py            # 파일 업로드·ID 기반 다운로드
│   ├── messages.py          # 메시지 송수신
│   ├── admin/
│   │   ├── __init__.py      # /stats, /todos, /category-types, /attendance, …
│   │   ├── attendance.py    # 근태 조회·PATCH·work_minutes 재계산 등
│   │   ├── recruitment.py   # 채용 공고 CRUD, 이력서 템플릿 연동
│   │   ├── holidays.py      # 공휴일 CRUD·동기화 (라우트는 "/" → 실제 /holidays/)
│   │   ├── users.py, reports.py, todos.py, stats.py, …
│   │   └── departments.py, positions.py, category_types.py
│   ├── hr/
│   │   ├── __init__.py      # /attendance, /todos, /reports
│   │   ├── attendance.py    # 직원 출퇴근·clock-context
│   │   ├── todos.py         # 일정 CRUD
│   │   └── reports.py       # 일일·주간 보고
│   └── public/
│       └── recruitment.py   # 공개 공고·지원·지원자 세션(/me)
├── core/
│   ├── config.py            # pydantic-settings (.env)
│   ├── security.py          # JWT, 비밀번호 해시
│   ├── limiter.py           # SlowAPI Limiter
│   └── constants.py
├── db/
│   ├── session.py           # 엔진, get_db, init_db (테이블·시드·SQLite ALTER)
│   └── base.py              # ORM 모델 import (메타데이터 등록용)
├── models/                  # SQLAlchemy ORM
├── schemas/                 # Pydantic (auth, hr, admin, public, …)
├── services/                # 비즈니스 로직 (auth, hr, admin, public, common)
├── constants/               # vacation_categories 등
├── utils/
└── assets/
    └── templates/
        └── default_resume_template.docx   # init_db 시 기본 이력서 템플릿 시드 원본
```

**의존성**: 루트 `requirements.txt` (FastAPI, SQLAlchemy, uvicorn, slowapi, python-jose, passlib[bcrypt], pytest 등).

---

## 4. Backend — 애플리케이션 진입점 (`main.py`)

- `lifespan` → `init_db()` (테이블 생성·시드·SQLite 마이그레이션 유사 ALTER).
- `SlowAPIMiddleware` + `RateLimitExceeded` 핸들러.
- `CORSMiddleware`: `settings.CORS_ORIGINS`, **`allow_credentials=True`** (쿠키 필수).
- `app.include_router(api_router, prefix="/api")`.
- `static/` → `/assets`, `uploads/` → `SERVE_UPLOADS_STATIC`일 때 `/uploads`.
- `DEV_AUTO_START_REACT` 시 `npm start` 스레드 실행(개발 편의).

```python
# backend/app/main.py (발췌)
app = FastAPI(title="HR Management System", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
	CORSMiddleware,
	allow_origins=cors_origins_list,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
app.include_router(api_router, prefix="/api")
```

---

## 5. Backend — 설정 (`core/config.py`)

`Settings`는 프로젝트 루트 `.env`를 읽습니다 (`ENV_PATH`).

| 영역 | 필드 예시 |
|------|-----------|
| 인증 | `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_DAYS`, 카카오/네이버 클라이언트·`REDIRECT_URI` |
| 인프라 | `APP_PORT`, `ENVIRONMENT`, `CORS_ORIGINS`, `FRONTEND_URL`, `DATABASE_URL` |
| 기능 플래그 | `BOOTSTRAP_DEFAULT_ADMIN`, `SERVE_UPLOADS_STATIC`, `DEV_AUTO_START_REACT`, `ALLOW_LEGACY_PUBLIC_APPLY`, `ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS` |
| 외부 API | `PUBLIC_DATA_API_KEY`, `HOLIDAY_API_URL` |
| 근태(반차 검증용) | `ATTENDANCE_WORKDAY_START/END`, `ATTENDANCE_LUNCH_START/END` (기본 09~18, 점심 13~14) |

---

## 6. Backend — DB (`db/session.py`, `db/base.py`)

- SQLite 사용 시 `check_same_thread=False`.
- `init_db()`: `Base.metadata.create_all`, 레거시 컬럼 `ALTER`, `BOOTSTRAP_DEFAULT_ADMIN` 시 `admin` 시드, `TodoCategoryType` 시드, **`ResumeTemplate` 비어 있으면** `app/assets/templates/default_resume_template.docx`를 복사해 업로드 디렉터리에 두고 DB에 행 삽입, 기존 `JobPosting`에 `resume_template_id` 백필 등.

`db/base.py`는 모든 모델을 import하여 SQLAlchemy가 테이블 메타를 등록하도록 합니다.

```python
# backend/app/db/base.py (발췌)
from models.recruitment_models import Applicant, Application, Interview, JobPosting, ResumeTemplate
from models.hr_models import Todo, TodoCategoryType, TodoConfig, OfficeLocation, Attendance, DailyReport, WeeklyReport
# … User, Holiday, Message, …
```

---

## 7. Backend — API 라우터 맵

### 7.1 최상위 (`api/__init__.py`)

| Prefix | 모듈 |
|--------|------|
| `/api/auth` | `api/auth.py` |
| `/api/admin` | `api/admin/__init__.py` 하위 |
| `/api/hr` | `api/hr/__init__.py` 하위 |
| `/api/common` | `api/common.py` |
| `/api/public` | `api/public/recruitment.py` |
| `/api/messages` | `api/messages.py` |

### 7.2 Admin 하위 (`api/admin/__init__.py`)

| Path under `/api/admin` | 설명 |
|-------------------------|------|
| `/stats` | 통계 |
| `/todos` | 전사 일정 조회·삭제 등 |
| `/category-types` | 카테고리 마스터 |
| `/attendance` | 출퇴근 목록·기간 조회·PATCH·`POST .../recompute-work-minutes` |
| `/users` | 사용자 관리 |
| `/holidays` | 공휴일 (`GET /` → 클라이언트는 **`/holidays/`** 트레일링 슬래시 권장) |
| `/recruitment` | 채용 공고 + 이력서 템플릿 API |
| `/reports` | 보고서 모니터링 |
| `/departments`, `/positions` | 부서·직급 |

### 7.3 HR 하위 (`api/hr/__init__.py`)

| Path under `/api/hr` | 설명 |
|----------------------|------|
| `/attendance/today` | 오늘 출퇴근 행 |
| `/attendance/day` | 특정 일자 |
| `/attendance/clock-context` | 출근 확인·주말·공휴일·휴가 플래그 |
| `/attendance/clock-in`, `clock-out` | 출퇴근 기록 |
| `/todos` | 일정 |
| `/reports` | 일일·주간 보고 |

### 7.4 직원 출퇴근 API 스니펫 (`api/hr/attendance.py`)

```python
@router.get("/clock-context", response_model=attendance_schemas.AttendanceClockContextResponse)
def read_clock_context(...):
	user_id = _require_user_id(current_user)
	d = work_date or datetime.now().date()
	ctx = service.get_clock_context(db, user_id, d)
	return attendance_schemas.AttendanceClockContextResponse.model_validate(ctx)

@router.post("/clock-in", response_model=attendance_schemas.AttendanceResponse)
def clock_in(req: attendance_schemas.AttendanceRequest, ...):
	# ...
	return service.create_clock_in(
		...,
		confirm_full_day_vacation=req.confirm_full_day_vacation,
		confirm_official_leave=req.confirm_official_leave,
	)
```

**요청 스키마 요약** (`schemas/hr/attendance_schemas.py`): `location_name`, `latitude`, `longitude`, `note`, `confirm_full_day_vacation`, `confirm_official_leave`.

---

## 8. Backend — 인증·권한

- **JWT**: 로그인 응답으로 httpOnly 쿠키 `accessToken` 설정 (`api/auth.py`).
- **`services/auth_service.py`**: `get_current_user`, `get_current_admin`, `require_user_login_id`.
- **비밀번호**: `core/security.py` — bcrypt + 레거시 sha256 호환.

---

## 9. Backend — 근태·휴가 정책 (요약)

- **상수** (`constants/vacation_categories.py`): `VACATION_TODO_CATEGORIES`, 종일 연차·공가 확인용 `VACATION_TODO_REQUIRES_*`, 결근 가상행 스킵용 `VACATION_TODO_SKIPS_ABSENT_VIRTUAL`.
- **HR** (`services/hr/attendance_service.py`): To-Do 기준으로 종일 연차·공가는 확인 없으면 409 + `detail.code`; 반차·병가·경조는 차단하지 않음; 공가 To-Do `description`에 `[출근처리 …]` / `[퇴근처리 …]` 기록.
- **관리자 기간 조회** (`services/admin/attendance_service.py`): 일자별 휴가 To-Do 조인 → `vacation_todo_summary`, `half_day_type`, `review_hint`, 공휴일 메타; 반차 무기록 → `MISSING_EXPLANATION`; 주말·공휴일에도 일부 휴가 일정 가상 행 반영.

---

## 10. Backend — 채용 도메인 (`models/recruitment_models.py` 발췌)

```python
class ResumeTemplate(Base):
	__tablename__ = "resume_templates"
	id = Column(Integer, primary_key=True)
	name = Column(String(200), nullable=False)
	saved_name = Column(String(255), nullable=False, unique=True)
	file_path = Column(String(500), nullable=False)
	is_default = Column(Boolean, nullable=False, default=False)
	is_deleted = Column(Boolean, nullable=False, default=False)
	job_postings = relationship("JobPosting", back_populates="resume_template")

class JobPosting(Base):
	__tablename__ = "job_postings"
	# ...
	resume_template_id = Column(Integer, ForeignKey("resume_templates.id", ondelete="SET NULL"), nullable=True)
	resume_template = relationship("ResumeTemplate", back_populates="job_postings")
```

공개 API는 `services/public/recruitment_service.py`, 지원자 쿠키 세션은 `services/public/applicant_auth.py` 등에서 처리합니다.

---

## 11. Backend — 기타 서비스·스크립트

| 경로 | 용도 |
|------|------|
| `services/hr/todos_service.py` | 일정·연차 차감 연동 |
| `services/admin/resume_template_service.py` | 템플릿 CRUD·기본 지정 |
| `scripts/recompute_attendance_work_minutes.py` | CLI로 `work_minutes` 일괄 재계산 |
| `scripts/write_default_resume_docx.py` | 기본 docx 생성 보조 |

---

## 12. Backend — 테스트 (`backend/tests/`)

- `conftest.py`: 임시 SQLite `DATABASE_URL`, 통합 테스트용 계정 픽스처, `sys.path`에 `app` 추가.
- `tests/api/`: RBAC 스모크, 통합(채용, 메시지, 근태 등).
- `tests/services/`: 리포트·근태 단위 테스트.
- `tests/support/memory_db.py`: 인메모리 엔진 + `db.base` import로 **전 스키마** `create_all` (단위 테스트용).

실행 예: `cd backend && python -m pytest`.

---

## 13. Frontend — `frontend/src/` 구조 (상세)

```
frontend/src/
├── index.js, App.jsx
├── routes/
│   ├── index.jsx           # AppRoutes, PrivateRoute, AdminRoute
│   ├── authRoutes.jsx
│   ├── hrRoutes.jsx        # /my/todos, reports, attendance, messages, profile
│   ├── adminRoutes.jsx     # /admin/* (resume-templates 등)
│   └── publicRoutes.jsx    # /careers/*
├── pages/
│   ├── auth/               # Login, Signup, OAuthCallback
│   ├── hr/                 # TodoList, MyReports, Attendance, MyMessages, MyProfile
│   ├── admin/              # Dashboard, Users, Attendance, Recruitment, ResumeTemplateMgmt, …
│   └── public/             # JobList, JobDetail, JobApply, Applicant login/signup, MyApplications
├── components/
│   ├── common/             # Layout, Header, Sidebar, PrivateRoute, Modals
│   ├── hr/                 # TodoSidebar, TodoEditModal, HrLayout
│   ├── admin/              # JobPostingModal, UserAttendanceDrawer, …
│   ├── auth/
│   └── public/             # PublicLayout, PublicHeader
├── context/                # AuthContext, LoadingContext
├── api/                    # axiosInstance, authApi, todoApi, attendanceApi, recruitmentApi, holidayApi, …
├── constants/              # paths.js, menu.js, constants.js (API_ENDPOINTS)
├── utils/                  # 날짜, employmentDateUtils, formatApiError, toast, applicantSession
├── hooks/
└── assets/css/
```

---

## 14. Frontend — 라우팅·경로

- **직원**: `PrivateRoute` → `HrLayout` → `/my/*` (`hrRoutes.jsx`).
- **관리자**: `AdminRoute` → `/admin/*` (`adminRoutes.jsx`).
- **채용**: `/careers/*` (`publicRoutes.jsx`).
- 루트 `/` 로그인 시 `/my/todos` 리다이렉트.

**경로 상수** (`constants/paths.js`): `MY_TODOS`, `MY_ATTENDANCE`, `ADMIN_RESUME_TEMPLATES`, `pathCareersJob`, `pathCareersJobApply`, `ROUTE_SEGMENTS` 등.

**메뉴** (`constants/menu.js`): 직원 `MENU_ITEMS`, 관리자 `ADMIN_SUB_MENU`(인사·채용·시스템).

---

## 15. Frontend — API 클라이언트 (`api/axiosInstance.js`)

- `baseURL = process.env.REACT_APP_API_BASE_URL ?? ''`
- `withCredentials: true`
- 요청마다 **`Authorization` 헤더 삭제** — 토큰은 쿠키만 사용.
- **`FormData`인 경우 `Content-Type` 제거** — multipart boundary 자동 설정 (이력서 업로드 등).
- 401 시 로그인 요청과 구분, 세션 만료 이벤트·토스트 처리.

```javascript
// 발췌
if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
	if (typeof config.headers.delete === 'function') {
		config.headers.delete('Content-Type');
	} else {
		delete config.headers['Content-Type'];
	}
}
```

**엔드포인트 접두** (`constants/constants.js`): `API_ENDPOINTS.ATTENDANCE`, `HR_TODOS`, `PUBLIC_RECRUITMENT`, `ADMIN_HOLIDAYS` 등 — 실제 URL은 `baseURL + ENDPOINT`.

**공휴일** (`api/holidayApi.js`): FastAPI `@router.get("/")`와 맞추기 위해 **`/admin/holidays/`** 형태로 요청 (트레일링 슬래시).

---

## 16. Frontend — 인증 상태 (`context/AuthContext.jsx`)

- 마운트 시 `authApi.checkAuth()`.
- 상태: `isLoggedIn`, `userId`, `userRole`, `userName`, `joinDate`, `resignationDate` 등.
- `logout` + 탭 간 브로드캐스트; 세션 만료 이벤트 구독.

---

## 17. Frontend — 주요 화면 ↔ API (직원)

| 화면 | 파일 | 주요 API |
|------|------|----------|
| 캘린더 | `pages/hr/TodoList.jsx` | `todoService`, `holidayApi.getHolidays` |
| 내 보고서 | `pages/hr/MyReports.jsx` | `reportApi`, `attendanceApi` |
| 출퇴근 | `pages/hr/Attendance.jsx` | `attendanceApi.getTodayAttendance`, `getClockContext`, `clockIn`, `clockOut` + Geolocation |
| 수신함 | `pages/hr/MyMessages.jsx` | messages API |
| 프로필 | `pages/hr/MyProfile.jsx` | auth/profile API |

**출퇴근 UI**: 공가·종일 연차·주말·공휴일 확인 순서, 짧은 디바운스, `formatApiError`가 `detail.message` 객체형 응답을 처리.

---

## 18. Frontend — 관리자·공개 채용

- **관리자 근태**: `pages/admin/AdminAttendance.jsx` 등 + `UserAttendanceDrawer.jsx` (기간 조회, 휴가 캡션).
- **채용·템플릿**: `ResumeTemplateMgmt.jsx`, `JobPostingModal.jsx`, `recruitmentApi.js`.
- **공개 지원**: `JobApplyPage.jsx` — 템플릿 다운로드(있을 경우)·docx 업로드 등.

---

## 19. Frontend — 빌드·품질

`package.json`: `start`, `build`(+ `verify-production-env`), `test`, ESLint.

주요 의존성: `axios`, `react-router-dom`, `@fullcalendar/*`, `dayjs`, `suneditor-react`, `dompurify` 등.

---

## 20. 백엔드·프론트 연동 체크리스트

1. 브라우저는 **httpOnly 쿠키**로 JWT 전달.
2. CORS: `allow_credentials=True` + 프론트 origin이 `CORS_ORIGINS`에 포함.
3. `REACT_APP_API_BASE_URL`이 백엔드 **`/api`까지** 포함해 일치해야 함.
4. 운영: `SameSite`/`Secure`·프록시 구성에 맞춘 쿠키 정책.

---

## 21. 빠른 색인

| 주제 | 경로 |
|------|------|
| FastAPI 엔트리 | `backend/app/main.py` |
| API 묶음 | `backend/app/api/__init__.py` |
| DB 초기화 | `backend/app/db/session.py` |
| 직원 출퇴근 | `backend/app/api/hr/attendance.py`, `services/hr/attendance_service.py` |
| 관리자 근태 | `backend/app/api/admin/attendance.py`, `services/admin/attendance_service.py` |
| Axios | `frontend/src/api/axiosInstance.js` |
| 라우트 | `frontend/src/routes/index.jsx` |
| 경로·메뉴 | `frontend/src/constants/paths.js`, `menu.js` |

---

*코드 변경 후 엔드포인트·환경 변수가 바뀌면 본 문서를 함께 갱신하는 것을 권장합니다.*
