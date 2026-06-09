# HR / 채용 통합 앱 — Backend / Frontend 기술 분석 (상세)

본 문서는 저장소 루트 하위 **`backend/app`**(FastAPI)와 **`frontend/src`**(Create React App)를 **폴더 구조·라우팅·대표 코드** 기준으로 정리한 연구 노트입니다.  
**멀티테넌트**, **출퇴근 도장·월간 가산점**, **PDF 뷰어**, **CI/CD** 등 최근 변경을 반영합니다.

**관련 문서**: [`README.md`](README.md) 온보딩 · [`MULTI_TENANT.md`](MULTI_TENANT.md) 테넌트 · [`PRODUCTION_GUIDE.md`](PRODUCTION_GUIDE.md) 운영 · [`manual.md`](manual.md) 직원 안내

---

## 1. 전체 개요

| 구분 | 기술 | 역할 |
|------|------|------|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Uvicorn, SlowAPI, python-jose, passlib, pydantic-settings | REST API `/api/*`, JWT(httpOnly 쿠키), **테넌트별** HR·관리자·공개 채용·메시지·파일 |
| Frontend | React 19, React Router 7, Axios, FullCalendar, pdfjs-dist, react-hot-toast 등 | SPA: `/{tenant}/my/*`, `/{tenant}/admin/*`, `/{tenant}/careers/*`, `/platform/*` |
| CI | GitHub Actions (`backend-ci.yml`, `frontend-ci.yml`) | PR·`master` push 시 Lint + Test (Python 3.12 / Node 24) |

**API 프리픽스**: `backend/app/main.py`에서 `app.include_router(api_router, prefix="/api")`.

**프론트 베이스 URL**: `frontend/.env`의 `REACT_APP_API_BASE_URL` (예: `http://localhost:8000/api`). Axios는 `withCredentials: true`로 **쿠키 세션**을 사용합니다.

**테넌트 URL**: 프론트·백엔드 모두 `/{tenant_slug}/login`, `/{tenant_slug}/my/todos` 형태. JWT `tenantId`와 URL slug 불일치 시 비로그인 처리.

---

## 2. 저장소 상위 구조

```
hr/
├── backend/
│   ├── app/                 # FastAPI 애플리케이션 패키지 (PYTHONPATH 대상)
│   ├── scripts/             # 운영·개발 보조 CLI
│   └── tests/               # pytest (conftest, api, services, support)
├── frontend/
│   ├── public/              # pdf.worker.min.mjs 등
│   ├── scripts/             # copy-pdf-worker.js, verify-production-env.js
│   └── src/
├── static/                  # CRA 빌드 산출물 (운영 서빙)
├── .github/workflows/       # backend-ci.yml, frontend-ci.yml
├── backend/pyproject.toml
├── backend/uv.lock
├── start_local.bat          # 로컬 기동 스크립트
├── README.md                # 온보딩
├── PRODUCTION_GUIDE.md      # Windows 운영 배포
├── research.md              # 본 문서
└── manual.md                # 직원 화면 안내
```

---

## 3. Backend — `backend/app/` 폴더 구조 (상세)

