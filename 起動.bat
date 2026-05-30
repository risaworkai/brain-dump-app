@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"

echo.
echo ========================================
echo   ブレインダンプ（brain-dump-app）
echo   フォルダ: %cd%
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [エラー] Node.js がありません。https://nodejs.org から LTS を入れてください。
    goto :end
)

if not exist "server.mjs" (
    echo [エラー] server.mjs がありません。この bat と同じフォルダに置いてください。
    goto :end
)

if not exist "src\main.js" (
    echo [エラー] src\main.js がありません。
    goto :end
)

if not exist ".env.local" (
    echo [エラー] .env.local がありません。
    echo.
    echo  手順:
    echo   1. .env.example をコピーして .env.local を作る
    echo   2. Supabase の Project URL と anon public key を貼る
    echo   3. もう一度 起動.bat を実行
    echo.
    if exist ".env.example" copy /Y ".env.example" ".env.local" >nul
    if exist ".env.local" echo  .env.local を新規作成しました。中身を編集してから再実行してください。
    goto :end
)

echo [1/3] 設定ファイルを確認...
node scripts\check-env.mjs
if errorlevel 1 goto :end

set PORT=5174
echo.
echo [2/3] ポート %PORT% の古いサーバーを停止...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 1 /nobreak >nul

echo.
echo [3/3] サーバーを起動...
echo   ブラウザ: http://127.0.0.1:%PORT%/
echo   止める: この黒い窓で Ctrl+C
echo   成功の目安: 下に「Supabase: 設定 OK」と表示される
echo.

node server.mjs
if errorlevel 1 echo [エラー] サーバーが起動できませんでした。

:end
echo.
echo 何かキーを押すと閉じます...
pause >nul
