@echo off
setlocal
cd /d "%~dp0..\..\..\.."
title Game UI Preview Hub ^& Studio Backend (Port 17890)
echo ============================================================================
echo   Game UI Preview Hub ^& Studio Backend Server
echo   URL: http://127.0.0.1:17890/previews/index.html
echo ============================================================================
echo.
echo Syncing UI Gallery and starting local backend server on port 17890...
echo (Keep this window open while editing 9-slice borders. Press Ctrl+C to stop.)
echo.
python ".agents\skills\game-ui-preview\scripts\slice_sprites.py" --output "previews\_catalog" --serve --port 17890 --open
if errorlevel 1 (
  echo.
  echo [ERROR] Server exited with an error. Make sure Python 3 and Pillow are installed.
  pause
)
