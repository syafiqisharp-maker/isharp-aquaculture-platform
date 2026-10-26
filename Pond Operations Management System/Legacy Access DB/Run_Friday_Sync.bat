@echo off
setlocal EnableDelayedExpansion
title iSHARP DBMS - Weekly Friday Sync Engine

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%..\..\database_migration\sync_weekly_access.ps1"
set "LOG_DIR=%SCRIPT_DIR%sync_logs"
set "LOCK_FILE=%SCRIPT_DIR%sync.lock"
set "NO_PAUSE=0"
set "PS_ARGS="

for %%A in (%*) do (
    if /i "%%~A"=="--no-pause" (
        set "NO_PAUSE=1"
    ) else (
        set "PS_ARGS=!PS_ARGS! %%A"
    )
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Generate timestamp YYYYMMDD_HHMMSS via PowerShell (locale-independent)
for /f %%i in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TIMESTAMP=%%i"
set "LOG_FILE=%LOG_DIR%\sync_%TIMESTAMP%.log"

:: Check for existing lock file and verify if PID is still running
if exist "%LOCK_FILE%" (
    set /p LOCK_PID=<"%LOCK_FILE%"
    powershell.exe -NoProfile -Command "if (Get-Process -Id !LOCK_PID! -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
    if errorlevel 1 (
        echo ==========================================================
        echo   [ABORTED] Another Weekly Sync is currently running ^(PID: !LOCK_PID!^).
        echo   If this is incorrect, delete: "%LOCK_FILE%"
        echo ==========================================================
        if "!NO_PAUSE!"=="0" pause
        exit /b 2
    ) else (
        echo [WARN] Removing stale lock file from previous interrupted run...
        del /f /q "%LOCK_FILE%" >nul 2>&1
    )
)

echo ==========================================================
echo   iSHARP ENTERPRISE WEEKLY DATABASE SYNC
echo   Executing Smart Delta Sync to Supabase Cloud...
echo   Log File: %LOG_FILE%
echo ==========================================================
echo.

:: Run PowerShell sync script, writing current PID to lock file and teeing all output to log file
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$PID | Out-File -FilePath '%LOCK_FILE%' -Encoding ascii -Force; & '%PS_SCRIPT%' !PS_ARGS! *>&1 | Tee-Object -FilePath '%LOG_FILE%' -Append; exit $LASTEXITCODE"
set "SYNC_EXIT=%ERRORLEVEL%"

if exist "%LOCK_FILE%" del /f /q "%LOCK_FILE%" >nul 2>&1

echo.
if "%SYNC_EXIT%"=="0" (
    echo ==========================================================
    echo   [SUCCESS] Weekly Database Sync completed with 0 errors.
    echo   Log saved to: %LOG_FILE%
    echo ==========================================================
) else (
    echo ==========================================================
    echo   [FAILED - Exit Code %SYNC_EXIT%] Sync encountered an error or network drop.
    echo   Progress was saved to sync_checkpoint.json.
    echo   Simply run Run_Friday_Sync.bat again to resume from checkpoint!
    echo   Log saved to: %LOG_FILE%
    echo ==========================================================
)

if "!NO_PAUSE!"=="0" pause
exit /b %SYNC_EXIT%
