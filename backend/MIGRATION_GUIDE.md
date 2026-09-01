# DB 마이그레이션·운영 전환 가이드

스키마 변경·DB 엔진 전환·멀티테넌트 마이그레이션 참고. 상세 모델: [`../research.md`](../research.md), 테넌트: [`../MULTI_TENANT.md`](../MULTI_TENANT.md).

---

## 1. SQLite → PostgreSQL (선택)

1. `backend/pyproject.toml` 의존성에 맞게 `uv sync --project backend --group dev`.
2. 루트 `.env`:

   ```env
   DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME
   ```

3. 앱 재기동 시 `db/session.py`가 해당 URL로 엔진 생성 (SQLite 전용 옵션 자동 제외).
4. **기존 SQLite 데이터 이전**은 pgloader, 덤프/복원, 또는 별도 ETL 필요.

---

## 2. 멀티테넌트 (`tenant_id`) 마이그레이션

현재 스키마는 HR·마스터·채용 테이블에 **`tenant_id`** + 복합 UNIQUE를 사용합니다.

- **신규 DB**: `init_db()` + 기동 시 기본 테넌트 `valuesplay` 시드.
- **레거시 DB**: `init_db()`가 SQLite에 대해 `tenant_id` 컬럼 `ALTER` 및 백필 시도.
  - HR 행(`attendance`, `todos`, 보고 등)은 `users.user_login_id`로 매칭되는 **첫 `tenant_id`**로 백필.
  - 동일 `user_login_id`가 여러 테넌트에 있던 **과거 데이터**는 한 테넌트에만 귀속될 수 있음 → 마이그레이션 후 데이터 검증 권장.
- **테넌트 삭제**: `tenant_id == 삭제 대상` 조건으로만 연관 행 삭제 (타 테넌트 동일 login_id 보호).

PostgreSQL 등에서 수동 보강 시 [`MULTI_TENANT.md`](../MULTI_TENANT.md)의 테이블·UNIQUE 목록 참고.

---

## 3. Alembic 도입 (스키마 이력 관리)

`create_all` + 런타임 `ALTER`(SQLite)만으로는 변경 이력 추적이 어렵습니다. 팀·배포 규모가 커지면 Alembic 권장.

```bash
cd backend
uv run alembic init alembic
```

- `env.py`에서 `db.session` / `db.base.Base.metadata` 연동.
- `alembic revision --autogenerate -m "…"` → `alembic upgrade head`
- 운영 배포 파이프라인에 `alembic upgrade head` 포함 권장.

---

## 4. 운영 체크리스트

| 항목 | 권장 |
|------|------|
| 기본 admin | `BOOTSTRAP_DEFAULT_ADMIN=false`, 안전한 비밀번호로 별도 생성 |
| 플랫폼 admin | `create_platform_admin.py` 또는 DB 등록 (운영 자동 생성 없음) |
| 비밀·키 | 루트 `.env` / 서버 환경 변수만, 저장소 커밋 금지 |
| 업로드 | `SERVE_UPLOADS_STATIC=false`, `/api/common/files/{id}` |
| 프론트 빌드 | `REACT_APP_API_BASE_URL` 운영 API URL |

---

## 5. 근태 컬럼 수동 보강 (비 SQLite / Alembic 미사용)

SQLite는 `init_db()`가 일부 컬럼을 자동 `ALTER`합니다. PostgreSQL 등:

```sql
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS night_work_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS shift_status VARCHAR(20);
```

`attendance_daily_summary`는 기동 시 없으면 생성. 운영 DB는 백업·권한 정책에 맞게 별도 마이그레이션 권장.

---

## 6. 테스트

```bash
cd backend
uv run pytest
```

테넌트 격리: `tests/api/test_tenant_isolation.py`, `tests/api/test_platform_tenants.py`.
