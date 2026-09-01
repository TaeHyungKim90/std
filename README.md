# HR / 채용 통합 앱 — 온보딩

**멀티테넌트** HR·근태·채용 SPA입니다. 테넌트(회사)별로 직원·관리자·지원자 화면이 분리되며, 출퇴근 도장·월간 가산점·PDF 뷰어 등을 포함합니다.

- 상세 기술 분석: [`research.md`](research.md)
- 멀티테넌트: [`MULTI_TENANT.md`](MULTI_TENANT.md)
- CRA 세부: [`frontend/README.md`](frontend/README.md)
- Windows 운영 배포: [`PRODUCTION_GUIDE.md`](PRODUCTION_GUIDE.md)
- 직원 화면 안내: [`manual.md`](manual.md)

---

## 빠른 시작 (Windows)

프로젝트 루트에서:

```bat
start_local.bat
```

- 백엔드 + CRA를 함께 띄웁니다 (`DEV_AUTO_START_REACT=true`).
- API만: `start_local.bat backend`
- `uv`가 없으면 스크립트가 설치를 시도합니다.

접속 URL (기본 테넌트 slug는 `.env`의 `DEFAULT_TENANT_SLUG`, 예: `valuesplay`):

| 용도 | URL |
|------|-----|
| 직원·관리자 로그인 | `http://localhost:3000/{tenant}/login` |
| 직원 캘린더 | `http://localhost:3000/{tenant}/my/todos` |
| 관리자 | `http://localhost:3000/{tenant}/admin/...` |
| 채용(지원자) | `http://localhost:3000/{tenant}/careers/...` |
| 플랫폼 관리 | `http://localhost:3000/platform/login` |

> CRA 개발 서버는 **3000**, API는 `.env`의 `APP_PORT`(기본 예: `8000` 또는 `8001`)입니다. `REACT_APP_API_BASE_URL`과 포트가 일치해야 합니다.

---

## 로컬 기동 순서 (수동)

