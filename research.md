# Todo 프로젝트 — Backend / Frontend 기술 분석

본 문서는 `todo` 저장소 하위의 **backend**(FastAPI)와 **frontend**(Create React App)를 코드·구조 기준으로 정리한 연구 노트입니다. 배포 환경별 세부 값은 `.env`에 따라 달라질 수 있습니다.

---

## 1. 전체 개요

| 구분 | 기술 스택 | 역할 |
|------|-----------|------|
| Backend | Python 3, FastAPI, SQLAlchemy, Uvicorn, SlowAPI, python-jose, passlib | REST API `/api/*`, 인증(JWT + httpOnly 쿠키), HR/관리/공개 채용/메시지/파일 |
| Frontend | React 19, React Router 7, Axios, FullCalendar, dayjs, SunEditor, react-hot-toast 등 | SPA: 직원 마이페이지, 관리자, 공개 채용 포털 |

**API 프리픽스**: 모든 백엔드 라우트는 `main.py`에서 `app.include_router(api_router, prefix="/api")`로 묶입니다.

**프론트 API 베이스**: `frontend/.env.example` 기준 `REACT_APP_API_BASE_URL=http://localhost:8000/api`. Axios는 `withCredentials: true`로 쿠키 기반 세션을 사용합니다.

---

## 2. Backend 폴더 구조

실제 파일 기준(주요 경로만; 캐시·테스트 보조 파일은 생략 가능).

```
backend/
├── app/
│   ├── main.py                 # FastAPI 앱, CORS, 정적 파일, 라우터 마운트
│   ├── api/
│   │   ├── __init__.py         # api_router 조립
│   │   ├── auth.py
│   │   ├── common.py           # 파일 업로드/다운로드
│   │   ├── messages.py
│   │   ├── admin/              # 관리자 API (users, todos, attendance, …)
│   │   ├── hr/                 # 직원 HR API (todos, attendance, reports)
│   │   └── public/             # 공개 채용 API
│   ├── core/
│   │   ├── config.py           # pydantic-settings (.env)
│   │   ├── security.py         # JWT, 비밀번호 해시
│   │   ├── limiter.py          # SlowAPI Limiter
│   │   └── constants.py
│   ├── db/
│   │   ├── session.py          # 엔진, get_db, init_db (테이블 생성·시드)
│   │   └── base.py             # 모델 import용
│   ├── models/                 # SQLAlchemy ORM
│   ├── schemas/                # Pydantic 요청/응답
│   ├── services/               # 비즈니스 로직 (auth, hr, admin, public, common)
│   ├── utils/
│   └── constants/
├── tests/                      # pytest (api, services)
├── .env.production.example
├── MIGRATION_GUIDE.md
└── USER_PROFILE_DB_QUERIES.md
```

**의존성**: 루트 `requirements.txt`에 FastAPI, SQLAlchemy, uvicorn, slowapi, python-jose, passlib[bcrypt], httpx, pytest 등이 명시되어 있습니다.

---

## 3. Backend — 애플리케이션 진입점

`main.py`는 다음을 수행합니다.

- `lifespan`에서 `init_db()` 호출로 테이블 생성 및 초기 데이터(옵션).
- `SlowAPIMiddleware` + `RateLimitExceeded` 핸들러 등록.
- `CORSMiddleware`: `settings.CORS_ORIGINS` 목록, `allow_credentials=True` (쿠키 공유 필수).
- `app.include_router(api_router, prefix="/api")`.
- `static/` 및 `uploads/` 마운트; `SERVE_UPLOADS_STATIC`에 따라 `/uploads` 직접 노출 여부 제어.
- 개발 시 `DEV_AUTO_START_REACT=true`이면 `npm start`를 별도 스레드로 실행(Windows는 `taskkill`로 정리).

**코드 스니펫 (라우터·CORS 핵심):**