```
backend/app/
├── main.py                  # FastAPI, CORS, SPA 폴백(테넌트·platform), pdf.worker, 정적 파일
├── api/
│   ├── __init__.py          # auth, admin, hr, common, public, messages, platform, tenants
│   ├── auth.py
│   ├── common.py            # 파일 업로드·ID 기반 다운로드(PDF Content-Type 등)
│   ├── messages.py
│   ├── tenants.py           # GET /api/tenants, 테넌트 브랜딩 logo/icon
│   ├── platform/            # 플랫폼 관리자 (테넌트 CRUD·브랜딩)
│   ├── admin/
│   │   ├── attendance.py    # 근태 CRUD·monthly-rewards·recompute-work-minutes
│   │   ├── work_locations.py
│   │   └── … (users, holidays, recruitment, reports, …)
│   ├── hr/
│   │   ├── attendance.py    # 출퇴근·calendar-stamps·day/sessions·work-locations
│   │   ├── todos.py
│   │   └── reports.py
│   └── public/
│       └── recruitment.py
├── core/
│   ├── config.py
│   ├── security.py
│   ├── tenant.py            # slug 검증, get_tenant_by_slug, RESERVED_TENANT_SLUGS
│   └── limiter.py
├── db/
│   ├── session.py           # init_db, SQLite ALTER, 테넌트·시드
│   └── base.py
├── models/
│   ├── tenant_models.py     # Tenant
│   ├── auth_models.py       # User (tenant_id)
│   ├── hr_models.py         # Attendance, AttendanceDailySummary, Todo, …
│   └── …
├── schemas/
├── services/
│   ├── tenant_scope.py      # 테넌트별 쿼리 헬퍼 (attendance_in_tenant, …)
│   ├── tenant_service.py, tenant_branding_service.py
│   ├── hr/
│   │   ├── attendance_service.py
│   │   ├── attendance_calendar_service.py   # 월간 도장·build_month_context
│   │   ├── attendance_daily_summary_service.py
│   │   └── attendance_time_math.py
│   ├── admin/
│   │   ├── attendance_service.py
│   │   └── attendance_reward_service.py     # 월간 가산점 집계(실시간 계산)
│   ├── common_service.py    # 파일 다운로드 권한(PDF 수신자·공지 등)
│   └── …
├── constants/               # vacation_categories, attendance_shift, bootstrap_admin
└── utils/seoul_time.py
```

**의존성**: `backend/pyproject.toml` + `backend/uv.lock` (`uv sync --project backend --group dev`).

---

## 4. Backend — 애플리케이션 진입점 (`main.py`)

- `lifespan` → `init_db()`.
- `SlowAPIMiddleware` + Rate limit.
- CORS: `allow_credentials=True`.
- `app.include_router(api_router, prefix="/api")`.
- 정적: `/static`, `/assets`, `/uploads/tenant-branding`, (설정 시) `/uploads`.
- **`GET /pdf.worker.min.mjs`**: PDF.js worker (SPA 폴백보다 먼저 등록).
- **SPA 폴백**
  - `/platform/*` — 플랫폼 관리
  - `/{tenant_slug}/login|signup|admin/*|my/*|careers/*` — 테넌트 SPA
  - 레거시 `/my/*`, `/admin/*` → `DEFAULT_TENANT_SLUG` 로 리다이렉트
- `DEV_AUTO_START_REACT` 시 CRA `npm start` 스레드.

---

## 5. Backend — 설정 (`core/config.py`)

`Settings`는 프로젝트 루트 `.env`를 읽습니다.

| 영역 | 필드 예시 |
|------|-----------|
| 인증 | `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_DAYS`, 카카오/네이버 OAuth |
| 인프라 | `APP_PORT`, `ENVIRONMENT`, `CORS_ORIGINS`, `FRONTEND_URL`, `DATABASE_URL` |
| 멀티테넌트 | `DEFAULT_TENANT_SLUG` (기본 테넌트 slug) |
| 기능 플래그 | `BOOTSTRAP_DEFAULT_ADMIN`, `SERVE_UPLOADS_STATIC`, `DEV_AUTO_START_REACT` |
| 근태 | `ATTENDANCE_WORKDAY_START/END`, `ATTENDANCE_STANDARD_WORKDAY_MINUTES` (반차 검증·근무시간 계산) |

---

## 6. Backend — DB (`db/session.py`)

- SQLite / PostgreSQL (`DATABASE_URL`).
- `init_db()`: 테이블 생성, SQLite `ALTER`, **테넌트·부트스트랩 admin 시드**, 카테고리·이력서 템플릿 시드.
- HR 직원 데이터 테이블은 **`tenant_id`** + 복합 unique로 테넌트 격리 (`Attendance`, `Todo`, `Holiday`, `DailyReport` 등).

---

## 7. Backend — API 라우터 맵

### 7.1 최상위 (`api/__init__.py`)

