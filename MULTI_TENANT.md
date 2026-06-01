# 멀티테넌트 SaaS (경로 기반)

브랜치: `feature/multi-tenant`

## URL 구조

### HR (테넌트별)

| 구분 | 예시 URL |
|------|----------|
| 직원 | `https://hr.example.com/valuesplay/my/todos` |
| 테넌트 관리자 | `https://hr.example.com/valuesplay/admin/dashboard` |
| 채용(공개) | `https://hr.example.com/valuesplay/careers` |
| 로그인 | `https://hr.example.com/valuesplay/login` |

- 루트 `/` → `/{DEFAULT_TENANT_SLUG}/login` (기본: `valuesplay`)
- 테넌트 API는 동일 호스트 `/api/*` + **`X-Tenant-Slug`** 헤더로 테넌트 식별

### 플랫폼 관리 (테넌트와 분리)

HR 경로(`/{slug}/my`, `/{slug}/admin`)와 **겹치지 않도록** 별도 prefix 사용.

| 화면 | URL |
|------|-----|
| 플랫폼 로그인 | `/platform/login` |
| 테넌트(기업) 관리 | `/platform/tenants` |

`platform`은 예약 slug(`RESERVED_TENANT_SLUGS`)에 포함되어 기업 slug로 등록할 수 없습니다.

---

## 역할·인증 구분

| | 테넌트 HR 관리자 | 플랫폼 관리자 |
|--|------------------|---------------|
| 대상 | 한 기업 내부 운영 | SaaS 전체·테넌트 CRUD |
| URL | `/{slug}/admin/*` | `/platform/*` |
| 계정 테이블 | `users` (`role=admin`, `tenant_id` 필수) | `platform_admins` |
| API | `/api/admin/*` | `/api/platform/*` |
| JWT | `tenantId`, `tenantSlug` 포함 | `scope: "platform"` (테넌트 없음) |
| 쿠키 | `accessToken` | `platformAccessToken` |
| Axios | `axiosInstance` + `X-Tenant-Slug` | `platformApi` (테넌트 헤더 없음) |

테넌트 HR admin JWT로 플랫폼 API 접근은 **401**로 거부됩니다.

---

## 백엔드

### 데이터 모델

- `tenants` — `slug`, `name`, `is_active`, `created_at`
- `platform_admins` — 플랫폼 운영자 (테넌트 FK 없음)
- `users`, `departments`, `positions`, `work_locations`, `todo_category_type`, `holidays`, `resume_templates`, `applicants`, `job_postings`, `office_location` 등에 `tenant_id`

### 테넌트 요청 처리

- `core/tenant.py` — `require_tenant`, `get_tenant_by_slug`, `tenant_pk()`, `tenant_slug_str()`
- `services/tenant_scope.py` — `*_in_tenant(db, tenant_id)`, `get_user_by_login_id()` 등
- `api/deps.py` — `tenant_id_from_user()`
- JWT + `X-Tenant-Slug` 일치: `get_current_user_for_tenant`, `get_current_admin_for_tenant`

### 공개 테넌트 API (인증 없음)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `GET` | `/api/tenants` | 활성 테넌트 목록 (랜딩·선택) |
| `GET` | `/api/tenants/{slug}/exists` | slug 유효 여부 (프론트 `TenantContext`) |

### 플랫폼 API (플랫폼 admin 인증 필요)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `POST` | `/api/platform/auth/login` | 플랫폼 로그인 |
| `POST` | `/api/platform/auth/logout` | 로그아웃 |
| `GET` | `/api/platform/auth/me` | 세션 확인 |
| `GET` | `/api/platform/tenants` | 테넌트 전체 목록 (비활성 포함) |
| `POST` | `/api/platform/tenants` | 테넌트 생성 + 시드 + 선택적 admin |
| `PATCH` | `/api/platform/tenants/{id}` | `name`, `is_active` 수정 |

**테넌트 생성 시 자동 처리**

1. slug 형식·중복 검증 (`validate_tenant_slug_format`)
2. `_seed_tenant_defaults` — TodoCategoryType 6종, WorkLocation 1건
3. (선택) `bootstrap_admin_login_id` / `bootstrap_admin_password` 로 해당 테넌트 admin 생성

### DB 초기화 (`init_db`)

- 최초 기동 시 `tenants`가 비어 있으면 기본 테넌트 `valuesplay` 1건 생성
- 테넌트별 마스터 시드, (옵션) 테넌트 admin, (옵션) 플랫폼 admin 부트스트랩

---

## 프론트엔드

### 테넌트 HR

- `/:tenantSlug/*` — `TenantLayout`에서 slug 검증 (`GET /api/tenants/{slug}/exists`)
- `useAppPaths()` / `pathsForTenant(slug)` — Link·navigate 경로
- `axiosInstance` — `/platform` 이외 경로에 `X-Tenant-Slug` 자동 부착

