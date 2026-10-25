@echo off
setlocal
title iSHARP — Weekly Pond Management Compliance & WhatsApp Callout
cls

echo ==============================================================================
echo   iSHARP AQUACULTURE PLATFORM — WEEKLY MANAGEMENT AUDITOR
echo   Blue Archipelago Berhad - Setiu Farm
echo ==============================================================================
echo.
echo Running weekly compliance evaluation against live Supabase...
echo.

python "scripts\check_weekly_management_compliance.py"

echo.
echo ==============================================================================
echo Execution complete. You can paste (Ctrl+V) the WhatsApp callout message directly.
echo ==============================================================================
pause
