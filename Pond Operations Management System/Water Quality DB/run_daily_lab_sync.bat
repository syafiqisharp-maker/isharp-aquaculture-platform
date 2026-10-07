@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo   iSHARP AQUACULTURE - DAILY LAB WATER QUALITY SYNC
echo ==========================================================
echo Starting sync at %date% %time% ...

python "sync_daily_lab_water_quality.py" %*

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Synchronization encountered an issue. See sync_lab_water_quality.log
    if not "%1"=="--silent" pause
) else (
    echo [OK] Synchronization completed successfully.
    if not "%1"=="--silent" timeout /t 5
)
