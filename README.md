# HR / 채용 통합 앱 — 온보딩

로컬 실행, 환경 변수, **직원**·**지원자** 인증 차이를 한곳에서 정리했습니다. 상세한 CRA 안내는 [`frontend/README.md`](frontend/README.md)를 참고하세요.

---

## 로컬 기동 순서

1. **저장소 클론** 후 프로젝트 루트에서 Python 가상환경을 쓰는 경우 활성화합니다.
2. **환경 파일**
   - 루트: `.env.example` → `.env` 로 복사 후 값 입력 (백엔드가 **프로젝트 루트**의 `.env`를 읽습니다).
   - 프론트: `frontend/.env.example` → `frontend/.env` 로 복사 (`REACT_APP_API_BASE_URL` 등).
3. **백엔드 의존성** (루트의 `requirements.txt`):

   ```bash
   pip install -r requirements.txt
   ```

4. **프론트 의존성**

   ```bash
   cd frontend
   npm install
   ```

5. **서버 실행** (터미널 2개 권장)
   - **API (FastAPI)** — 작업 디렉터리는 `backend/app` 이어야 합니다.

     ```bash
     cd backend/app
     python main.py
     ```

     기본 포트: **8000** (`APP_PORT`로 변경 가능).  
     선택: 루트 `.env`에 `DEV_AUTO_START_REACT=true` 이면 백엔드 기동 시 CRA(`npm start`)를 함께 띄웁니다(개발 편의용, CI·운영에서는 `false`).

   - **프론트 (CRA)** — `DEV_AUTO_START_REACT`를 쓰지 않을 때:

     ```bash
     cd frontend
     npm start
     ```

     기본: **http://localhost:3000**  
     코드 스타일: `npm run lint` / 자동 수정 `npm run lint:fix` (`eslint-plugin-simple-import-sort`, `eslint-plugin-unused-imports`, react-hooks 규칙은 `react-app` 기본 유지)

6. 브라우저에서 프론트에 접속합니다. API 요청은 `REACT_APP_API_BASE_URL`(예: `http://localhost:8000/api`)로 나가며, **쿠키 세션**을 쓰므로 CORS에 프론트 오리진이 포함되어 있어야 합니다 (`CORS_ORIGINS`).

---

## 환경 변수

### 백엔드 (프로젝트 루트 `.env`)

`pydantic-settings`가 루트 `.env`를 로드합니다. 샘플은 [`.env.example`](.env.example), 운영 참고는 [`backend/.env.production.example`](backend/.env.production.example)입니다.

| 변수 | 필수 | 설명 |
|------|------|------|
| `SECRET_KEY` | ✅ | JWT 서명용 비밀키 (충분히 긴 랜덤 문자열) |
| `ALGORITHM` | ✅ | 기본 `HS256` |
| `ACCESS_TOKEN_EXPIRE_DAYS` | ✅ | 액세스 토큰·쿠키 만료 일수 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | ✅* | 카카오 로그인 (미사용 시에도 `.env.example`처럼 빈 값 허용 여부는 스키마 확인) |
| `KAKAO_REDIRECT_URI` | | 기본: 로컬 `http://localhost:8000/api/auth/kakao/callback` |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | ✅* | 네이버 로그인 |
| `NAVER_REDIRECT_URI` | | 기본: 로컬 네이버 콜백 URL |
| `PUBLIC_DATA_API_KEY` | ✅ | 공공데이터포털(공휴일 등) 인증키 |
| `HOLIDAY_API_URL` | | 공휴일 API 엔드포인트 (기본값 있음) |
| `ENVIRONMENT` | | `development` / `production` — `production`이면 쿠키 `Secure` 등 |
| `CORS_ORIGINS` | | 쉼표 구분, 예: `http://localhost:3000,http://127.0.0.1:3000` |
| `FRONTEND_URL` | | 소셜 로그인 리다이렉트 등, 예: `http://localhost:3000` |
| `APP_PORT` | | API 포트 (기본 `8000`) |
| `DATABASE_URL` | | 비우면 SQLite 기본. PostgreSQL 예: `postgresql+psycopg2://user:pass@localhost/todo` |
| `BOOTSTRAP_DEFAULT_ADMIN` | | `true`일 때만 기본 관리자 시드 (운영에서는 `false`) |
| `SERVE_UPLOADS_STATIC` | | `true`면 `/uploads` 정적 노출 (운영에서는 `false` 권장) |
| `DEV_AUTO_START_REACT` | | `true`면 `python main.py` 시 프론트 `npm start` 병행 |
| `ALLOW_LEGACY_PUBLIC_APPLY` | | 레거시 `POST /apply` 허용 (운영에서는 `false` 권장) |
| `ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS` | | ID 기반 레거시 지원자 API 허용 (운영에서는 `false` 권장) |