| Prefix | 모듈 |
|--------|------|
| `/api/tenants` | `api/tenants.py` — 활성 테넌트 목록, 브랜딩 이미지 |
| `/api/platform` | `api/platform/*` — 플랫폼 관리자 인증·테넌트·브랜딩 |
| `/api/auth` | `api/auth.py` |
| `/api/admin` | `api/admin/*` |
| `/api/hr` | `api/hr/*` |
| `/api/common` | `api/common.py` |
| `/api/public` | `api/public/recruitment.py` |
| `/api/messages` | `api/messages.py` |

### 7.2 Admin — 근태·가산점 (`api/admin/attendance.py`)

| Path | 설명 |
|------|------|
| `GET /all` | 일일 근태 목록 (직원당 1행, 테넌트 스코프) |
| `GET /user/{id}/range` | 기간별 직원 근태 |
| `POST/PATCH /records` | 근태 생성·수정 |
| `GET /monthly-rewards?year=&month=` | **월간 가산점·순위·쿠폰 1등** (실시간 집계) |
| `POST /recompute-work-minutes` | work_minutes 일괄 재계산 |

### 7.3 HR — 출퇴근·도장 (`api/hr/attendance.py`)

| Path | 설명 |
|------|------|
| `GET /today`, `/day` | 오늘·특정일 출퇴근 |
| `GET /day/sessions` | 다회 출근 세션 + 일별 합산 |
| `GET /calendar-stamps?year=&month=` | **캘린더 도장** (출근/퇴근/완료/휴가) |
| `GET /clock-context` | 출근 확인 팝업 맥락 |
| `POST /clock-in`, `/clock-out` | 출퇴근 |
| `GET /work-locations` | 활성 근무장소 |
| `PATCH /preferred-work-location` | 선호 근무장소 |

인증: `get_current_user_for_tenant` / `get_current_admin_for_tenant` — JWT `tenantId` 기준.

---

## 8. Backend — 멀티테넌트

### 8.1 테넌트 식별

- **URL slug**: `/{tenant_slug}/…` (프론트·SPA 폴백).
- **JWT**: 로그인 시 `tenantId` 포함. API는 `tenant_id_from_user(current_user)`로 스코프.
- **헤더**: `X-Tenant-Slug` (일부 공개·브랜딩 API).
- **예약 slug**: `api`, `static`, `platform` 등 (`core/tenant.py` `RESERVED_TENANT_SLUGS`).

### 8.2 데이터 격리

- `services/tenant_scope.py`: `attendance_in_tenant`, `todos_in_tenant`, `holidays_in_tenant`, `directory_users_in_tenant` 등.
- 채용·공휴일·연차·근태·보고·메시지 등 HR 도메인 서비스는 **`tenant_id` 인자**를 받아 쿼리 필터.
- 공휴일 동기화 시 전 테넌트 복제 로직 (`holiday_service`).

### 8.3 플랫폼 vs 테넌트

| 계층 | 경로 | 역할 |
|------|------|------|
| 플랫폼 관리 | `/platform/*`, `/api/platform/*` | 테넌트 생성·브랜딩·플랫폼 admin |
| 테넌트 앱 | `/{slug}/my/*`, `/{slug}/admin/*` | 직원·관리자·채용 |

---

## 9. Backend — 인증·권한

- **직원 JWT**: httpOnly 쿠키 `accessToken`. `get_current_user` / `get_current_user_for_tenant`.
- **관리자**: `get_current_admin_for_tenant`.
- **지원자**: 별도 쿠키 `applicantToken`, `get_current_applicant` (테넌트 스코프).
- **URL·JWT 테넌트 불일치**: 프론트·백엔드 모두 세션 무효 처리.
- **세션 만료 UX**: 401 시 즉시 리다이렉트 대신 토스트 → 사용자가 닫거나 로그인 이동 (출퇴근 전 세션 검증 포함).

---

## 10. Backend — 근태·휴가 정책 (요약)

- **휴가 카테고리**: `constants/vacation_categories.py` — 연차·공가·반차·병가 등.
- **출퇴근**: 종일 연차·공가는 확인 없으면 409; 반차·병가는 출퇴근 허용.
- **다회 출근**: `Attendance.shift_status` (IN_PROGRESS / CLOSED), `AttendanceDailySummary` 일별 합산.
- **관리자 기간 조회**: 휴가 To-Do 조인, 반차·결근 가상행, 공휴일 메타.

