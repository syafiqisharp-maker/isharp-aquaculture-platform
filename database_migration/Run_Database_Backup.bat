@echo off
setlocal
title iSHARP DBMS - Google Drive Database Backup Engine

echo ==============================================================================
echo   iSHARP AQUACULTURE PLATFORM - AUTOMATED GOOGLE DRIVE DATABASE BACKUP
echo   Target: database_migration\backups\ (Synced to Google Drive)
echo ==============================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup_supabase_snapshot.ps1" %*

echo.
echo ==============================================================================
echo   Backup finished.
echo ==============================================================================
pause
