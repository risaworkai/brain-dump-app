@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"
echo.
echo  .env.local から env.js を作ります（GitHub Pages 用）
echo.
where node >nul 2>nul
if errorlevel 1 (
    echo [エラー] Node.js がありません。
    goto :end
)
node scripts\sync-env-from-local.mjs
:end
echo.
pause >nul
