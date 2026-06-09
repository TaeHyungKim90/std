# 멀티테넌트 SaaS (경로 기반)

한 호스트에서 여러 기업(테넌트) HR·채용을 분리 운영합니다.  
기술 상세: [`research.md`](research.md) §8, 온보딩: [`README.md`](README.md).

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

### 직원 활동 데이터 (`user_login_id` + `tenant_id`)

일일·주간·월간 보고, 일정(`todos`), 출퇴근(`attendance`), 일별 근태 요약, 연차 잔여(`user_vacations`), 일정 색상 설정(`todo_config`)은 **`tenant_id`와 `user_login_id`(문자열)를 함께** 키로 사용합니다.

| 테이블 | 복합 UNIQUE (요약) |
|--------|-------------------|
| `daily_reports` | `(tenant_id, user_id, report_date)` |
| `weekly_reports` | `(tenant_id, user_id, week_start_date)` |
| `monthly_reports` | `(tenant_id, user_id, month_start_date)` |
| `user_vacations` | `(tenant_id, user_id)` |
| `attendance_daily_summary` | `(tenant_id, user_id, work_date)` |
| `todo_config` | `(tenant_id, user_id, category_key)` |
| `todos`, `attendance` | `tenant_id` 인덱스 (행마다 저장) |

- API는 기존과 같이 JWT·`X-Tenant-Slug`로 테넌트를 정하고, 서비스는 `tenant_scope.*_in_tenant()`로 조회·저장합니다.
- **동일 로그인 ID**(예: `admin`)를 여러 테넌트에 두어도 보고·연차·출퇴근 데이터는 테넌트별로 분리됩니다.
- **레거시 DB 마이그레이션**: `tenant_id` 추가 시 `users`에서 `user_login_id`가 일치하는 첫 행의 `tenant_id`로 백필합니다. 같은 `user_login_id`가 여러 테넌트에 있던 기존 HR 행은 한 테넌트에만 귀속될 수 있으므로, 마이그레이션 후 신규 데이터부터 완전 분리됩니다.
- 테넌트 삭제 시 `user_id.in_(...)`가 아니라 **`tenant_id == 삭제 대상`** 으로 위 테이블을 정리합니다(타 테넌트 동일 ID 오삭제 방지).

메시지(`messages`)는 `users.id`(PK) 기준이라 본 절과 별도입니다.

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
| `DELETE` | `/api/platform/tenants/{id}` | 테넌트 영구 삭제 (`valuesplay` 등 기본 테넌트는 불가) |

**테넌트 생성 시 자동 처리**

1. slug 형식·중복 검증 (`validate_tenant_slug_format`)
2. `_seed_tenant_defaults` — TodoCategoryType 6종, WorkLocation 1건
3. (선택) `bootstrap_admin_login_id` / `bootstrap_admin_password` 로 해당 테넌트 admin 생성

### DB 초기화 (`init_db`)

- 최초 기동 시 `tenants`가 비어 있으면 기본 테넌트 `valuesplay`(기업명 **가치플레이**, **활성**) 1건 생성. 기존 DB도 기동 시 동일하게 맞춤
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

# 개발용(기본 true): 테넌트별 admin/1234 자동 생성 → 첫 로그인 시 비밀번호 변경 모달
BOOTSTRAP_DEFAULT_ADMIN=true
```

운영(`ENVIRONMENT=production`)에서는 `BOOTSTRAP_DEFAULT_ADMIN=false` 권장.

개발 환경에서는 `platform_admins`가 비어 있으면 서버 기동 시 **자동 1회 생성**합니다 (아래 «플랫폼 관리자 계정»). 운영은 자동 생성 없음.

### 프론트 (`.env`)

```env
REACT_APP_DEFAULT_TENANT_SLUG=valuesplay
REACT_APP_API_BASE_URL=http://localhost:8001/api
```

---

## 플랫폼 관리자 계정

### 개발 (자동)

`ENVIRONMENT=development` 이고 **`padmin` 계정이 없을 때** 기동 시 자동 생성합니다(다른 플랫폼 계정이 있어도 `padmin`은 추가).

| 항목 | 기본값 | `.env`로 변경 |
|------|--------|----------------|
| 아이디 | `padmin` | `PLATFORM_ADMIN_LOGIN_ID` |
| 비밀번호 | `padmin` | `PLATFORM_ADMIN_PASSWORD` |
| 이름 | `플랫폼 관리자` | `PLATFORM_ADMIN_NAME` |

로그인: **http://localhost:3000/platform/login**

`padmin`이 이미 있으면 건너뜁니다. 예전 `platform` 계정만 1개 있으면 `padmin`으로 ID·비밀번호를 맞춥니다.

### 운영

자동 생성 없음. 최초 1회는 `backend/scripts/create_platform_admin.py` 로 생성하거나 DB에 직접 등록합니다.

---

## 신규 기업(테넌트) 추가

### 권장: 플랫폼 관리 UI

1. 개발: 서버 기동 후 `/platform/login` (`padmin` / `padmin` 기본, `.env`로 변경 가능)
2. `/platform/tenants`에서 slug·기업명 입력 후 **테넌트 추가**
3. (선택) 초기 admin ID·비밀번호 입력 → 해당 테넌트 HR admin 자동 생성
4. HR 접속: `http://localhost:3000/{slug}/login`

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

- `common_service` 업로드 경로에 `uploads/{tenant_slug}/` prefix 미적용 (전역 uploads 디렉터리)

---

## 로컬 실행

Windows (권장):

```bat
start_local.bat
```

수동:

```bash
uv sync --project backend --group dev
uv run --project backend python backend/app/main.py   # 또는 DEV_AUTO_START_REACT=true
cd frontend && npm start
```

| 접속 | URL |
|------|-----|
| HR 로그인 (valuesplay) | http://localhost:3000/valuesplay/login |
| 플랫폼 관리 | http://localhost:3000/platform/login |
| 테넌트 관리 | http://localhost:3000/platform/tenants |

개발 부트스트랩 예:

- `BOOTSTRAP_DEFAULT_ADMIN=true`(기본) → 테넌트별 `admin` / `1234`, **첫 로그인 시 비밀번호 변경 안내**, **직원 목록에는 미표시** (`visible_in_user_list=false`)
- 플랫폼 관리자(개발) → 기동 시 자동 `padmin` / `padmin` (테이블 비어 있을 때만)

---

## 테스트

- `tests/api/test_tenant_isolation.py` — 테넌트 간 데이터 격리
- `tests/api/test_platform_tenants.py` — 플랫폼 테넌트 CRUD·HR JWT 거부
- `conftest.py` — `TENANT_HEADERS`, `BOOTSTRAP_DEFAULT_ADMIN`

```bash
cd backend && uv run pytest tests/api/test_tenant_isolation.py tests/api/test_platform_tenants.py -q
```
