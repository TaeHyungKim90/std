# CD(Continuous Deployment) 구성 가이드

이 문서는 **현재 CI 이후에 배포(CD)를 어떻게 붙일지**에 대한 간략한 방향입니다.  
구현은 `feature/cd` 브랜치에서 워크플로·스크립트를 추가하는 것을 전제로 합니다.

## 현재 상태 (CI만 존재)

| 워크플로 | 트리거 | 내용 |
|----------|--------|------|
| `.github/workflows/backend-ci.yml` | `master` push/PR, 태그 `v*.*.*` | uv sync → compileall → pytest |
| `.github/workflows/frontend-ci.yml` | 동일 | npm ci → lint → test |

**배포 자동화(CD)는 아직 없음.** 운영 반영은 `PRODUCTION_GUIDE.md` 기준으로 서버에서 `start_production.bat` / `start_production.sh` 수동 실행.

## CD 목표

1. `master` 머지(또는 릴리스 태그) 후 **검증된 산출물**만 운영 서버에 반영
2. 프론트 빌드 → `static/` 복사, 백엔드 재기동을 **한 파이프라인**으로 정리
3. 실패 시 배포 중단·이전 버전 유지(롤백 경로 명시)

## 권장 파이프라인 (단계)

```
[CI 통과] → [Build] → [Deploy] → [Smoke / Health]
```

### 1. 트리거

- **스테이징**: `master` push (path 필터: `backend/**`, `frontend/**`)
- **운영**: Git tag `v*.*.*` push 또는 `workflow_dispatch`(수동 승인)
- PR에는 CD 미실행(CI만) — 기존 정책 유지

### 2. Build job

| 영역 | 작업 | 산출물 |
|------|------|--------|
| Frontend | `npm ci` → `npm run build` (`REACT_APP_*`는 GitHub Environment secrets) | `frontend/build/` → artifact `static-ui` |
| Backend | `uv sync --locked` → (선택) docker image build | artifact 또는 container image |

로컬과 동일하게 빌드 결과는 루트 `static/` 구조에 맞춤 (`deploy_frontend.sh` 로직 재사용 권장).

### 3. Deploy job

환경별 **GitHub Environments** (`staging`, `production`) 권장.

- **SSH 배포(단일 VM)**  
  - Actions: `appleboy/scp-action` + `appleboy/ssh-action`  
  - 서버: artifact 압축 전송 → `static/` 갱신 → `uv sync` → `systemctl restart hr-api` (또는 `start_production.sh` 호출)
- **컨테이너**  
  - GHCR에 image push → 서버/오케스트레이터에서 pull & rolling update

운영 필수 env (서버 또는 Environment secret):

- `SECRET_KEY`, OAuth 키, `DATABASE_URL`, `FRONTEND_URL`, `CORS_ORIGINS`
- `BOOTSTRAP_*` = `false`, `ENVIRONMENT=production`
- 멀티테넌트: `DEFAULT_TENANT_SLUG`, `REACT_APP_DEFAULT_TENANT_SLUG`, `REACT_APP_API_BASE_URL`

### 4. 배포 후 검증

- `GET /` 또는 `GET /{DEFAULT_TENANT_SLUG}/login` — 200
- `GET /api/tenants` — 200
- (선택) `GET /platform/login` — 플랫폼 UI
- 실패 시 job 실패 처리 + 알림(Slack/이메일)

## 워크플로 파일 구성(안)

```
.github/workflows/
  backend-ci.yml      # 기존 유지
  frontend-ci.yml     # 기존 유지
  deploy-staging.yml    # master → staging 서버
  deploy-production.yml # tag v*.*.* → production (approval)
```

`deploy-*.yml`은 `needs`로 CI 워크플로 완료를 기다리거나, 동일 워크플로 내 `build` → `deploy` job 체인으로 구성.

## 브랜치·릴리스 정책

| 브랜치/태그 | CI | CD |
|-------------|----|----|
| PR → `master` | O | X |
| `master` push | O | staging (선택) |
| `v1.2.3` tag | O | production |

## 롤백

- **정적 프론트**: 이전 `static` 백업 디렉터리(`static.backup-YYYYMMDD`)로 교체
- **백엔드**: 이전 git tag 체크아웃 + `uv sync` + 서비스 재시작
- DB 스키마 변경은 CD와 분리 — `init_db` 런타임 ALTER에 의존하지 말고 마이그레이션 단계 명시(Alembic 등 추후)

## 다음 작업 체크리스트

- [ ] GitHub Environments + secrets 등록
- [ ] `deploy-staging.yml` 초안 (SSH 또는 Docker 중 하나 선택)
- [ ] `deploy-production.yml` + manual approval
- [ ] 서버 `systemd` 유닛 또는 프로세스 매니저로 uvicorn 상시 실행
- [ ] `static/uploads` 배포 시 덮어쓰지 않도록 스크립트 보장 (기존 `deploy_frontend` 동작 유지)

## 참고 문서

- `PRODUCTION_GUIDE.md` — 수동 운영·빌드 절차
- `MULTI_TENANT.md` — 테넌트·플랫폼 URL·환경 변수 (멀티테넌트 브랜치)
