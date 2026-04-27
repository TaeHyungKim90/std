@echo off
setlocal

REM Run from this script's directory (project root)
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
	echo [ERROR] venv not found: "%cd%\venv"
	echo Create it first: python -m venv venv
	exit /b 1
)

call "venv\Scripts\activate.bat"

if not exist "deploy_frontend.bat" (
	echo [ERROR] deploy_frontend.bat not found in project root.
	exit /b 1
)

echo [INFO] Deploying frontend build to .\static ...
call ".\deploy_frontend.bat"
if errorlevel 1 (
	echo [ERROR] Frontend deployment failed. Production server will not start.
	exit /b 1
)

REM Production profile overrides
set ENVIRONMENT=production
set DEV_AUTO_START_REACT=false
set BOOTSTRAP_DEFAULT_ADMIN=false
set ALLOW_LEGACY_PUBLIC_APPLY=false
set ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS=false

if "%APP_PORT%"=="" set APP_PORT=8000

echo [INFO] Starting production server on port %APP_PORT%
python -m uvicorn main:app --app-dir ".\backend\app" --host 0.0.0.0 --port %APP_PORT%

endlocal
