@echo off
setlocal
cd /d "%~dp0"
title Game UI Preview Hub ^& Studio Backend (Port 17890)

set "SCRIPT=.agents\skills\game-ui-preview\scripts\slice_sprites.py"
set "IS_CRAFTLAND=0"
if exist "..\..\main.gproj" set "IS_CRAFTLAND=1"
if exist "..\..\Assets" if exist "..\..\ProjectSettings" set "IS_CRAFTLAND=1"

if "%IS_CRAFTLAND%"=="1" (
  set "HUB_URL=http://127.0.0.1:17890/Tools/ui-previews/index.html"
  if exist "..\ui-previews\_catalog\manifest.json" (
    set "ARGS=--project-root "..\.." --output "..\ui-previews\_catalog" --serve --port 17890 --open"
  ) else (
    set "ARGS=--craftland-assets --project-root "..\.." --input "..\..\Assets\Sprites" --extra-input "assets\WorkshopIconLibrary" --output "..\ui-previews\_catalog" --serve --port 17890 --open"
  )
) else (
  set "HUB_URL=http://127.0.0.1:17890/previews/index.html"
  set "ARGS=--output "previews\_catalog" --serve --port 17890 --open"
)

echo ============================================================================
echo   Game UI Preview Hub ^& Studio Backend Server
echo   URL: %HUB_URL%
echo ============================================================================
echo.
echo Syncing UI Gallery and starting local backend server on port 17890...
echo (Keep this window open while editing UI / 9-slice borders. Press Ctrl+C to stop.)
echo.

where uv >nul 2>&1
if not errorlevel 1 (
  uv run --with pillow "%SCRIPT%" %ARGS%
  goto :check_exit
)

if exist "%USERPROFILE%\.local\bin\uv.exe" (
  "%USERPROFILE%\.local\bin\uv.exe" run --with pillow "%SCRIPT%" %ARGS%
  goto :check_exit
)

python -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  python "%SCRIPT%" %ARGS%
  goto :check_exit
)

py -3 -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  py -3 "%SCRIPT%" %ARGS%
  goto :check_exit
)

echo [ERROR] No working Python 3 + Pillow installation or uv runner was found.
echo Install uv or Python 3 with Pillow: pip install pillow
pause
exit /b 1

:check_exit
if errorlevel 1 (
  echo.
  echo [ERROR] Server exited with an error. Make sure Python 3 and Pillow or uv are installed.
  pause
  exit /b 1
)
