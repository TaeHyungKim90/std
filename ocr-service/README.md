# PaddleOCR 영수증 서비스

HR에서 **DRAFT 생성 → 영수증 업로드 → 내부 PaddleOCR 호출 → 제안값 표시 → 직원 확인 → 상신**까지 연결했습니다. 직원·회사 인증은 기존 HR에서 처리하며, OCR 서비스에는 이미지와 서비스 인증 토큰만 전송합니다. HR DB 접속 권한과 사용자 정보는 넘기지 않습니다.

Python 3.12.13, PaddleOCR 3.7.0, PaddlePaddle CPU 3.3.1을 사용합니다. 한국어 지원 모델을 명시하기 위해 `PP-OCRv5_mobile_det`와 `korean_PP-OCRv5_mobile_rec`를 고정했습니다. 라이브러리 버전과 모델 버전은 별개입니다. 일반 OCR만 설치하며 문서 분석·LLM 추가 기능은 사용하지 않습니다. 정확한 하위 의존성은 `uv.lock`에 고정했습니다.

## HR에 적용

### 1. 설정

기존 저장소 루트 `.env`에 다음을 **추가/수정**합니다. 기존 인증·DB 설정을 덮어쓰지 않습니다.

```dotenv
OCR_PROVIDER=paddleocr
OCR_SERVICE_URL=http://127.0.0.1:8010
OCR_SERVICE_TOKEN=<32자 이상 랜덤 토큰>
OCR_TIMEOUT_SECONDS=65
```

토큰은 아래처럼 생성하여 HR과 OCR 서비스에 같은 값을 넣습니다. Git이나 프론트엔드 환경변수에는 저장하지 않습니다.

```shell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Docker로 실행 (권장)

Docker가 실행 중인 Linux/Windows Docker Desktop에서 저장소 루트 기준:

```shell
docker compose -f compose.ocr.yaml up -d --build
docker compose -f compose.ocr.yaml ps
```

이미지 빌드 시 공식 모델 아카이브를 다운로드하고 코드에 고정된 SHA-256을 검증합니다. 운영 실행 시에는 모델 다운로드가 필요하지 않습니다. 모델 경로는 읽기 전용이며, 파일 내용은 시작 시 manifest와 대조합니다.

구성은 CPU 2개·메모리 2GB·프로세스 128개 제한, 비루트 사용자, 읽기 전용 파일시스템, `/tmp` 256MB 임시 공간, 외부 통신 없는 내부 네트워크입니다. 포트는 호스트 `127.0.0.1:8010`에만 바인딩합니다. HR이 같은 호스트에서 직접 실행되는 구성을 기본으로 합니다.

HR도 컨테이너라면 `127.0.0.1` 대신 내부 공유 네트워크에 연결하여 `http://receipt-ocr:8010`을 사용합니다. 이 경우 호스트 포트 공개를 제거해도 됩니다. 다른 서버를 경유하면 사설망/TLS를 적용해야 합니다.

### 3. HR 재시작 및 확인

환경변수를 읽도록 기존 방식으로 HR 백엔드를 재시작합니다. **내 지출결의서 → 새 지출결의서 → JPG/PNG 영수증 업로드** 후 실제 인식 결과가 채워지는지 확인합니다. 기존 프론트도 최신 빌드로 배포합니다.

OCR 서비스가 없거나 토큰이 틀리면 예시값으로 대체하지 않고 분석 실패를 표시합니다. 영수증은 남고 직원이 수동으로 작성할 수 있습니다. Mock이 필요할 때만 `OCR_PROVIDER=mock`을 명시합니다.

## Docker 없이 로컬 개발

`ocr-service` 디렉터리에서:

```shell
uv sync --frozen
uv run python models.py
```

같은 터미널의 `OCR_SERVICE_TOKEN` 환경변수에 HR과 동일한 토큰을 설정한 다음 실행합니다. PowerShell은 `$env:OCR_SERVICE_TOKEN='생성한 토큰'`, Linux는 `export OCR_SERVICE_TOKEN='생성한 토큰'`을 사용합니다.

```shell
uv run uvicorn app:app --host 127.0.0.1 --port 8010 --workers 1 --no-access-log --limit-concurrency 8
```

