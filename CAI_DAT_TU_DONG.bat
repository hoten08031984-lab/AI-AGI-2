@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title CAI DAT DASHBOARD TU DONG KHOI DONG
echo ============================================================
echo   DANG THIET LAP TU DONG CHAY DASHBOARD CUNG WINDOWS
echo ============================================================
echo.

set "TARGET_DIR=%~dp0"
if "%TARGET_DIR:~-1%"=="\" set "TARGET_DIR=%TARGET_DIR:~0,-1%"

REM --- Tim duong dan tuyet doi toi pythonw.exe ---
set "PYTHONW_PATH="
for /f "delims=" %%i in ('where pythonw.exe 2^>nul') do (
    if not defined PYTHONW_PATH set "PYTHONW_PATH=%%i"
)
if not defined PYTHONW_PATH (
    echo [LOI] Khong tim thay pythonw.exe! Hay cai dat Python truoc.
    pause
    exit /b 1
)

REM --- Tat server cu neu con chay tren port 8080 ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING" 2^>nul') do (
    echo [0/3] Dang tat server cu (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
    ping -n 2 127.0.0.1 >nul
)

REM --- Tao VBS khoi dong cung Windows (dung duong dan tuyet doi) ---
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start_dashboard_server.vbs"

echo Set WshShell = CreateObject("WScript.Shell") > "%STARTUP_VBS%"
echo WshShell.CurrentDirectory = "%TARGET_DIR%" >> "%STARTUP_VBS%"
echo WshShell.Run """%PYTHONW_PATH%"" ""%TARGET_DIR%\server.py""", 0, False >> "%STARTUP_VBS%"

echo [1/3] Da dang ky Server vao Windows Startup thanh cong!
echo.

REM --- Khoi dong server ---
echo [2/3] Dang khoi dong Python Server ngam...
start "" /B "%PYTHONW_PATH%" "%TARGET_DIR%\server.py"

REM --- Doi server san sang (toi da 15 giay) ---
echo [3/3] Dang doi server san sang...
set READY=0
for /L %%i in (1,1,15) do (
    if !READY! equ 0 (
        ping -n 2 127.0.0.1 >nul
        powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:8080' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 set READY=1
    )
)

if !READY! equ 1 (
    echo      Server da san sang!
    start "" "http://localhost:8080"
) else (
    echo [CANH BAO] Server chua san sang sau 15 giay.
    echo      Kiem tra file server.log trong thu muc "%TARGET_DIR%" de biet loi.
    echo      Thu mo http://localhost:8080 thu cong sau vai giay.
)

echo.
echo ============================================================
echo   CAI DAT HOAN TAT!
echo   Tu nay ve sau, moi khi bat may tinh len, ban chi can
echo   mo trinh duyet go localhost:8080 la se tu dong chay.
echo   Neu gap loi, kiem tra file server.log trong thu muc nay.
echo ============================================================
echo.
pause
