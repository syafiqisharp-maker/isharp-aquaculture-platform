<#
.SYNOPSIS
    iSHARP Point-in-Time Database Restore Utility (Google Drive Snapshot -> Supabase)
    Restores records from a backup folder created by backup_supabase_snapshot.ps1.
    Strictly follows AGENTS.md invariants:
      - Zero index_no fields sent
      - Uses Prefer: return=minimal on pure inserts
      - Respects safe chunk sizes (3 for pond_stocking_batches & growout_pond_finance, 8 for others)
      - Sends x-isharp-passcode header from .env.sync

.PARAMETER BackupFolder
    Path to the timestamped backup directory under database_migration/backups/.
    If omitted, uses the most recent backup folder.

.PARAMETER TableName
    Required table name to restore (e.g., "daily_pond_records", "pond_inventories", "biometrics_sampling").

.PARAMETER PondIndex
    Optional pond_index filter to restore only a single pond cycle (e.g., "2010101.41").

.PARAMETER DryRun
    When set, previews the rows and chunk plan without writing to Supabase.
#>

param(
    [string]$BackupFolder = "",
    [Parameter(Mandatory = $true)]
    [string]$TableName,
    [string]$PondIndex = "",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

. (Join-Path $PSScriptRoot "lib\Load-IsharpEnv.ps1")
$supabaseUrl    = $IsharpEnv.SupabaseUrl
$supabaseKey    = $IsharpEnv.SupabaseKey
$editorPasscode = $IsharpEnv.EditorPasscode

$backupRoot = Join-Path $PSScriptRoot "backups"
if (-not $BackupFolder) {
    $latestDir = Get-ChildItem -Path $backupRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latestDir) {
        throw "No backup folders found in $backupRoot."
    }
    $BackupFolder = $latestDir.FullName
}

$tableFile = Join-Path $BackupFolder "${TableName}.json"
if (-not (Test-Path $tableFile)) {
    throw "Backup file not found: $tableFile"
}

$rawJson = Get-Content -Path $tableFile -Raw -Encoding UTF8
$records = @(ConvertFrom-Json -InputObject $rawJson)

if ($PondIndex) {
    $records = @($records | Where-Object { $_.pond_index -eq $PondIndex })
}

Write-Output "=================================================================="
Write-Output "  iSHARP POINT-IN-TIME RESTORE ENGINE"
Write-Output "  Source Folder : $BackupFolder"
Write-Output "  Target Table  : $TableName"
Write-Output "  Cycle Filter  : $(if ($PondIndex) { $PondIndex } else { 'ALL' })"
Write-Output "  Rows to Push  : $($records.Count)"
Write-Output "  Mode          : $(if ($DryRun) { 'DRY RUN (Read-Only)' } else { 'LIVE RESTORE' })"
Write-Output "=================================================================="

if ($records.Count -eq 0 -or $DryRun) {
    Write-Output "Dry run or 0 matching records. Exiting without changes."
    exit 0
}

# Strip deprecated index_no or auto-generated id where natural keys apply (per AGENTS.md Rule 2)
$cleanRecords = New-Object System.Collections.Generic.List[object]
foreach ($r in $records) {
    $props = [ordered]@{}
    foreach ($p in $r.PSObject.Properties) {
        if ($p.Name -eq "index_no") { continue }
        $props[$p.Name] = $p.Value
    }
    $cleanRecords.Add([pscustomobject]$props)
}

# Determine chunk size per AGENTS.md Rule 1
$chunkSize = if ($TableName -in @("pond_stocking_batches", "growout_pond_finance")) { 3 } else { 8 }

$headers = @{
    "apikey"            = $supabaseKey
    "Authorization"     = "Bearer $supabaseKey"
    "Content-Type"      = "application/json; charset=utf-8"
    "Prefer"            = "return=minimal"
    "x-isharp-passcode" = $editorPasscode
}

$uploaded = 0
for ($i = 0; $i -lt $cleanRecords.Count; $i += $chunkSize) {
    $end = [Math]::Min($i + $chunkSize - 1, $cleanRecords.Count - 1)
    $chunk = @($cleanRecords[$i..$end])
    $body = ConvertTo-Json -InputObject $chunk -Depth 10 -Compress
    if ($chunk.Count -eq 1 -and -not $body.StartsWith("[")) {
        $body = "[$body]"
    }
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $uri = "${supabaseUrl}/rest/v1/${TableName}"
    $null = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $bodyBytes -TimeoutSec 30
    $uploaded += $chunk.Count
    Write-Output ("  Restored {0}/{1} rows..." -f $uploaded, $cleanRecords.Count)
}

Write-Output "Successfully restored $uploaded rows into public.$TableName."
