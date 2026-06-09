# 운영 실행 가이드 (Windows)

프론트 정적 배포(`static/`)와 FastAPI 운영 서버 기동 절차입니다.  
로컬 개발은 [`README.md`](README.md), 멀티테넌트·URL은 [`MULTI_TENANT.md`](MULTI_TENANT.md)를 참고하세요.

> Linux/macOS용 `start_production.sh`는 저장소에 포함되어 있지 않습니다. 아래 `deploy_frontend`·`uvicorn` 단계를 수동으로 동일하게 수행하면 됩니다.

---

## 1) 사전 준비

- **uv**, **Node.js / npm** 설치
- 프로젝트 루트 **`.env`** — 운영값 설정 (백엔드는 `backend/.env.production`을 **자동 로드하지 않음**)
- **`frontend/.env.production`** — 빌드 시 `REACT_APP_API_BASE_URL` 등 (**gitignore 대상**, 서버에 파일만 두거나 CI에서 주입)

필수 예시:

```env
# frontend/.env.production (빌드 전)
REACT_APP_API_BASE_URL=https://api.example.com/api
```

백엔드 루트 `.env` 운영 권장:

```env
ENVIRONMENT=production
SECRET_KEY=…
CORS_ORIGINS=https://hr.example.com
FRONTEND_URL=https://hr.example.com
DEFAULT_TENANT_SLUG=valuesplay
BOOTSTRAP_DEFAULT_ADMIN=false
SERVE_UPLOADS_STATIC=false
DEV_AUTO_START_REACT=false
ALLOW_LEGACY_PUBLIC_APPLY=false
ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS=false
```

---

## 2) 초기 1회 세팅

```powershell
cd C:\project\hr
uv sync --project backend --group dev
cd frontend
npm ci
cd ..
```

운영 서버는 `npm ci` 권장.

---

## 3) 자동 실행 (`start_production.bat`)

프로젝트 루트:

```bat
start_production.bat
```

내부 순서:

1. `uv` 확인·동기화
2. **`deploy_frontend.bat`** — `npm run build` → `frontend/build` → 루트 **`static/`** 복사 (`static/uploads` 보존)
3. 운영 프로필 환경 변수 설정 (`ENVIRONMENT=production`, `BOOTSTRAP_DEFAULT_ADMIN=false` 등)
4. **Uvicorn** 기동: `uv run --project backend python -m uvicorn main:app --app-dir backend/app --host 0.0.0.0 --port %APP_PORT%`

포트 변경:

```bat
set APP_PORT=9000
start_production.bat
```

기본 포트: **8000** (`APP_PORT` 미설정 시).

---

## 4) 접속 URL (멀티테넌트)

단일 호스트에서 FastAPI가 SPA + API를 함께 서빙합니다.

| 용도 | URL 예 |
|------|--------|
| 테넌트 로그인 | `https://hr.example.com/{tenant}/login` |
| 직원 | `https://hr.example.com/{tenant}/my/todos` |
| 관리자 | `https://hr.example.com/{tenant}/admin/...` |
| 채용 | `https://hr.example.com/{tenant}/careers/...` |
| 플랫폼 관리 | `https://hr.example.com/platform/login` |
| API | `https://hr.example.com/api/...` |

루트 `/` → `/{DEFAULT_TENANT_SLUG}/login` 리다이렉트.

---

## 5) 배포 산출물 확인

| 항목 | 경로 |
|------|------|
| SPA | `static/index.html`, `static/static/js/*`, `static/static/css/*` |
| PDF.js worker | `static/pdf.worker.min.mjs` (`prebuild`에서 복사 — 누락 시 PDF 뷰어 실패) |
| 테넌트 브랜딩 | `static/uploads/tenant-branding/` (항상 `/uploads/tenant-branding` 노출) |
| 첨부 파일 | `SERVE_UPLOADS_STATIC=false` 권장 → `/api/common/files/{id}` |

브라우저: `http://<host>:<APP_PORT>/{tenant}/login`

---

## 6) 프론트만 재배포

```bat
deploy_frontend.bat
```

빌드 후 백엔드 재시작이 필요하면 `start_production.bat` 또는 uvicorn만 재기동.

---

## 7) 자주 발생하는 문제

| 증상 | 확인 |
|------|------|
| 빌드 실패 | `REACT_APP_API_BASE_URL` 누락 (`prebuild` 검증) |
| API 401·CORS | `CORS_ORIGINS`에 실제 프론트 origin 포함 |
| 로그인 후 튕김 | URL `{tenant}`와 JWT `tenantSlug` 일치 여부 |
| PDF 안 열림 | `static/pdf.worker.min.mjs` 배포 여부 |
| npm/uv 오류 | PATH·`npm ci` / `uv sync` 재실행 |

---

## 8) 관련 문서·스크립트

| 문서/파일 | 내용 |
|-----------|------|
| [`README.md`](README.md) | 로컬 온보딩 |
| [`research.md`](research.md) | API·기능 상세 |
| [`MULTI_TENANT.md`](MULTI_TENANT.md) | 테넌트·플랫폼 |
| `start_local.bat` | 로컬 개발 (Windows) |
| `start_production.bat` | 운영 기동 |
| `deploy_frontend.bat` | CRA → `static/` |
