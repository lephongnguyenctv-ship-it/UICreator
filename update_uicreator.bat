@echo off
setlocal
cd /d "%~dp0"
title Update UICreator (main)

set "IS_CRAFTLAND=0"
if exist "..\..\.gitmodules" set "IS_CRAFTLAND=1"
if exist "..\..\main.gproj" set "IS_CRAFTLAND=1"

if "%IS_CRAFTLAND%"=="1" (
  cd /d "%~dp0..\.."
  echo ============================================================================
  echo   Updating Tools/UICreator submodule from origin/main
  echo ============================================================================
  echo.

  git submodule sync -- Tools/UICreator
  if errorlevel 1 goto :fail

  git submodule update --init --remote -- Tools/UICreator
  if errorlevel 1 goto :fail

  echo.
  echo Current Tools/UICreator commit:
  git -C Tools/UICreator log -n 1 --oneline
  echo.
  echo Re-indexing Assets/Sprites and syncing UI Preview Kit...

  set "SCRIPT=Tools\UICreator\.agents\skills\game-ui-preview\scripts\slice_sprites.py"
  set "ARGS=--craftland-assets --project-root . --input Assets\Sprites --extra-input Tools\UICreator\assets\WorkshopIconLibrary --output Tools\ui-previews\_catalog"
  goto :run_sync
) else (
  echo ============================================================================
  echo   Updating standalone UICreator from origin/main
  echo ============================================================================
  echo.
  git pull origin main
  if errorlevel 1 goto :fail
  goto :done
)

:run_sync
where uv >nul 2>&1
if not errorlevel 1 (
  uv run --with pillow "%SCRIPT%" %ARGS%
  goto :after_sync
)

if exist "%USERPROFILE%\.local\bin\uv.exe" (
  "%USERPROFILE%\.local\bin\uv.exe" run --with pillow "%SCRIPT%" %ARGS%
  goto :after_sync
)

python -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  python "%SCRIPT%" %ARGS%
  goto :after_sync
)

py -3 -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  py -3 "%SCRIPT%" %ARGS%
  goto :after_sync
)

echo [WARN] Python 3 + Pillow (or uv) not found; submodule updated, but catalog sync was skipped.
goto :done

:after_sync
if errorlevel 1 goto :fail

:done
echo.
echo ============================================================================
echo   UICreator is up to date with main!
if "%IS_CRAFTLAND%"=="1" (
  echo   To share this update with teammates, commit Tools/UICreator in git:
  echo     git add Tools/UICreator ^&^& git commit -m "chore: update UICreator submodule"
)
echo ============================================================================
if "%~1"=="--no-pause" exit /b 0
pause
exit /b 0

:fail
echo.
echo [ERROR] Failed to update UICreator.
if "%~1"=="--no-pause" exit /b 1
pause
exit /b 1