---

## 11. Backend — 출퇴근 도장·월간 가산점

### 11.1 직원 캘린더 도장 (`attendance_calendar_service.py`)

- `GET /api/hr/attendance/calendar-stamps`
- 일별 `stamp_type`: `clock_in`, `clock_out`, `attendance_complete`, `vacation`
- **점수·쿠폰 정보는 포함하지 않음** (도장 UI 전용).

### 11.2 관리자 월간 가산점 (`attendance_reward_service.py`)

- `GET /api/admin/attendance/monthly-rewards`
- **DB에 점수를 저장하지 않음** — 요청 시마다 출퇴근·휴가·공휴일·입퇴사일 기준 **실시간 계산**.
- **가산점 정책 (현재)**:

| 항목 | 점수 |
|------|------|
| 출퇴근 완료 (출근+퇴근) | +1 |
| 휴가 인정 | +1 |

- ~~정시 출근 +1~~ — **제거됨** (회사·프로젝트별 출퇴근 시간 상이).
- 미출근·미퇴근: **감점 없음**, 해당 가산점만 미부여.
- **이번 달**은 `min(월말, 오늘)`까지 집계; 과거 월은 월 전체.
- 순위 동률: 총점 → 출퇴근 완료일 → 휴가일 → 이름.
- 1등(`coupon_target`)은 `score > 0`인 최상위 1명.

---

## 12. Backend — PDF·파일 다운로드

### 12.1 API (`api/common.py`, `services/common_service.py`)

- `GET /api/common/files/{file_id}` — 인증 후 스트리밍.
- `.pdf` → `Content-Type: application/pdf`.
- **권한** (`assert_user_may_download_uploaded_file`):
  - 개별 PDF: **수신 직원** + 관리자
  - 공지(`is_global`) PDF: 로그인 직원 + 관리자
  - 발신자(일반 직원)는 타인 수신 PDF 차단
  - `current_user.id` 없을 때 `userId`로 User PK fallback

### 12.2 PDF.js worker

- `frontend/public/pdf.worker.min.mjs` — `prestart`/`prebuild`에서 `pdfjs-dist` worker 복사.
- 운영: `static/pdf.worker.min.mjs` + `main.py` `GET /pdf.worker.min.mjs`.

---

## 13. Backend — 테스트 (`backend/tests/`)

- `conftest.py`: 임시 SQLite, `StaticPool`(TestClient 스레드 안전).
- `tests/api/`: RBAC, 보안 정책(`test_security_policies.py`), 테넌트 격리.
- `tests/services/admin/test_attendance_rewards.py`: 가산점 집계.
- `tests/support/memory_db.py`: 인메모리 전 스키마.

실행: `cd backend && uv run pytest` 또는 `python -m pytest`.

---

## 14. Frontend — `frontend/src/` 구조 (상세)

```
frontend/src/
├── routes/
│   ├── index.jsx           # /:tenantSlug/*, TenantLayout, PdfViewer
│   ├── hrRoutes.jsx
│   ├── adminRoutes.jsx     # AdminAttendanceRewards 포함
│   └── publicRoutes.jsx
├── pages/
│   ├── hr/
│   │   ├── Attendance.jsx
│   │   ├── TodoList.jsx    # 캘린더 + 도장 오버레이
│   │   └── PdfViewerPage.jsx   # PDF.js 캔버스 렌더링
│   └── admin/
│       ├── AdminAttendance.jsx
│       └── AdminAttendanceRewards.jsx
├── context/
│   ├── AuthContext.jsx
│   └── TenantContext.jsx   # slug·paths·브랜딩
├── api/
│   ├── axiosInstance.js
│   ├── attendanceApi.js    # calendar-stamps
│   └── adminApi.js         # monthly-rewards
├── utils/
│   ├── fileUtils.js        # openAuthenticatedDownloadByFileId → PDF 뷰어 URL
│   └── toastUtils.js       # 세션 만료 토스트
└── constants/paths.js, menu.js
```

