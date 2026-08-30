@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"

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

REM --- BUOC 2: Kiem tra va Tu dong tao venv neu copy sang may/thu muc khac ---
set "NEED_CREATE_VENV=0"
if not exist "%VENV_DIR%\Scripts\python.exe" set "NEED_CREATE_VENV=1"

if "%NEED_CREATE_VENV%"=="0" (
    "%VENV_DIR%\Scripts\python.exe" -c "import os, sys; sys.exit(0 if os.path.normpath(sys.prefix).lower() == os.path.normpath(r'%VENV_DIR%').lower() else 1)" >nul 2>&1
    if errorlevel 1 (
        echo [INFO] Phat hien du an duoc copy sang vi tri moi (%TARGET_DIR%).
        echo Dang tu dong khoi tao lai venv de tuong thich 100%%...
        rd /s /q "%VENV_DIR%" >nul 2>&1
        set "NEED_CREATE_VENV=1"
    )
)

if "%NEED_CREATE_VENV%"=="1" (
    echo Dang tao Virtual Environment venv moi...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [LOI] Khong the tao Virtual Environment. Vui long kiem tra Python.
        pause
        exit /b 1
    )
    echo [OK] Da tao xong Virtual Environment.
)

REM --- BUOC 3: Cai dat thu vien neu thieu ---
"%VENV_DIR%\Scripts\python.exe" -m pip install -r "%REQ_FILE%" -q

REM --- BUOC 4: Dong bo file Excel tu OneDrive sang du an va trich xuat du lieu ---
echo.
echo [1/3] Dang kiem tra va dong bo file Excel tu OneDrive...
"%VENV_DIR%\Scripts\python.exe" "%TARGET_DIR%\server.py" --sync-only

REM --- BUOC 5: Dong bo voi GitHub (Pull + Push) ---
echo.
echo [2/3] Dang dong bo voi GitHub...
git --version >nul 2>&1
if not errorlevel 1 (
    REM Keo code moi nhat tu GitHub
    git pull origin main >nul 2>&1
    if not errorlevel 1 (
        echo [OK] Da cap nhat code moi nhat tu GitHub!
    ) else (
        echo [INFO] Khong the ket noi GitHub de pull, su dung phien ban hien tai.
    )
    
    REM Kiem tra co thay doi chua commit khong
    set "HAS_CHANGES=0"
    for /f %%i in ('git status --porcelain 2^>nul') do set "HAS_CHANGES=1"
    
    if "!HAS_CHANGES!"=="1" (
        echo [INFO] Phat hien file Excel hoac code moi. Dang day len GitHub...
        git add -A >nul 2>&1
        git commit -m "Tu dong dong bo dashboard [%date% %time:~0,8%]" >nul 2>&1
        git push origin main >nul 2>&1
        if not errorlevel 1 (
            echo [OK] Da dong bo toan bo len GitHub thanh cong!
        ) else (
            echo [INFO] Khong the push len GitHub, se thu lai lan sau.
        )
    ) else (
        echo [OK] Du lieu da dong bo voi GitHub, khong co thay doi moi.
    )
)

REM --- BUOC 6: Mo Trinh Duyet va Khoi dong Server ---
echo.
echo [3/3] Dang khoi dong Server va mo Dashboard tren http://localhost:8080 ...
start "" /B "%VENV_DIR%\Scripts\python.exe" "%TARGET_DIR%\server.py"
start "" "http://localhost:8080"

echo.
echo [OK] Server dang chay ngam tren port 8080.
pause
