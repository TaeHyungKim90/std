# DB 마이그레이션·운영 전환 가이드

## 1. SQLite → PostgreSQL (선택)

1. `pip install psycopg2-binary` (또는 `asyncpg` 등 사용 스택에 맞게).
2. `.env`에 연결 문자열 설정:
   ```env
   DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME
   ```
3. 앱 재시작 시 `db/session.py`가 해당 URL로 엔진을 만듭니다. SQLite 전용 옵션은 자동으로 제외됩니다.
4. **기존 SQLite 데이터 이전**은 `pgloader`, 덤프/복원 스크립트, 또는 앱 내 export/import 등 별도 작업이 필요합니다.

## 2. Alembic 도입 (스키마 이력 관리)

`create_all`만 쓰면 컬럼 추가·변경 이력이 코드와 DB에만 남습니다. 팀·배포가 커지면 Alembic 권장.

```bash
cd backend/app
pip install alembic
alembic init alembic
```

- `alembic.ini`의 `sqlalchemy.url`을 제거하고, `env.py`에서 `from db.session import SQLALCHEMY_DATABASE_URL` 등으로 프로젝트 설정을 읽게 맞춥니다.
- `target_metadata = Base.metadata` (`db.base`에서 import).
- 첫 리비전: `alembic revision --autogenerate -m "init"`
- 적용: `alembic upgrade head`

운영 배포 파이프라인에 `alembic upgrade head`를 넣으면 스키마와 코드 버전을 맞추기 쉽습니다.

## 3. 운영 체크리스트

| 항목 | 권장 |
|------|------|
| 기본 관리자 | `BOOTSTRAP_DEFAULT_ADMIN=false`, 초기 계정은 안전한 비밀번호로 별도 생성 |
| 비밀·키 | `.env`만 사용, 저장소에 커밋 금지 |
| 로그 | `config`의 `.env` 경로 출력은 개발에서만 (`ENVIRONMENT=development`) |
