@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Hay cai Node.js 22.13 hoac moi hon truoc khi mo thiep.
  pause
  exit /b 1
)
echo Mo http://127.0.0.1:3000 trong trinh duyet sau khi may chu san sang.
node server.js
pause
