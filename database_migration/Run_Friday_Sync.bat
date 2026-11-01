@echo off
title iSHARP DBMS - Weekly Friday Sync Engine
echo ==========================================================
echo   iSHARP ENTERPRISE WEEKLY DATABASE SYNC
echo   Step 1: Capturing Pre-Sync Recovery Snapshot to Google Drive...
echo ==========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup_supabase_snapshot.ps1" -QuickOperational

echo.
echo ==========================================================
echo   Step 2: Executing Smart Delta Sync to Supabase Cloud...
echo ==========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_weekly_access.ps1"

echo.
echo ==========================================================
echo   Sync process finished.
echo ==========================================================
pause
