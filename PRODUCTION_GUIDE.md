# 운영 실행 가이드 (Windows / Linux)

이 문서는 Windows / Linux 기준으로 프론트 정적 배포와 백엔드 운영 실행 절차를 안내합니다.

## 1) 사전 준비

- 프로젝트 루트에 `venv`가 있어야 합니다.
- Node.js / npm이 설치되어 있어야 합니다.
- 루트 `.env`와 `frontend/.env.production` 값이 운영값으로 설정되어 있어야 합니다.
- 특히 `frontend/.env.production`의 `REACT_APP_API_BASE_URL`은 필수입니다.

예시:

```env
REACT_APP_API_BASE_URL=https://api.example.com/api
```

## 2) 초기 1회 세팅 (가상환경 + 패키지 설치)

처음 서버를 올리기 전(또는 새 PC/새 서버)에는 아래를 1회 수행하세요.

Windows (PowerShell):

```powershell
cd C:\project\hr
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd frontend
npm ci
cd ..
```

Linux / macOS:

```bash
cd /path/to/hr
python3 -m venv venv
source ./venv/bin/activate
pip install -r requirements.txt
cd frontend
npm ci
cd ..
```

`npm ci` 대신 `npm install`을 써도 되지만, 운영 서버는 `npm ci`를 권장합니다.

## 3) 자동 실행 방식

운영 실행은 `start_production.bat`(Windows) 또는 `start_production.sh`(Linux)로 처리됩니다.

이 스크립트는 내부에서 다음을 순서대로 수행합니다.

1. 가상환경 활성화
2. `deploy_frontend.bat` 또는 `deploy_frontend.sh` 실행
   - `frontend`에서 `npm run build`
   - 빌드 결과를 루트 `static`에 복사
   - `static/uploads`는 보존
3. FastAPI 운영 서버 기동 (`uvicorn`)

## 4) 실행 방법

프로젝트 루트에서 아래 명령을 실행합니다.

```bat
start_production.bat
```

```bash
bash ./start_production.sh
```

포트를 바꾸려면 실행 전에 환경변수를 지정합니다.

```bat
set APP_PORT=9000
start_production.bat
```

```bash
APP_PORT=9000 bash ./start_production.sh
```

## 5) 배포 산출물 확인

- 프론트: `static/index.html`, `static/static/js/*`, `static/static/css/*`
- 백엔드: `http://<host>:<APP_PORT>/` 접속 시 프론트 화면 응답

## 6) 자주 발생하는 문제

- `REACT_APP_API_BASE_URL` 누락: 프론트 빌드가 실패합니다.
- npm 미설치/경로 미등록: `deploy_frontend.bat` / `deploy_frontend.sh`가 실패합니다.
- `venv` 없음: `start_production.bat` / `start_production.sh` 시작 단계에서 중단됩니다.

## 7) 수동 프론트 배포만 먼저 하고 싶을 때

아래 명령으로 프론트만 배포할 수 있습니다.

```bat
deploy_frontend.bat
```

```bash
bash ./deploy_frontend.sh
```