### 플랫폼

- `constants/platformPaths.js` — `/platform/login`, `/platform/tenants`
- `context/PlatformAuthContext.jsx` — 플랫폼 세션
- `pages/platform/TenantMgmt.jsx` — 테넌트 CRUD UI
- `routes/platformRoutes.jsx` — `TenantLayout` **밖** 최상위 라우트

---

## 환경 변수

### 백엔드 (`.env`)

```env
DEFAULT_TENANT_SLUG=valuesplay
FRONTEND_URL=http://localhost:3000

# 개발용: 테넌트별 admin/1234 자동 생성
BOOTSTRAP_DEFAULT_ADMIN=true

# 개발용: 플랫폼 admin/platform 자동 생성
BOOTSTRAP_PLATFORM_ADMIN=true
```

운영(`ENVIRONMENT=production`)에서는 `BOOTSTRAP_*` 모두 **false** 권장.

### 프론트 (`.env`)

```env
REACT_APP_DEFAULT_TENANT_SLUG=valuesplay
REACT_APP_API_BASE_URL=http://localhost:8001/api
```

---

## 신규 기업(테넌트) 추가

### 권장: 플랫폼 관리 UI

1. `BOOTSTRAP_PLATFORM_ADMIN=true` 로 기동 후 `/platform/login` 접속
2. 기본 계정 `platform` / `platform` 로그인 (운영 전 반드시 변경)
3. `/platform/tenants`에서 slug·기업명 입력 후 **테넌트 추가**
4. (선택) 초기 admin ID·비밀번호 입력 → 해당 테넌트 HR admin 자동 생성
5. HR 접속: `http://localhost:3000/{slug}/login`

### 대안: API / DB 직접

```bash
# API (플랫폼 로그인 쿠키 필요)
POST /api/platform/tenants
{
  "slug": "acme",
  "name": "ACME Corp",
  "bootstrap_admin_login_id": "admin",
  "bootstrap_admin_password": "초기비밀번호"
}
```

```sql
-- 수동 INSERT (시드·admin은 init_db 재기동 또는 API 사용 권장)
INSERT INTO tenants (slug, name, is_active, created_at)
VALUES ('acme', 'ACME Corp', 1, datetime('now'));
```

---

## OAuth

- 소셜 로그인 URL 요청 시 **`X-Tenant-Slug`** 헤더 필요
- OAuth `state`에 `tenant` 포함 → 콜백 `/{tenant}/oauth/callback`

---

## 타입·코딩 패턴

SQLAlchemy 모델 필드는 basedpyright에서 `Column[int]` 등으로 추론될 수 있습니다. 런타임 값을 `int`/`str` 인자로 넘길 때:

```python
from core.tenant import tenant_pk, tenant_slug_str

tid = tenant_pk(tenant)
slug = tenant_slug_str(tenant)
# 또는 typing.cast(int, row.id)
```

서비스/API 스코핑 패턴:

```python
from services.tenant_scope import departments_in_tenant
from api.deps import tenant_id_from_user

departments_in_tenant(db, tenant_id_from_user(current_admin)).all()
```

---

## 남은 작업 (낮은 우선순위)

대부분의 admin/HR/public API에는 테넌트 스코핑이 적용되어 있습니다. 잔여 항목:

- `common_service` 업로드 경로에 `uploads/{tenant_slug}/` prefix 미적용
- `summary_dict_for_work_date(db, user_id, ...)` — 동일 `login_id`가 여러 테넌트에 있을 때 `tenant_id` 미전달 (엣지 케이스)

---

## 로컬 실행

```bash
# 백엔드 (스키마·시드는 기동 시 init_db 자동)
cd backend
python -m uvicorn main:app --reload --app-dir app

# 프론트
cd frontend && npm start
```

| 접속 | URL |
|------|-----|
| HR 로그인 (valuesplay) | http://localhost:3000/valuesplay/login |
| 플랫폼 관리 | http://localhost:3000/platform/login |
| 테넌트 관리 | http://localhost:3000/platform/tenants |

개발 부트스트랩 예:

- `BOOTSTRAP_DEFAULT_ADMIN=true` → 테넌트별 `admin` / `1234`
- `BOOTSTRAP_PLATFORM_ADMIN=true` → `platform` / `platform`

---

## 테스트

- `tests/api/test_tenant_isolation.py` — 테넌트 간 데이터 격리
- `tests/api/test_platform_tenants.py` — 플랫폼 테넌트 CRUD·HR JWT 거부
- `conftest.py` — `TENANT_HEADERS`, `BOOTSTRAP_DEFAULT_ADMIN`

```bash
cd backend && python -m pytest tests/api/test_tenant_isolation.py tests/api/test_platform_tenants.py -q
```
