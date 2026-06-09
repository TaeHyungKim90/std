@echo off
setlocal

cd /d "%~dp0"
set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%"

where uv >nul 2>nul
if errorlevel 1 (
	echo [INFO] uv not found. Installing uv...
	powershell -NoProfile -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"
	set "PATH=%USERPROFILE%\.local\bin;%USERPROFILE%\.cargo\bin;%PATH%"
	where uv >nul 2>nul
	if errorlevel 1 (
		echo [ERROR] uv install failed or not in PATH. Restart terminal and retry.
		exit /b 1
	)
)

echo [INFO] uv sync --project backend --group dev
uv sync --project backend --group dev
exit /b %ERRORLEVEL%
