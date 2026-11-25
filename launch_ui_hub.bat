@echo off
setlocal
cd /d "%~dp0"
title Game UI Preview Hub ^& Studio Backend (Port 17890)

set "UICREATOR_DIR=%~dp0"
if "%UICREATOR_DIR:~-1%"=="\" set "UICREATOR_DIR=%UICREATOR_DIR:~0,-1%"
set "SCRIPT=%UICREATOR_DIR%\.agents\skills\game-ui-preview\scripts\slice_sprites.py"

if not exist "%SCRIPT%" goto :missing_script

set "PROJECT_ROOT="
set "IS_CRAFTLAND=0"
set "IS_SUBMODULE=0"

rem 1. Detect host Craftland Studio project (1 to 3 directories up from UICreator)
for %%D in (".." "..\.." "..\..\..") do (
  if not defined PROJECT_ROOT (
    if exist "%%~fD\main.gproj" (
      set "PROJECT_ROOT=%%~fD"
      set "IS_CRAFTLAND=1"
      set "IS_SUBMODULE=1"
    ) else if exist "%%~fD\Assets" if exist "%%~fD\ProjectSettings" (
      set "PROJECT_ROOT=%%~fD"
      set "IS_CRAFTLAND=1"
      set "IS_SUBMODULE=1"
    )
  )
)

rem 2. Detect generic (non-Craftland) host project when installed as a git submodule
if not defined PROJECT_ROOT (
  for %%D in (".." "..\.." "..\..\..") do (
    if not defined PROJECT_ROOT (
      if exist "%%~fD\.gitmodules" (
        set "PROJECT_ROOT=%%~fD"
        set "IS_SUBMODULE=1"
      )
    )
  )
)

set "EXTRA_INPUT=%UICREATOR_DIR%\assets\WorkshopIconLibrary"

if "%IS_CRAFTLAND%"=="1" goto :mode_craftland
if "%IS_SUBMODULE%"=="1" goto :mode_submodule
goto :mode_standalone

:mode_craftland
cd /d "%PROJECT_ROOT%"
set "CATALOG_DIR=%PROJECT_ROOT%\Tools\ui-previews\_catalog"
set "HUB_URL=http://127.0.0.1:17890/Tools/ui-previews/index.html"
set "SPRITE_INPUT=%EXTRA_INPUT%"
if exist "%PROJECT_ROOT%\Assets" set "SPRITE_INPUT=%PROJECT_ROOT%\Assets"
if exist "%PROJECT_ROOT%\Assets\Sprites" set "SPRITE_INPUT=%PROJECT_ROOT%\Assets\Sprites"
set "MODE_LABEL=Craftland Submodule - %PROJECT_ROOT%"
goto :after_mode

:mode_submodule
cd /d "%PROJECT_ROOT%"
set "CATALOG_DIR=%PROJECT_ROOT%\previews\_catalog"
set "HUB_URL=http://127.0.0.1:17890/previews/index.html"
if exist "%PROJECT_ROOT%\Tools\ui-previews" set "CATALOG_DIR=%PROJECT_ROOT%\Tools\ui-previews\_catalog"
if exist "%PROJECT_ROOT%\Tools\ui-previews" set "HUB_URL=http://127.0.0.1:17890/Tools/ui-previews/index.html"
set "SPRITE_INPUT=%PROJECT_ROOT%\Sprite sheets"
set "MODE_LABEL=Host Project Submodule - %PROJECT_ROOT%"
goto :after_mode

:mode_standalone
set "PROJECT_ROOT=%UICREATOR_DIR%"
set "CATALOG_DIR=%UICREATOR_DIR%\previews\_catalog"
set "HUB_URL=http://127.0.0.1:17890/previews/index.html"
set "SPRITE_INPUT=%UICREATOR_DIR%\Sprite sheets"
set "MODE_LABEL=Standalone UICreator"
goto :after_mode

:after_mode
if /i "%~1"=="--print-config" goto :print_config

echo ============================================================================
echo   Game UI Preview Hub ^& Studio Backend Server
echo   Mode: %MODE_LABEL%
echo   URL : %HUB_URL%
echo ============================================================================
echo.
echo Syncing UI Gallery and starting local backend server on port 17890...
echo (Keep this window open while editing or exporting UIs. Press Ctrl+C to stop.)
echo.

if "%IS_CRAFTLAND%"=="1" goto :launch_craftland
call :run_py --project-root "%PROJECT_ROOT%" --input "%SPRITE_INPUT%" --extra-input "%EXTRA_INPUT%" --output "%CATALOG_DIR%" --serve --port 17890 --open
goto :check_exit

:launch_craftland
call :run_py --craftland-assets --project-root "%PROJECT_ROOT%" --input "%SPRITE_INPUT%" --extra-input "%EXTRA_INPUT%" --output "%CATALOG_DIR%" --serve --port 17890 --open
goto :check_exit

:check_exit
if errorlevel 1 (
  echo.
  echo [ERROR] Server exited with an error. Make sure Python 3 + Pillow or uv are installed.
  if /i not "%~1"=="--no-pause" pause
  exit /b 1
)
exit /b 0

:print_config
echo MODE=%MODE_LABEL%
echo IS_CRAFTLAND=%IS_CRAFTLAND%
echo IS_SUBMODULE=%IS_SUBMODULE%
echo PROJECT_ROOT=%PROJECT_ROOT%
echo CATALOG_DIR=%CATALOG_DIR%
echo SPRITE_INPUT=%SPRITE_INPUT%
echo EXTRA_INPUT=%EXTRA_INPUT%
echo HUB_URL=%HUB_URL%
exit /b 0

:run_py
where uv >nul 2>&1
if not errorlevel 1 (
  uv run --with pillow "%SCRIPT%" %*
  exit /b %errorlevel%
)

if exist "%USERPROFILE%\.local\bin\uv.exe" (
  "%USERPROFILE%\.local\bin\uv.exe" run --with pillow "%SCRIPT%" %*
  exit /b %errorlevel%
)

python -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  python "%SCRIPT%" %*
  exit /b %errorlevel%
)

py -3 -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  py -3 "%SCRIPT%" %*
  exit /b %errorlevel%
)

echo [ERROR] No working Python 3 + Pillow installation or uv runner was found.
echo Install uv or Python 3 with Pillow: pip install pillow
exit /b 1

:missing_script
echo [ERROR] Could not find slice_sprites.py at:
echo   %SCRIPT%
if /i not "%~1"=="--no-pause" pause
exit /b 1