\* 로컬에서 OAuth를 쓰지 않을 때도 `.env.example` 수준으로 채워 두면 됩니다.

### 프론트엔드 (`frontend/.env`)

CRA는 `REACT_APP_` 접두사만 브라우저에 노출합니다. 샘플: [`frontend/.env.example`](frontend/.env.example), 빌드 참고: [`frontend/.env.production.example`](frontend/.env.production.example).

| 변수 | 필수 | 설명 |
|------|------|------|
| `REACT_APP_API_BASE_URL` | 로컬 권장 / **프로덕션 빌드 필수** | API 베이스 (**`/api` 프리픽스 포함**). 예: `http://localhost:8000/api`. 비어 있으면 `npm run build` 전 `prebuild` 검증에서 실패합니다. |
| `REACT_APP_FILE_DOWNLOAD_VIA_API` | | 첨부 다운로드를 API 경유로 할지 (기본 동작은 코드·백엔드 설정과 연동). |

Axios는 `withCredentials: true`로 **httpOnly 쿠키**를 보냅니다. 로컬에서 도메인이 다르면(예: 포트만 다른 localhost) 위 `CORS_ORIGINS`·`REACT_APP_API_BASE_URL` 조합이 맞는지 확인하세요.

---

## 직원 vs 지원자 인증

두 계열은 **서로 다른 쿠키**와 **다른 로그인 API**를 사용합니다. 동시에 두 세션이 붙을 수는 있으나, UI는 경로(`/my`, `/admin` vs `/careers`)에 따라 분리됩니다.

| 구분 | 쿠키 이름 | 로그인 API (예) | JWT 페이로드 특징 | 프론트 라우트 예 |
|------|-----------|-----------------|-------------------|------------------|
| **직원·관리자** | `accessToken` | `POST /api/auth/login` (+ 카카오/네이버 OAuth) | `userId`, `role`, `id`(숫자 id) 등 | `/login`, `/my/*`, `/admin/*` |
| **채용 지원자** | `applicantToken` | `POST /api/public/recruitment/login` | `applicantId`, `type: "applicant"` 등 | `/careers/login`, `/careers/*` |

- **직원**: `get_current_user` — Bearer 또는 `accessToken` 쿠키.
- **지원자**: `get_current_applicant` — `applicantToken` 쿠키 기반. 지원서 제출 등은 로그인 후 `/apply/me` 계열을 사용합니다 (레거시 공개 `/apply`는 설정으로 끌 수 있음).

프론트에서는 `AuthContext`가 직원 세션, `applicantSession` / `useApplicantSession`이 지원자 캐시·`/me`와 동기화합니다. API **401** 시에는 즉시 페이지 이동 대신 세션 만료 토스트와 선택적 로그인 이동을 쓰도록 되어 있습니다 (`axiosInstance`, `showSessionExpiredToast`).

---

## 관련 파일

| 목적 | 경로 |
|------|------|
| 백엔드 진입 | `backend/app/main.py` |
| 백엔드 설정 스키마 | `backend/app/core/config.py` |
| 직원 쿠키·로그인 | `backend/app/api/auth.py` |
| 지원자 쿠키·로그인 | `backend/app/api/public/recruitment.py` |
| 프론트 API 클라이언트 | `frontend/src/api/axiosInstance.js` |
| 환경 변수 예시 | `.env.example`, `frontend/.env.example` |
