# 사용자 프로필 확장 컬럼 DB 쿼리 (사진/부서/직급/급여계좌)

프로젝트는 현재 Alembic 마이그레이션을 사용하지 않고 `Base.metadata.create_all()` + 런타임 `ALTER TABLE`(SQLite)을 시도합니다.
그래도 운영/개발 DB 스키마를 미리 맞추려면 아래 쿼리를 사용할 수 있습니다.

## SQLite (`todo.db`) 예시

```sql
-- 부서 / 직급 마스터 테이블
CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_name TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position_name TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN user_profile_image_url TEXT;
ALTER TABLE users ADD COLUMN user_department TEXT;
ALTER TABLE users ADD COLUMN user_position TEXT;
ALTER TABLE users ADD COLUMN salary_bank_name TEXT;
ALTER TABLE users ADD COLUMN salary_account_number TEXT;
```

주의:
- SQLite는 컬럼이 이미 존재하면 `ALTER TABLE ... ADD COLUMN`이 실패합니다.
- 위 쿼리를 그대로 실행할 경우, 이미 컬럼이 추가된 환경에서는 스킵하거나 `table_info(users)`로 컬럼 존재 여부를 확인한 뒤 실행하세요.

## PostgreSQL / MySQL 공통(개념)

```sql
ALTER TABLE users
  ADD COLUMN user_profile_image_url VARCHAR(500),
  ADD COLUMN user_department VARCHAR(100),
  ADD COLUMN user_position VARCHAR(100),
  ADD COLUMN salary_bank_name VARCHAR(100),
  ADD COLUMN salary_account_number VARCHAR(50);
```