Linux에서는 OpenCV/Paddle 런타임용 `libgl1`, `libglib2.0-0`, `libgomp1`이 필요합니다. 네이티브 실행은 Docker의 메모리/CPU/외부 통신 제한을 제공하지 않으므로 개발 검증용입니다.

## 추출 범위와 제한

- 거래처: `상호명/상호/가맹점명` 라벨이 있는 경우만 추출합니다. 라벨 없는 상호는 직원이 입력합니다.
- 사업자번호, 날짜, 공급가액, 부가세, 합계, 결제수단, 이미 마스킹된 카드 뒷자리만 반환합니다.
- 글자 위치를 이용해 같은 행의 라벨과 금액을 연결합니다. 낮은 신뢰도, 상충하는 합계, 잘못된 날짜, 환불/음수 금액은 자동 채우지 않습니다.
- 공급가액+부가세가 합계와 다르면 세부 세액을 비워 둡니다. 부가세를 총액의 1/11로 임의 계산하지 않습니다. 면세·할인·여러 장 합성 영수증은 수동 확인이 필요합니다.
- 지출구분·계정과목·사용목적은 직원이 입력합니다. 인식 결과는 확정 데이터가 아닙니다.
- 한 번에 1건을 처리하고 추가 요청은 거부합니다. 이미지 본문 수신은 15초, 추론은 60초 제한입니다. 추론을 초과하면 별도 프로세스를 종료하고 다음 요청에서 재생성합니다.
- 첫 요청은 모델 로딩으로 더 느립니다. 이후 같은 프로세스에서 모델을 재사용합니다. `/health`는 설정·모델 파일 준비 상태를 확인하며 실제 인식 결과를 보장하지 않습니다.
- 모델 학습/외부 AI API/외부 URL 입력/사용자 모델 업로드는 제공하지 않습니다. OCR 원문과 전체 카드번호는 API/DB/로그로 반환하지 않지만 HR 원본 첨부 이미지는 기존 ACL 아래 유지됩니다.
- 이미지 방향은 EXIF를 반영합니다. 임의로 회전된 영수증이나 흐릿한 사진은 똑바로 촬영해 다시 올려야 합니다.

## 검증 및 취약점 점검

```shell
uv run python -m pytest tests -q
uv run pyright
uv run pip-audit --format cyclonedx-json --output audit-sbom.json
```

실제 한국어 모델 테스트는 운영 영수증 대신 생성한 테스트 이미지로 실행합니다:

```shell
# Windows
uv run python smoke.py --font C:/Windows/Fonts/malgun.ttf
uv run python live_hr_smoke.py --font C:/Windows/Fonts/malgun.ttf --backend-python ../backend/.venv/Scripts/python.exe

# Linux: fonts-nanum 설치 필요
uv run python smoke.py --font /usr/share/fonts/truetype/nanum/NanumGothic.ttf
uv run python live_hr_smoke.py --font /usr/share/fonts/truetype/nanum/NanumGothic.ttf --backend-python ../backend/.venv/bin/python
```

HR 통합 테스트에는 별도 임시 DB와 테스트 계정을 사용하며 운영 DB를 건드리지 않습니다. 로컬 실제 모델 테스트는 Windows CPU에서 거래처·사업자번호·날짜·세액·합계를 확인했습니다. 영수증 샘플 한 종류에 대한 기능 검증이므로 실제 영수증 인식률을 의미하지는 않습니다.

`Receipt OCR CI`는 PR/관련 코드 push 시 OCR 테스트·타입 검사·실제 모델/HR 연결 검사, Python 의존성 감사와 SBOM 생성, Docker 빌드와 Trivy 검사를 실행합니다. Python의 알려진 취약점은 모두 실패 처리하며, 컨테이너는 수정 버전 유무와 관계없이 HIGH/CRITICAL 발견 시 실패합니다. 보고서는 Actions artifact에 저장됩니다. 기존 HR 의존성 전체의 보안 인증을 의미하지 않습니다.

운영 투입 전 해당 커밋의 CI 결과를 확인하고, 이미지 digest를 기록해 검증한 이미지를 배포합니다. 패키지 취약점 DB 검사만으로 모델·네이티브 라이브러리·애플리케이션의 모든 취약점을 보장할 수 없습니다. 의존성/모델 변경 시 재검증합니다.

참고: [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [OCR API](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html), [pip-audit](https://github.com/pypa/pip-audit), [Trivy Action](https://github.com/aquasecurity/trivy-action).
