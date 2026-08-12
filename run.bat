@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title CHAY DASHBOARD BAO CAO CHI PHI BO PHAN
echo ============================================================
echo   DANG KHOI DONG DASHBOARD BAO CAO CHI PHI
echo ============================================================
echo.

set "TARGET_DIR=%~dp0"
if "%TARGET_DIR:~-1%"=="\" set "TARGET_DIR=%TARGET_DIR:~0,-1%"

cd /d "%TARGET_DIR%"

set "VENV_DIR=%TARGET_DIR%\venv"
set "REQ_FILE=%TARGET_DIR%\requirements.txt"

REM --- BUOC 1: Kiem tra Python he thong ---
python --version >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Python! Vui long cai dat Python.
    pause
    exit /b 1
)

REM --- BUOC 2: Tao Virtual Environment neu chua co ---
set "NEED_CREATE_VENV=0"
if not exist "%VENV_DIR%\Scripts\python.exe" set "NEED_CREATE_VENV=1"

if "%NEED_CREATE_VENV%"=="1" (
    echo Dang tao Virtual Environment venv...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [LOI] Khong the tao Virtual Environment venv.
        pause
        exit /b 1
    )
)

REM --- BUOC 3: Cai dat thu vien ---
echo Dang kiem tra va cai dat thu vien Python...
"%VENV_DIR%\Scripts\python.exe" -m pip install -r "%REQ_FILE%" -q

REM --- BUOC 4: Mo Trinh Duyet va Khoi dong Server ---
echo.
echo Dang khoi dong Python Server va mo Dashboard tren http://localhost:8080 ...
start "" "http://localhost:8080"
"%VENV_DIR%\Scripts\python.exe" "%TARGET_DIR%\server.py"

pause
