@echo off
setlocal

REM Run from this script's directory (project root)
cd /d "%~dp0"

set "FRONTEND_DIR=%cd%\frontend"
set "BUILD_DIR=%FRONTEND_DIR%\build"
set "STATIC_DIR=%cd%\static"
set "UPLOAD_DIR=%STATIC_DIR%\uploads"

if not exist "%FRONTEND_DIR%\package.json" (
	echo [ERROR] frontend\package.json not found.
	exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
	echo [ERROR] npm is not available in PATH.
	exit /b 1
)

echo [INFO] Building React frontend...
pushd "%FRONTEND_DIR%"
call npm run build
if errorlevel 1 (
	echo [ERROR] Frontend build failed.
	popd
	exit /b 1
)
popd

if not exist "%BUILD_DIR%\index.html" (
	echo [ERROR] Build output missing: "%BUILD_DIR%\index.html"
	exit /b 1
)

if not exist "%STATIC_DIR%" mkdir "%STATIC_DIR%"

REM Keep uploads directory, remove other existing static contents
for /d %%D in ("%STATIC_DIR%\*") do (
	if /I not "%%~nxD"=="uploads" (
		rmdir /s /q "%%~fD"
	)
)
for %%F in ("%STATIC_DIR%\*") do (
	if /I not "%%~nxF"=="uploads" (
		del /f /q "%%~fF" >nul 2>nul
	)
)

echo [INFO] Copying build output to static...
xcopy "%BUILD_DIR%\*" "%STATIC_DIR%\" /E /I /Y >nul
if errorlevel 1 (
	echo [ERROR] Failed to copy build files to static.
	exit /b 1
)

if exist "%UPLOAD_DIR%" (
	echo [INFO] uploads preserved: "%UPLOAD_DIR%"
)

echo [INFO] Frontend deployed to "%STATIC_DIR%"
exit /b 0

