<#
.SYNOPSIS
    iSHARP DBMS 2.0 — Daily Harvest Log Excel Sync Engine
    Reads Daily_Harvest_Log.xlsx (from Power Automate OneDrive sync),
    deduplicates repeated records (taking the latest log per pond),
    filters for the current week, extracts harvest plan tonnage/ABW,
    and updates the iSHARP platform data store.
#>

param(
    [string]$excelPath = "C:\Users\syafiq\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\Daily_Harvest_Log.xlsx",
    [string]$refDate = "2026-11-05"
)

$ErrorActionPreference = "Stop"

Write-Output "=========================================================="
Write-Output "  iSHARP DAILY HARVEST LOG SYNC (Excel -> Platform)"
Write-Output "  Source: $excelPath"
Write-Output "  Reference Date: $refDate"
Write-Output "=========================================================="

if (-not (Test-Path $excelPath)) {
    Write-Error "Excel file not found at: $excelPath"
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path (Split-Path -Parent $scriptDir) "scripts\parse_daily_harvest_log.py"

if (Test-Path $pythonScript) {
    Write-Output "Executing python parser: $pythonScript..."
    python $pythonScript "$excelPath" "$refDate"
} else {
    Write-Error "Parser script not found: $pythonScript"
}

Write-Output "Sync completed successfully."
