@echo off
chcp 65001 >nul
setlocal

REM Run from this script's directory (project root)
cd /d "%~dp0"

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
set PYTHONIOENCODING=utf-8
set DEV_AUTO_START_REACT=false
set BOOTSTRAP_DEFAULT_ADMIN=false
set ALLOW_LEGACY_PUBLIC_APPLY=false
set ALLOW_LEGACY_APPLICANT_ID_ENDPOINTS=false

if "%APP_PORT%"=="" set APP_PORT=8000

echo [INFO] Starting production server on port %APP_PORT%
uv run --project backend python -m uvicorn main:app --app-dir ".\backend\app" --host 0.0.0.0 --port %APP_PORT%

endlocal
