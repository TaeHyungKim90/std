# Frontend (Create React App)

HR·채용 **멀티테넌트 SPA**. 테넌트별 경로 `/{tenantSlug}/my/*`, `/{tenantSlug}/admin/*`, `/{tenantSlug}/careers/*`와 플랫폼 `/platform/*`를 React Router 7로 제공합니다.

- 저장소 온보딩: [`../README.md`](../README.md)
- API·기능 상세: [`../research.md`](../research.md)
- 파일 네이밍: [`FILE_CONVENTIONS.md`](FILE_CONVENTIONS.md)

---

## 요구 사항

- **Node.js 24** (CI 기준, LTS 호환 버전 권장)
- npm

---

## 환경 변수

`frontend/.env.example` → `frontend/.env` (로컬)

| 변수 | 설명 |
|------|------|
| `REACT_APP_API_BASE_URL` | **`/api` 포함** (예: `http://localhost:8000/api`) |
| `REACT_APP_DEFAULT_TENANT_SLUG` | 기본 테넌트 slug (선택) |
| `REACT_APP_FILE_DOWNLOAD_VIA_API` | 첨부·PDF API 경유 (권장) |

프로덕션 빌드: `frontend/.env.production` 또는 빌드 시 환경 변수 주입. **`npm run build` 전 `prebuild`가 `REACT_APP_API_BASE_URL`을 검증**합니다.

---

## 스크립트

```bash
npm install          # 또는 npm ci
npm start            # prestart: PDF worker 복사 → http://localhost:3000
npm run build        # prebuild: worker 복사 + env 검증 → build/
npm run lint         # ESLint (max-warnings 0)
npm run lint:fix
npm test             # Jest (watch)
npm run test:ci      # CI: --watchAll=false
```

**로컬 접속 예** (테넌트 `valuesplay`):

- `http://localhost:3000/valuesplay/login`
- `http://localhost:3000/valuesplay/my/todos`

플랫폼: `http://localhost:3000/platform/login`

Windows에서 백엔드+프론트 동시 기동: 프로젝트 루트 [`start_local.bat`](../start_local.bat)

---

## 주요 디렉터리

```
src/
├── routes/           # index.jsx (TenantLayout), hr/admin/public/platform
├── context/          # AuthContext, TenantContext, PlatformAuthContext
├── pages/
│   ├── hr/           # TodoList(도장), Attendance, PdfViewerPage, …
│   ├── admin/        # AdminAttendanceRewards, …
│   └── platform/     # TenantMgmt
├── api/              # axiosInstance (+ X-Tenant-Slug), adminApi, attendanceApi
├── constants/        # paths.js, menu.js
└── utils/            # fileUtils (PDF 뷰어 URL), toastUtils (세션 만료)
```

---

## 테넌트·API

- `TenantLayout`이 `GET /api/tenants/{slug}/exists`로 slug 검증.
- `axiosInstance`: `/platform` 제외 요청에 **`X-Tenant-Slug`** 자동 부착, **`withCredentials: true`** (httpOnly 쿠키).
- URL slug와 JWT tenant 불일치 시 비로그인 처리.

---

## PDF 뷰어

- 라우트: `/{tenant}/my/pdf-viewer?fileId=…`
- `pdfjs-dist` + `public/pdf.worker.min.mjs` (`scripts/copy-pdf-worker.js`가 prestart/prebuild에서 동기화)
- 운영: 빌드 산출물에 worker 포함 → [`deploy_frontend.bat`](../deploy_frontend.bat)로 `static/` 배포

---

## 빌드·배포

```bat
cd frontend
npm run build
```

산출물은 루트 [`deploy_frontend.bat`](../deploy_frontend.bat)가 `static/`으로 복사합니다. CRA 기본 [deployment 문서](https://create-react-app.dev/docs/deployment/)도 참고할 수 있습니다.

---

## CI

[`.github/workflows/frontend-ci.yml`](../.github/workflows/frontend-ci.yml) — Node 24, `npm ci`, lint, test.