1. **저장소 클론** 후 [uv](https://docs.astral.sh/uv/) 설치.
2. **환경 파일**
   - 루트: `.env.example` → `.env` (백엔드는 **프로젝트 루트** `.env`만 읽음)
   - 프론트: `frontend/.env.example` → `frontend/.env`
3. **백엔드 의존성**

   ```bash
   uv sync --project backend --group dev
   ```

4. **프론트 의존성**

   ```bash
   cd frontend
   npm install
   ```

5. **서버 실행** (터미널 2개 권장)

   ```bash
   # API — 프로젝트 루트
   uv run --project backend python backend/app/main.py
   ```

   ```bash
   # CRA — DEV_AUTO_START_REACT=false 일 때
   cd frontend
   npm start
   ```

   `DEV_AUTO_START_REACT=true`이면 백엔드만 실행해도 CRA가 함께 뜹니다.

6. 브라우저에서 `http://localhost:3000/{tenant}/login` 접속. API는 `REACT_APP_API_BASE_URL`(예: `http://localhost:8000/api`)로 **쿠키 세션** 요청 — `CORS_ORIGINS`에 프론트 오리진 포함 필요.

**품질 검사**

```bash
# 백엔드
cd backend && uv run pytest

# 프론트
cd frontend && npm run lint && npm test -- --watchAll=false
```

GitHub Actions: `.github/workflows/backend-ci.yml`(Python 3.12), `frontend-ci.yml`(Node 24).

---

## 환경 변수

### 백엔드 (프로젝트 루트 `.env`)

샘플: [`.env.example`](.env.example). 운영 참고: [`backend/.env.production.example`](backend/.env.production.example).

> 백엔드는 `backend/.env.production`을 자동 로드하지 않습니다. 운영 변수는 **루트 `.env` 또는 서버 환경 변수**로 주입하세요.

| 변수 | 필수 | 설명 |
|------|------|------|
| `SECRET_KEY` | ✅ | JWT 서명용 |
| `ACCESS_TOKEN_EXPIRE_DAYS` | ✅ | 액세스 토큰·쿠키 만료 일수 |
| `KAKAO_*` / `NAVER_*` | ✅* | 소셜 로그인 (로컬 미사용 시 `.env.example` 수준) |
| `PUBLIC_DATA_API_KEY` | ✅ | 공공데이터포털(공휴일) |
| `ENVIRONMENT` | | `development` / `production` |
| `CORS_ORIGINS` | | 예: `http://localhost:3000,http://127.0.0.1:3000` |
| `FRONTEND_URL` | | OAuth 리다이렉트 등 |
| `APP_PORT` | | API 포트 (`.env`와 `REACT_APP_API_BASE_URL` 포트 일치) |
| `DEFAULT_TENANT_SLUG` | | 루트 `/`·레거시 경로 리다이렉트 기본 테넌트 (예: `valuesplay`) |
| `DATABASE_URL` | | 비우면 SQLite. PostgreSQL 예: `postgresql+psycopg2://…` |
| `BOOTSTRAP_DEFAULT_ADMIN` | | `true` 시 테넌트별 `admin`/`1234` 시드 (운영 `false` 권장) |
| `PLATFORM_ADMIN_*` | | 개발: `platform_admins` 비어 있으면 플랫폼 관리자 자동 생성 (기본 `padmin`) |
| `SERVE_UPLOADS_STATIC` | | `true`면 `/uploads` 직접 노출 (운영 `false` + `/api/common/files/{id}` 권장) |
| `DEV_AUTO_START_REACT` | | `true`면 `main.py` 실행 시 `npm start` 병행 |
| `ALLOW_LEGACY_*` | | 레거시 채용 API (운영 `false` 권장) |

### 프론트엔드 (`frontend/.env`)

| 변수 | 필수 | 설명 |
|------|------|------|
| `REACT_APP_API_BASE_URL` | 로컬 권장 / **빌드 필수** | **`/api` 포함**. 예: `http://localhost:8000/api` |
| `REACT_APP_FILE_DOWNLOAD_VIA_API` | | 첨부를 API 경유로 열지 (PDF 뷰어·권한 연동) |

`frontend/.env.production`은 gitignore 대상 — CI·배포 시 별도 주입.

Axios: `withCredentials: true` (**httpOnly 쿠키**). Authorization 헤더는 사용하지 않습니다.

---

## 멀티테넌트·URL

- 모든 직원·관리자·채용 화면은 **`/{tenant_slug}/…`** 아래에 있습니다.
- JWT에 `tenantId`가 포함되며, **URL slug와 JWT 테넌트가 다르면 비로그인** 처리됩니다.
- HR 데이터(근태·일정·공휴일·보고 등)는 DB **`tenant_id`** 로 격리됩니다.
- **플랫폼 관리**(`/platform/*`): 테넌트 생성·브랜딩 — 직원 HR과 별도 계정(`platform_admins`).

레거시 `/my/*`, `/admin/*`(테넌트 prefix 없음)는 `DEFAULT_TENANT_SLUG` 로그인으로 리다이렉트됩니다.

---

## 직원 vs 지원자 인증

| 구분 | 쿠키 | 로그인 API | 프론트 라우트 예 |
|------|------|------------|------------------|
| **직원·관리자** | `accessToken` | `POST /api/auth/login` (+ OAuth) | `/{tenant}/login`, `/{tenant}/my/*`, `/{tenant}/admin/*` |
| **채용 지원자** | `applicantToken` | `POST /api/public/recruitment/login` | `/{tenant}/careers/login`, `/{tenant}/careers/*` |

- **401**: 즉시 강제 이동 대신 **세션 만료 토스트** → 사용자가 로그인 페이지로 이동 (`axiosInstance`).
- 출퇴근 등 민감 액션 전 **세션 유효성**을 한 번 더 확인합니다.

---

## 주요 기능 (요약)

| 기능 | 설명 |
|------|------|
| 출퇴근 | GPS·근무장소, 다회 출근, 종일 연차/공가 확인 |
| 캘린더 도장 | 월간 출근·퇴근·휴가 도장 (`/my/todos`) |
| 월간 가산점 | 관리자 `/admin/attendance-rewards` — **실시간 집계**(출퇴근 완료 +1, 휴가 +1) |
| PDF 뷰어 | `/my/pdf-viewer?fileId=…` — 수신자·공지 PDF 권한 검사 |
| 채용 | 공고·지원·이력서 템플릿 (테넌트별) |

상세 API·폴더 구조는 [`research.md`](research.md) §10–12 참고.

---

## 관련 파일

| 목적 | 경로 |
|------|------|
| 로컬 기동 (Windows) | `start_local.bat` |
| 백엔드 진입 | `backend/app/main.py` |
| 설정 | `backend/app/core/config.py` |
| 테넌트 | `backend/app/core/tenant.py`, `services/tenant_scope.py` |
| 직원 로그인 | `backend/app/api/auth.py` |
| 지원자 로그인 | `backend/app/api/public/recruitment.py` |
| 프론트 테넌트 라우팅 | `frontend/src/context/TenantContext.jsx`, `routes/index.jsx` |
| API 클라이언트 | `frontend/src/api/axiosInstance.js` |
| CI | `.github/workflows/backend-ci.yml`, `frontend-ci.yml` |