```python
# backend/app/main.py (발췌)
app = FastAPI(title="HR Management System", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
cors_origins_list = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
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

## 4. Backend — 설정 (`core/config.py`)

`Settings`는 프로젝트 루트의 `.env`를 읽습니다(`ENV_PATH`).

주요 필드:

- **보안/인증**: `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_DAYS`, 카카오/네이버 OAuth 클라이언트·리다이렉트 URI.
- **서버**: `APP_PORT`, `ENVIRONMENT`, `CORS_ORIGINS`, `FRONTEND_URL`.
- **DB**: `DATABASE_URL` 미설정 시 SQLite 기본 경로는 `db/session.py`에서 `backend/todo.db` 근처로 결정.
- **플래그**: `BOOTSTRAP_DEFAULT_ADMIN`, `SERVE_UPLOADS_STATIC`, `DEV_AUTO_START_REACT`, 레거시 공개 지원 API 관련 `ALLOW_LEGACY_*`.

---

## 5. Backend — 데이터베이스 (`db/session.py`)

- SQLAlchemy `create_engine` + `sessionmaker`.
- SQLite일 때 `check_same_thread=False`.
- `init_db()`:
  - `Base.metadata.create_all`로 테이블 생성.
  - SQLite에서 `users` 테이블에 누락된 컬럼이 있으면 `ALTER TABLE` 시도(마이그레이션 대용).
  - `BOOTSTRAP_DEFAULT_ADMIN=True`일 때만 `admin` / `1234` 계정 시드.
  - `TodoCategoryType`이 비어 있으면 연차·반차·병가 등 기본 카테고리 삽입.

---

## 6. Backend — 인증·권한

### 6.1 JWT·비밀번호 (`core/security.py`)

- `passlib` CryptContext: `bcrypt` + 레거시 `sha256_crypt` 검증 호환.
- `create_access_token` / `decode_auth_token` (python-jose).

### 6.2 API 레이어 (`api/auth.py`)

- 로그인 시 JWT를 **httpOnly 쿠키** `accessToken`에 설정; JSON 응답에는 토큰을 넣지 않음(XSS 완화 의도).
- `check` 엔드포인트: `Authorization: Bearer` 또는 쿠키에서 토큰 수집 후 검증.
- 소셜 로그인 성공 시 프론트 `FRONTEND_URL/oauth/callback`으로 리다이렉트하며 동일 쿠키 설정.
- 로그인 엔드포인트에 SlowAPI `@limiter.limit("5/minute")` 적용.

### 6.3 의존성 (`services/auth_service.py`)

- `get_current_user`: Bearer 또는 쿠키 `accessToken` → payload.
- `get_current_admin`: `role == "admin"` 검사.
- `require_user_login_id`: payload에서 `userId` 문자열 강제.

---

## 7. Backend — API 라우터 맵

`api/__init__.py`에서 하위 라우터를 한데 묶습니다.

| Prefix (전체는 `/api` 아래) | 모듈 | 설명 |
|-----------------------------|------|------|
| `/auth` | `api/auth.py` | 로그인, 로그아웃, check, signup, OAuth, `/me` 등 |
| `/admin` | `api/admin/*` | 통계, 일정 로그, 카테고리, 출퇴근, 사용자, 공휴일, 채용, 보고서, 부서, 직급 |
| `/hr` | `api/hr/*` | 직원용 todos, attendance, reports |
| `/common` | `api/common.py` | 파일 업로드, ID 기반 다운로드 (`/files/{file_id}` 등) |
| `/public` | `api/public/recruitment.py` | 채용 공고·지원자 세션 기반 API |
| `/messages` | `api/messages.py` | 메시지 |

### 7.1 HR 일정 API 예시 (`api/hr/todos.py`)

직원 인증 후 `user_login_id`로 소유권 검사하는 패턴입니다.

```python
@router.get("/", response_model=List[todos_schemas.Todo])
def read_todos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return service.get_todos(db, skip=skip, limit=limit)

@router.post("/", response_model=todos_schemas.Todo)
def create_todo(todo: todos_schemas.TodoCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = require_user_login_id(current_user)
    return service.create_todo(db=db, todo=todo, user_id=user_id)
```

### 7.2 공통 파일 API (`api/common.py`)

- 허용 확장자: `.pdf`, 이미지, `.doc`, `.docx` 등; 최대 50MB.
- 인증된 사용자만 다운로드; `SERVE_UPLOADS_STATIC=false`일 때 프론트는 `/api/common/files/...` 경로 사용 권장.

---

## 8. Backend — 주요 도메인 모델 (발췌)

### 8.1 사용자 (`models/auth_models.py`)

- `User`: `user_login_id`, 해시된 `user_password`, 이름/닉네임, `role`, 입퇴사일, 부서/직급 FK, 프로필 이미지 URL, 급여 계좌 등.
- `UserVacation`: 사용자별 연차 총량/사용/잔여 (`user_login_id` FK).
- `UserAvatarSetting`: 아바타 zoom/offset.

### 8.2 HR (`models/hr_models.py`)

- `Todo`: 전사 공유 캘린더 일정, `user_id` → `users.user_login_id`, 카테고리·색·기간.
- `TodoCategoryType`, `TodoConfig`: 마스터 카테고리 + 사용자별 색/기본 설명.
- `Attendance`: 출퇴근 시각, 위치명, 좌표, 근무 분 등.
- `OfficeLocation`: 회사 지정 출근 장소(위경도·반경).
- `DailyReport`, `WeeklyReport`: 일일/주간 보고 (캘린더 Todo와 별도).

기타: `recruitment_models`, `message_models`, `holiday_models`, `system_models`(Department, Position) 등이 동일 `models/` 패키지에 존재합니다.

---

## 9. Backend — 속도 제한

`core/limiter.py`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)
```

개별 엔드포인트에 `@limiter.limit(...)` 데코레이터로 적용(예: 로그인 5회/분).

---

## 10. Backend — 테스트

- `backend/tests/`: `conftest.py`, `api/` 스모크·통합 테스트, `services/` 단위 테스트 등.
- 실행은 일반적으로 `pytest`를 `backend` 또는 `app` 경로에 맞춰 수행합니다(프로젝트 루트 `requirements.txt`에 pytest 포함).

---

## 11. Frontend 폴더 구조

```
frontend/
├── public/
├── scripts/                    # verify-production-env.js (prebuild)
├── src/
│   ├── index.js
│   ├── App.jsx                 # Provider, Router, Toaster, 전역 CSS
│   ├── routes/
│   │   ├── index.jsx           # AppRoutes
│   │   ├── authRoutes.jsx
│   │   ├── hrRoutes.jsx        # /my/*
│   │   ├── adminRoutes.jsx     # /admin/*
│   │   └── publicRoutes.jsx    # /careers/*
│   ├── pages/
│   │   ├── auth/               # Login, Signup, OAuthCallback
│   │   ├── hr/                 # TodoList, MyReports, Attendance, MyMessages, MyProfile
│   │   ├── admin/              # 대시보드, 사용자, 출퇴근, 일정 로그, 채용, 메시지 등
│   │   └── public/             # 채용 목록/상세/지원, 지원자 로그인·가입, 내 지원
│   ├── components/
│   │   ├── common/             # Layout, Header, Sidebar, PrivateRoute, Modals …
│   │   ├── hr/                 # TodoSidebar, TodoEditModal, HrLayout …
│   │   ├── admin/              # 관리자 전용 모달·드로어
│   │   ├── auth/
│   │   └── public/             # PublicLayout, PublicHeader
│   ├── context/
│   │   ├── AuthContext.jsx     # checkAuth, logout, 사용자 상태
│   │   └── LoadingContext.jsx
│   ├── api/                    # axiosInstance, authApi, adminApi, todoApi 등
│   ├── hooks/                  # useApiRequest, useApplicantSession
│   ├── constants/              # paths.js, menu.js, constants.js
│   ├── utils/                  # 날짜, 토스트, 파일, 세션 브로드캐스트
│   └── assets/css/
├── package.json
├── .env.example
└── tailwindcss (devDependency)
```

---

## 12. Frontend — 앱 셸 (`App.jsx`)

- 전역 CSS + SunEditor CSS.
- `LoadingProvider` → `AuthProvider` → `BrowserRouter` → `ErrorBoundary` → `Suspense` + `AppRoutes`.
- `react-hot-toast` `Toaster` 전역 설정.

---

## 13. Frontend — 라우팅 (`routes/index.jsx`)

- **비로그인**: `authRoutes` (`/login`, `/signup`, `/oauth/callback`).
- **공개**: `publicRoutes` — `/careers` 하위(공고 목록, 상세, 지원, 지원자 로그인/가입, 내 지원).
- **로그인 필요**: `PrivateRoute` → `Layout` → `hrRoutes` (`/my/...`).
- **관리자**: `AdminRoute`로 감싼 `adminRoutes` (`/admin/...`).
- 루트 `/`는 로그인 시 `/my/todos`로 리다이렉트.
- `*` → `NotFoundPage`.

**PrivateRoute / AdminRoute 요약:**

- `PrivateRoute`: `AuthContext.loading` 동안 로딩 UI, 미로그인 시 `/login`.
- `AdminRoute`: `userRole !== 'admin'`이면 토스트 후 `/my/todos`.

---

## 14. Frontend — 경로 상수 (`constants/paths.js`)

직원: `MY_TODOS` = `/my/todos`, `MY_REPORTS`, `MY_ATTENDANCE`, `MY_MESSAGES`, `MY_PROFILE`.

관리자: `ADMIN_DASHBOARD`, `ADMIN_USERS`, `ADMIN_TODOS`, …

채용: `CAREERS`, `CAREERS_LOGIN`, `CAREERS_SIGNUP`, `CAREERS_MY_APPLICATIONS`, 동적 경로 헬퍼 `pathCareersJob`, `pathCareersJobApply`.

---

## 15. Frontend — 메뉴 (`constants/menu.js`)

- `MENU_ITEMS`: 캘린더, 내 보고서, 출퇴근, 내 수신함, 내 정보, 관리모드(adminOnly).
- `ADMIN_SUB_MENU`: 인사관리 / 채용관리 / 시스템관리 하위 항목과 `PATHS` 연결.

---

## 16. Frontend — HTTP 클라이언트 (`api/axiosInstance.js`)

- `baseURL = process.env.REACT_APP_API_BASE_URL ?? ''`.
- `withCredentials: true` — httpOnly 쿠키 전송.
- 요청 인터셉터에서 **의도적으로 `Authorization` 헤더 제거** — 토큰은 쿠키만 사용.
- 401 처리:
  - 로그인 요청 실패는 일반 에러 메시지.
  - 그 외는 `AUTH_SESSION_EXPIRED_EVENT` 디스패치, 채용 경로면 지원자 세션 정리, `showSessionExpiredToast`로 로그인 유도.

**코드 스니펫:**

```javascript
// frontend/src/api/axiosInstance.js (발췌)
export const client = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});
client.interceptors.request.use((config) => {
  delete config.headers.Authorization;
  return config;
});
```

API 경로 상수는 `constants/constants.js`의 `API_ENDPOINTS`에 `/auth`, `/hr/todos`, `/admin` 등으로 정의됩니다.

---

## 17. Frontend — 인증 컨텍스트 (`context/AuthContext.jsx`)

- 마운트 시 `authApi.checkAuth()` 호출, 전역 로딩 표시.
- 상태: `isLoggedIn`, `userName`, `userNickname`, `userId`, `userRole`, `joinDate`, `resignationDate`.
- `logout`: `authApi.logout()` 후 상태 초기화 및 탭 간 로그아웃 브로드캐스트.
- 세션 만료 이벤트 리스너로 상태 동기화.

---

## 18. Frontend — 대표 화면과 기술적 연결

### 18.1 캘린더(일정) — `pages/hr/TodoList.jsx`

- **FullCalendar** (dayGrid, timeGrid, interaction) + 드래그 가능한 사이드바 템플릿.
- `todoService.getCategories()`, `getTodoConfigs()`, `getTodos()` + `holidayApi.getHolidays(year)`.
- `useAuth()`의 `joinDate` / `resignationDate`로 캘린더 선택 가능 구간 제한(`employmentDateUtils`).
- 모달: `TodoEditModal`, `TodoDetailModal`, `TodoTemplateModal`, `TodoSidebar`.

### 18.2 내 보고서 — `pages/hr/MyReports.jsx`

- 탭: 일일 보고 / 주간 보고.
- `reportApi`, `attendanceApi`, 입사일·출근 참조 로직(`reportDateUtils`).

### 18.3 출퇴근 — `pages/hr/Attendance.jsx`

- `attendanceApi.getTodayAttendance`, 출근/퇴근 시 위치·좌표(Geolocation) 연동.
- 장소 옵션: 본사, 재택, 출장, 외근(코드 내 상수; 백엔드 마스터와 연동 여부는 배포 설정에 따름).

### 18.4 기타 직원 페이지

- `MyMessages.jsx`, `MyProfile.jsx`: 메시지 수신·프로필/비밀번호 등(각각 해당 API 모듈 사용).

### 18.5 관리자 페이지

- `pages/admin/*`: 대시보드, 사용자, 출퇴근 기록, 일정 로그, 보고서 모니터링, 채용 공고/지원 현황, 메시지, 카테고리·부서·직급·공휴일 등.
- API는 `api/adminApi.js` 등에서 집약.

### 18.6 공개 채용

- `PublicLayout` + `pages/public/*`: 공고 리스트/상세, 지원서 작성, 지원자 전용 로그인·회원가입, 내 지원 내역.
- 세션/캐시: `utils/applicantSession.js`, `hooks/useApplicantSession.js`.

---

## 19. Frontend — 빌드·품질

`package.json` 스크립트:

- `start`: `react-scripts start`
- `build`: `prebuild`로 `verify-production-env.js` 후 `react-scripts build`
- `test` / `test:ci`
- `lint` / `lint:fix`: ESLint + simple-import-sort, unused-imports

주요 의존성: `axios`, `react-router-dom`, `@fullcalendar/*`, `dayjs`, `suneditor-react`, `dompurify`, `lucide-react` 등.

---

## 20. 백엔드·프론트 연동 요약

1. 브라우저는 **항상 쿠키**로 JWT를 전달(`accessToken`, httpOnly).
2. CORS는 자격 증명 포함 요청을 허용하도록 백엔드에서 `allow_credentials=True` + 정확한 `allow_origins` 필요.
3. 프론트 개발 시 API URL은 `REACT_APP_API_BASE_URL`로 백엔드 `http://host:port/api`와 일치시켜야 합니다.
4. 운영에서는 정적 프론트를 백엔드 `static/`으로 서빙하거나 별도 CDN을 쓰는 경우, 동일 도메인 또는 프록시로 쿠키 `SameSite`/`Secure` 정책을 맞추는 것이 중요합니다.

---

## 21. 참고 파일 경로 빠른 색인

| 주제 | 경로 |
|------|------|
| FastAPI 엔트리 | `backend/app/main.py` |
| 환경 설정 | `backend/app/core/config.py` |
| DB 초기화 | `backend/app/db/session.py` |
| API 묶음 | `backend/app/api/__init__.py` |
| 인증 의존성 | `backend/app/services/auth_service.py` |
| Axios | `frontend/src/api/axiosInstance.js` |
| 라우트 트리 | `frontend/src/routes/index.jsx` |
| 경로 상수 | `frontend/src/constants/paths.js` |
| 직원 메뉴 | `frontend/src/constants/menu.js` |

---

*문서 생성 시점의 코드 스냅샷을 기준으로 작성되었습니다. 리팩터링 후 엔드포인트나 환경 변수가 바뀌면 본 문서와 diff를 맞추는 것이 좋습니다.*