**추가 의존성**: `pdfjs-dist` ^6.0.227.

---

## 15. Frontend — 라우팅·경로

- **테넌트**: `/:tenantSlug/login`, `/:tenantSlug/my/*`, `/:tenantSlug/admin/*`, `/:tenantSlug/careers/*`.
- **플랫폼**: `/platform/login`, `/platform/*`.
- **PDF 뷰어**: `/{tenant}/my/pdf-viewer?fileId=…` (`PATHS.MY_PDF_VIEWER`).
- **관리자 가산점**: `/{tenant}/admin/attendance-rewards` (`ADMIN_ATTENDANCE_REWARDS`).

`TenantContext` + `useAppPaths()`로 테넌트 prefix가 붙은 path 생성.

---

## 16. Frontend — API 클라이언트

- `withCredentials: true`, Authorization 헤더 **미사용**(쿠키만).
- `FormData` 업로드 시 `Content-Type` 제거.
- **401**: 세션 만료 토스트, 출퇴근 등 민감 액션 전 `checkAuth` 검증.
- **파일 열기**: `fileUtils.openAuthenticatedDownloadByFileId` → 새 탭 PDF 뷰어.

---

## 17. Frontend — 주요 화면 ↔ API

| 화면 | API |
|------|-----|
| 캘린더 (`TodoList.jsx`) | `todoService`, `holidayApi`, **`attendanceApi.getCalendarStamps`** |
| 출퇴근 (`Attendance.jsx`) | `clock-context`, `clock-in/out`, Geolocation, work-locations |
| PDF 뷰어 (`PdfViewerPage.jsx`) | `GET /api/common/files/{fileId}` + PDF.js worker |
| 관리자 가산점 (`AdminAttendanceRewards.jsx`) | `adminApi.getMonthlyAttendanceRewards` |
| 관리자 근태 (`AdminAttendance.jsx`) | 기간 조회, UserAttendanceDrawer |

---

## 18. CI/CD (`.github/workflows/`)

| 워크플로 | 트리거 | 런타임 | 작업 |
|----------|--------|--------|------|
| `backend-ci.yml` | `backend/**` 변경, PR/push to `master` | Python **3.12**, uv | `compileall`, `pytest` |
| `frontend-ci.yml` | `frontend/**` 변경 | Node **24** | `npm run lint`, `npm test -- --watchAll=false` |

캐시: uv lock / npm lockfile 기준.

---

## 19. 백엔드·프론트 연동 체크리스트

1. 브라우저는 **httpOnly 쿠키**로 JWT 전달.
2. CORS: `allow_credentials=True` + 프론트 origin 포함.
3. `REACT_APP_API_BASE_URL`이 **`/api`까지** 포함.
4. 테넌트 URL slug ↔ JWT `tenantId` 일치.
5. 운영 PDF: `pdf.worker.min.mjs`가 `static/`에 배포되어 있는지 확인.
6. `frontend/.env.production`은 gitignore 대상 — 빌드 시 환경 변수 별도 주입.

---

## 20. 빠른 색인

| 주제 | 경로 |
|------|------|
| FastAPI 엔트리 | `backend/app/main.py` |
| 테넌트 컨텍스트 | `backend/app/core/tenant.py`, `services/tenant_scope.py` |
| 월간 도장 | `services/hr/attendance_calendar_service.py`, `api/hr/attendance.py` |
| 월간 가산점 | `services/admin/attendance_reward_service.py`, `pages/admin/AdminAttendanceRewards.jsx` |
| PDF 권한·다운로드 | `services/common_service.py`, `pages/hr/PdfViewerPage.jsx` |
| 테넌트 라우팅 | `frontend/src/context/TenantContext.jsx`, `routes/index.jsx` |
| Axios·세션 | `frontend/src/api/axiosInstance.js` |
| CI | `.github/workflows/backend-ci.yml`, `frontend-ci.yml` |

---

*코드 변경 후 엔드포인트·가산점 정책·테넌트 규칙이 바뀌면 본 문서를 함께 갱신하는 것을 권장합니다.*
