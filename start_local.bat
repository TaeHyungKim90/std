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

REM Local profile overrides
set ENVIRONMENT=development

REM Usage:
REM   start_local.bat          -> backend + react
REM   start_local.bat backend  -> backend only
if /I "%~1"=="backend" (
    set DEV_AUTO_START_REACT=false
    echo [INFO] Mode: backend only
) else (
    set DEV_AUTO_START_REACT=true
    echo [INFO] Mode: backend + react
)

echo [INFO] Starting local server: python .\backend\app\main.py
python ".\backend\app\main.py"

endlocal
