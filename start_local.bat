@echo off
chcp 65001 >nul
setlocal

REM Run from this script's directory (project root)
cd /d "%~dp0"

REM uv 기본 설치 경로 (시스템 PATH 미등록 시에도 동작)
set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%"

where uv >nul 2>nul
if errorlevel 1 (
	echo [INFO] uv not found. Installing uv...
	powershell -NoProfile -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"
	if errorlevel 1 (
		echo [ERROR] uv install failed.
		exit /b 1
	)
	set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%"
	where uv >nul 2>nul
	if errorlevel 1 (
		echo [ERROR] uv was installed but is not available in this terminal.
		echo Restart PowerShell/CMD and run this script again.
		exit /b 1
	)
)

REM Local profile overrides
set ENVIRONMENT=development
set PYTHONIOENCODING=utf-8

REM Usage:
REM   start_local.bat		  -> backend + react
REM   start_local.bat backend  -> backend only
if /I "%~1"=="backend" (
	set DEV_AUTO_START_REACT=false
	echo [INFO] Mode: backend only
) else (
	set DEV_AUTO_START_REACT=true
	echo [INFO] Mode: backend + react
)

if /I not "%DEV_AUTO_START_REACT%"=="false" (
	if not exist "frontend\node_modules\" (
		echo [INFO] frontend\node_modules 없음 — npm ci 실행 중...
		pushd frontend
		call npm ci
		if errorlevel 1 (
			echo [ERROR] npm ci failed. React dev server will not start.
			popd
			exit /b 1
		)
		popd
	)
	echo [INFO] UI  ^(React dev^): http://localhost:3000
	echo [INFO] API ^(FastAPI^)  : http://localhost:8000  ^(.env APP_PORT 확인^)
	echo [INFO] 브라우저는 3000 포트로 여세요. 8000은 API/빌드 정적 파일용입니다.
)

echo [INFO] Starting local server: uv run --project backend python .\backend\app\main.py
uv run --project backend python ".\backend\app\main.py"

endlocal
