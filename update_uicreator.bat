@echo off
setlocal
cd /d "%~dp0"
title Update UICreator (main)

set "UICREATOR_DIR=%~dp0"
if "%UICREATOR_DIR:~-1%"=="\" set "UICREATOR_DIR=%UICREATOR_DIR:~0,-1%"

set "NO_PAUSE=0"
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"

call :find_git
if not defined GIT_EXE (
  echo [ERROR] Git was not found on PATH, in Git for Windows, or in GitHub Desktop.
  echo         Run setup_uicreator.bat to check/install your environment prerequisites.
  goto :fail
)

if /i "%~1"=="--check-git" (
  echo GIT_EXE=%GIT_EXE%
  "%GIT_EXE%" --version
  exit /b 0
)

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

rem 2. Detect generic host project when installed as a git submodule
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

if "%IS_SUBMODULE%"=="1" goto :update_submodule
goto :update_standalone

:update_submodule
cd /d "%PROJECT_ROOT%"
rem Compute relative submodule path from PROJECT_ROOT (e.g. Tools/UICreator)
call set "SUBMOD_REL=%%UICREATOR_DIR:%PROJECT_ROOT%\=%%"
set "SUBMOD_REL=%SUBMOD_REL:\=/%"
if not defined SUBMOD_REL set "SUBMOD_REL=Tools/UICreator"

echo ============================================================================
echo   Updating %SUBMOD_REL% submodule from origin/main
echo   Git : %GIT_EXE%
echo ============================================================================
echo.

"%GIT_EXE%" submodule sync -- "%SUBMOD_REL%"
if errorlevel 1 goto :fail

"%GIT_EXE%" submodule update --init --remote -- "%SUBMOD_REL%"
if errorlevel 1 goto :fail

echo.
echo Current %SUBMOD_REL% commit:
"%GIT_EXE%" -C "%SUBMOD_REL%" log -n 1 --oneline
echo.

if "%IS_CRAFTLAND%"=="1" goto :sync_craftland
goto :done

:sync_craftland
echo Re-indexing Craftland sprites and syncing UI Preview Kit...
set "SCRIPT=%UICREATOR_DIR%\.agents\skills\game-ui-preview\scripts\slice_sprites.py"
set "EXTRA_INPUT=%UICREATOR_DIR%\assets\WorkshopIconLibrary"
set "CATALOG_DIR=%PROJECT_ROOT%\Tools\ui-previews\_catalog"
if exist "%PROJECT_ROOT%\Assets\Sprites" (
  set "SPRITE_INPUT=%PROJECT_ROOT%\Assets\Sprites"
) else if exist "%PROJECT_ROOT%\Assets" (
  set "SPRITE_INPUT=%PROJECT_ROOT%\Assets"
) else (
  set "SPRITE_INPUT=%EXTRA_INPUT%"
)

call :run_py --craftland-assets --project-root "%PROJECT_ROOT%" --input "%SPRITE_INPUT%" --extra-input "%EXTRA_INPUT%" --output "%CATALOG_DIR%"
if errorlevel 1 (
  echo [WARN] Python 3 + Pillow ^(or uv^) not found or catalog sync failed; submodule was still updated.
  echo        Run setup_uicreator.bat to install missing environment tools.
)
goto :done

:update_standalone
echo ============================================================================
echo   Updating standalone UICreator from origin/main
echo   Git : %GIT_EXE%
echo ============================================================================
echo.
"%GIT_EXE%" pull origin main
if errorlevel 1 goto :fail
goto :done

:find_git
set "GIT_EXE="
for /f "delims=" %%G in ('where git 2^>nul') do (
  if not defined GIT_EXE set "GIT_EXE=%%~fG"
)
if defined GIT_EXE goto :git_found

if exist "C:\Program Files\Git\cmd\git.exe" set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
if defined GIT_EXE goto :git_found

if exist "C:\Program Files (x86)\Git\cmd\git.exe" set "GIT_EXE=C:\Program Files (x86)\Git\cmd\git.exe"
if defined GIT_EXE goto :git_found

if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT_EXE=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
if defined GIT_EXE goto :git_found

for /f "delims=" %%D in ('dir /b /ad /on "%LOCALAPPDATA%\GitHubDesktop\app-*" 2^>nul') do (
  if exist "%LOCALAPPDATA%\GitHubDesktop\%%D\resources\app\git\cmd\git.exe" (
    set "GIT_EXE=%LOCALAPPDATA%\GitHubDesktop\%%D\resources\app\git\cmd\git.exe"
  )
)
if defined GIT_EXE goto :git_found
exit /b 1

:git_found
for %%I in ("%GIT_EXE%") do set "GIT_DIR=%%~dpI"
set "PATH=%GIT_DIR%;%PATH%"
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

exit /b 99

:done
echo.
echo ============================================================================
echo   UICreator is up to date with main!
if "%IS_SUBMODULE%"=="1" (
  echo   To share this update with teammates, commit %SUBMOD_REL% in git:
  echo     git add %SUBMOD_REL% ^&^& git commit -m "chore: update UICreator submodule"
)
echo ============================================================================
if "%NO_PAUSE%"=="1" exit /b 0
pause
exit /b 0

:fail
echo.
echo [ERROR] Failed to update UICreator.
if "%NO_PAUSE%"=="1" exit /b 1
pause
exit /b 1
