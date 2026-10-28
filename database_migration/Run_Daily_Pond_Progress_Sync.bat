@echo off
setlocal enabledelayedexpansion
title iSHARP DBMS - Daily Pond Progress Sync Engine

echo ==========================================================
echo   iSHARP ENTERPRISE DAILY POND PROGRESS SYNC
echo   Zero-Python Native Windows Engine
echo   Target: Supabase Cloud Database
echo ==========================================================
echo.

:: Check for dragged file parameter (%1)
set "DROPPED_FILE=%~1"

if not "%DROPPED_FILE%"=="" (
    echo [INFO] Detected Drag-and-Drop file:
    echo   "%DROPPED_FILE%"
    echo.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_daily_pond_progress.ps1" -excelPath "%DROPPED_FILE%"
) else (
    echo [INFO] No file dropped. Scanning folder for latest Daily Status workbook...
    echo.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_daily_pond_progress.ps1"
)

echo.
echo ==========================================================
echo   Daily sync process finished.
echo ==========================================================
pause
