@echo off
title iSHARP DBMS - Daily Pond Progress Sync Engine
echo ==========================================================
echo   iSHARP ENTERPRISE DAILY POND PROGRESS SYNC
echo   Ingesting Daily Status Excel to Supabase Cloud...
echo ==========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_daily_pond_progress.ps1"

echo.
echo ==========================================================
echo   Daily sync process finished.
echo ==========================================================
pause
