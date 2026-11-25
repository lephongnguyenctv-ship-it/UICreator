@echo off
setlocal
call "%~dp0..\..\..\..\launch_ui_hub.bat" %*
exit /b %errorlevel%
