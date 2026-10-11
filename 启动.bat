@echo off
cd /d "%~dp0"
echo Starting opencode session manager...
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
echo.
pause
