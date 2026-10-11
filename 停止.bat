@echo off
cd /d "%~dp0"
echo Stopping opencode session manager...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1"
echo.
pause
