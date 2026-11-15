@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set "deploy_exit=%errorlevel%"
pause
exit /b %deploy_exit%
