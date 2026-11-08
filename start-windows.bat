@echo off
chcp 65001 >nul
cd /d "%~dp0"
where docker >nul 2>nul && docker compose up -d db
echo.
echo ILYAS AI COMMERCE: http://localhost:3000  (stop: Ctrl+C)
echo.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
