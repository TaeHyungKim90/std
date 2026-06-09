# 사용자 프로필 확장 컬럼 DB 쿼리 (사진/부서/직급/급여계좌)

Alembic 없이 `create_all()` + SQLite 런타임 `ALTER`를 쓰는 경우, 운영/개발 DB를 수동으로 맞출 때 참고합니다.

**멀티테넌트**: `departments`, `positions`는 **`tenant_id` + 이름** 복합 UNIQUE. `users`는 **`tenant_id` + `user_login_id`** 조합으로 테넌트별 직원.

---

## SQLite 예시

```sql
-- tenants (init_db가 없으면 먼저 생성)
-- departments / positions (테넌트별)
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, department_name)
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  position_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, position_name)
);

-- users 프로필 확장 (컬럼 존재 시 스킵)
ALTER TABLE users ADD COLUMN user_profile_image_url TEXT;
ALTER TABLE users ADD COLUMN user_department TEXT;
ALTER TABLE users ADD COLUMN user_position TEXT;
ALTER TABLE users ADD COLUMN salary_bank_name TEXT;
ALTER TABLE users ADD COLUMN salary_account_number TEXT;
```

주의:

- SQLite는 컬럼이 이미 있으면 `ADD COLUMN` 실패 → `PRAGMA table_info(users)`로 확인.
- 레거시 `departments.department_name UNIQUE`(전역) 스키마는 멀티테넌트와 맞지 않음 → 테넌트별 UNIQUE로 재생성 필요.

---

## PostgreSQL 개념

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS user_profile_image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS user_department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS user_position VARCHAR(100),
  ADD COLUMN IF NOT EXISTS salary_bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS salary_account_number VARCHAR(50);
```

프로필 이미지 URL은 테넌트 쿼리 파라미(`tenant=`)·same-origin 경로를 프론트에서 지원합니다.
