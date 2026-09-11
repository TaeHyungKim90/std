# 영수증 OCR 지출결의서

기존 FastAPI/SQLAlchemy, React/Vite, 쿠키 인증과 테넌트 의존성을 재사용합니다. 현재 저장소의 Python 버전은 3.13입니다. 인증 구조 변경 없이 신규 테이블 3개를 기존 `init_db`의 `create_all`로 생성합니다.

## 사용 흐름

직원 메뉴의 **내 지출결의서 → 새 지출결의서**를 누르면 DRAFT가 먼저 저장됩니다. 영수증 업로드 후 OCR 제안값을 확인·수정하고, 검토 확인란을 체크하여 결재를 요청합니다. OCR 실패나 영수증이 없는 경우에도 수동 작성이 가능합니다.

관리자 메뉴의 **지출결의서 관리**에서 승인·반려(사유 필수)·회계처리 완료를 진행합니다. ACCOUNTED는 회계 반영 완료를 기록하며 실제 송금이나 지급을 실행하지 않습니다.

직원 화면: `/{tenant}/my/expenses`, `/{tenant}/my/expenses/{id}`

관리자 화면: `/{tenant}/admin/expenses`, `/{tenant}/admin/expenses/{id}`

## API

모든 API는 기존 인증 의존성 및 `X-Tenant-Slug` 처리를 그대로 사용합니다. 사용자/회사 입력을 받지 않고 JWT의 `tenantId`, `userId`에서 가져옵니다. `user_id`에는 숫자 PK가 아닌 `user_login_id`를 저장합니다.

| 영역 | 메서드/경로 | 동작 |
| --- | --- | --- |
| 직원 | POST `/api/hr/expenses` | 빈 DRAFT 생성 |
| 직원 | GET `/api/hr/expenses` | 본인 목록: status, skip, limit |
| 직원 | GET/PUT `/api/hr/expenses/{id}` | 상세/임시저장 수정 |
| 직원 | POST `/api/hr/expenses/{id}/receipt` | multipart: file, version |
| 직원 | POST `/api/hr/expenses/{id}/{action}` | submit/cancel/withdraw/reopen |
| 관리자 | GET `/api/admin/expenses` | 같은 회사 목록: status, skip, limit |
| 관리자 | GET `/api/admin/expenses/{id}` | 상세, OCR, 결재 이력 |
| 관리자 | POST `/api/admin/expenses/{id}/{action}` | approve/reject/account |

PUT과 상태 변경에는 최신 `version`이 필요합니다. 상태 변경 본문은 `{version, comment?, reviewed?}`입니다. submit은 `reviewed: true`가 필요합니다. 오래된 요청과 동시 수정은 HTTP 409이며 새로고침 후 다시 시도합니다. 금액은 Decimal/Numeric(14,2)와 JSON 문자열을 사용합니다. 상신 시 필수 항목과 공급가액+부가세=합계, 양수 합계를 검사합니다.

허용 전이: DRAFT→REQUESTED/CANCELED, REQUESTED→APPROVED/REJECTED/WITHDRAWN, REJECTED/WITHDRAWN→DRAFT, APPROVED→ACCOUNTED. 상태와 이력은 같은 트랜잭션에서 기록합니다. 결의번호는 UUID 기반이며 회사별 UNIQUE 제약을 둡니다.

## 파일과 OCR

- 기본 설정 `OCR_PROVIDER=mock`: 실제 문자 인식 없이 **예시값**을 반환합니다. 실서비스 OCR은 `ReceiptOcrProvider` 구현 및 factory 선택을 추가해야 합니다. 미지원 provider 및 분석 실패는 FAILED로 저장하고 수동 작성을 허용합니다.
- JPG/PNG 확장자·MIME·파일 시그니처와 10MB 제한을 검사합니다. 현재 검증은 시그니처 검사이며 전체 이미지 디코딩 검사는 아닙니다.
- `UploadedFile`을 재사용하되 영수증은 **backend/private_receipts/**에 저장합니다. 배포 시 쓰기 가능한 영속 볼륨으로 유지하고 DB와 함께 백업해야 합니다. 공개 정적 파일 경로나 웹서버 alias로 노출하면 안 됩니다.
- 공통 파일 다운로드 3개 경로 모두 영수증 ACL을 먼저 검사합니다. 소유자 또는 같은 회사 관리자만 접근할 수 있습니다. 타 회사 관리자도 거부합니다.
- OCR 결과는 결의서와 항상 연결되며, 제안값을 결의서에 자동 확정하지 않습니다. 허용 필드만 보관하고 raw text/JSON 및 전체 카드번호 필드는 저장하지 않습니다. 카드번호 입력은 `****1234` 형식만 허용합니다. 업로드한 영수증 이미지 자체는 원본 보관입니다.
- 교체된 영수증과 취소된 DRAFT는 감사 및 조회를 위해 유지합니다. 자동 보존 기간/삭제 작업은 포함하지 않았습니다. DB 저장 실패 시 새 디스크 파일을 제거합니다. 프로세스 강제 종료 시 남은 미연결 디스크 파일은 별도 운영 정리가 필요할 수 있습니다.

## 검증 명령

백엔드: `uv sync --frozen`, `uv run pytest`, 저장소 루트에서 `uv run --project backend pyright`.

프론트: `npm ci`, `npm run lint`, `npm run test:ci`, `npm run build`.

빌드 시 `REACT_APP_API_BASE_URL`을 배포 환경에 맞게 설정합니다. 로컬 검증에는 `http://localhost:8000/api`를 사용합니다.

추가 테스트는 상태 전이/반려 재상신/회수/검토 확인/금액 검증/권한/동시성/OCR 실패·부분 결과/파일 롤백/다운로드 ACL과 직원·관리자 React 동작을 검증합니다.

2026-09-11 로컬 검증: 백엔드 전체 183개 통과 후 테스트 2개를 추가하여 지출결의서 테스트 21개 전부 재통과. 프론트 전체 44개 통과. Pyright 0 errors, 프론트 lint 통과, 최종 production build 성공. 기존 Starlette/httpx 사용 경고와 대형 번들 경고가 남아 있습니다. 실제 OCR 서비스 및 운영 배포는 수행하지 않았습니다.
