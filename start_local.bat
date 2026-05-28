@echo off
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

REM Local profile overrides
set ENVIRONMENT=development

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

echo [INFO] Starting local server: uv run --project backend python .\backend\app\main.py
uv run --project backend python ".\backend\app\main.py"

endlocal
