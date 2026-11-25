@echo off
setlocal
title Setup UICreator Environment
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0.agents\skills\game-ui-preview\scripts\setup_env.ps1" %*
exit /b %errorlevel%
