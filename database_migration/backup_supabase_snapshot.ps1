<#
.SYNOPSIS
    iSHARP Enterprise Automated Database Backup Engine (Supabase -> Google Drive Local Workspace)
    Exports live Supabase PostgreSQL tables & views using paginated PostgREST queries
    (limit=1000&offset=N), generates SHA-256 integrity manifests, and produces
    latest_farm_snapshot.json for instant browser offline failover.

.PARAMETER QuickOperational
    When set, backs up the high-priority operational & active cycle datasets in ~8 seconds
    (ideal for pre-sync snapshots or rapid verification). Omit to back up all 35+ historical tables.

.PARAMETER RetainCount
    Number of timestamped backup folders to retain in database_migration/backups/ (default: 30).
#>

param(
    [switch]$QuickOperational,
    [int]$RetainCount = 30
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

. (Join-Path $PSScriptRoot "lib\Load-IsharpEnv.ps1")
$supabaseUrl    = $IsharpEnv.SupabaseUrl
$supabaseKey    = $IsharpEnv.SupabaseKey
$editorPasscode = $IsharpEnv.EditorPasscode

$headers = @{
    "apikey"            = $supabaseKey
    "Authorization"     = "Bearer $supabaseKey"
    "Content-Type"      = "application/json; charset=utf-8"
    "x-isharp-passcode" = $editorPasscode
}

$backupRoot = Join-Path $PSScriptRoot "backups"
if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$modeTag   = if ($QuickOperational) { "operational" } else { "full" }
$runDir    = Join-Path $backupRoot "${timestamp}_${modeTag}"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

# PowerShell 5.1 safe array unrolling helper (per AGENTS.md Rule 3)
function Get-FromSupabase([string]$uri) {
    $res = Invoke-RestMethod -Uri $uri -Method Get -Headers $headers -TimeoutSec 45
    foreach ($item in $res) { $item }
}

function Get-AllPaginated([string]$tableName, [string]$filterQuery = "select=*") {
    $allRows = New-Object System.Collections.Generic.List[object]
    $limit   = 1000
    $offset  = 0

    while ($true) {
        $uri = "${supabaseUrl}/rest/v1/${tableName}?${filterQuery}&limit=${limit}&offset=${offset}"
        $batch = @(Get-FromSupabase $uri)
        if ($batch.Count -eq 0) { break }
        foreach ($row in $batch) {
            if ($null -ne $row) { $allRows.Add($row) }
        }
        if ($batch.Count -lt $limit) { break }
        $offset += $limit
    }
    return $allRows.ToArray()
}

# Core operational tables & views needed by web app offline mode + daily operations
$operationalTables = @(
    @{ Name = "view_growout_pond_cycles"; Filter = "select=*&order=pond_index.asc" },
    @{ Name = "active_operational_ponds"; Filter = "select=*" },
    @{ Name = "pond_daily_progress";      Filter = "select=*" },
    @{ Name = "daily_pond_records";       Filter = "select=*" },
    @{ Name = "mineral_probiotic_used";   Filter = "select=*" },
    @{ Name = "pond_inventories";         Filter = "select=*" },
    @{ Name = "pond_aerator_inventory";   Filter = "select=*" },
    @{ Name = "pond_staff";               Filter = "select=*" },
    @{ Name = "pond_initiatives";         Filter = "select=*" },
    @{ Name = "pond_notes";               Filter = "select=*" },
    @{ Name = "qaqc_inspections";         Filter = "select=*" },
    @{ Name = "hatchery_tanks";           Filter = "select=*" },
    @{ Name = "hatchery_sources";         Filter = "select=*" },
    @{ Name = "hatchery_source_map";      Filter = "select=*" },
    @{ Name = "broodstock_batches";       Filter = "select=*" },
    @{ Name = "broodstock_block_assignments"; Filter = "select=*" },
    @{ Name = "broodstock_daily";         Filter = "select=*" },
    @{ Name = "hatchery_tank_runs";       Filter = "select=*" },
    @{ Name = "hatchery_run_events";      Filter = "select=*" },
    @{ Name = "hatchery_run_commercial";  Filter = "select=*" },
    @{ Name = "hatchery_nauplii_allocations"; Filter = "select=*" },
    @{ Name = "hatchery_pond_links";      Filter = "select=*" },
    @{ Name = "v_hatchery_tank_map";      Filter = "select=*" },
    @{ Name = "v_hatchery_run_trace";     Filter = "select=*" },
    @{ Name = "v_hatchery_pl_monthly";    Filter = "select=*" },
    @{ Name = "v_hatchery_pond_origin";   Filter = "select=*" }
)

# Deep historical & ERP tables included in full backup mode
$historicalTables = @(
    @{ Name = "growout_pond_master";       Filter = "select=*" },
    @{ Name = "pond_event_date";           Filter = "select=*" },
    @{ Name = "pond_stocking_batches";     Filter = "select=*" },
    @{ Name = "biometrics_sampling";       Filter = "select=*" },
    @{ Name = "pond_issues";               Filter = "select=*" },
    @{ Name = "lab_water_quality";         Filter = "select=*" },
    @{ Name = "pond_harvest_daily";        Filter = "select=*" },
    @{ Name = "pond_harvest_sales";        Filter = "select=*" },
    @{ Name = "pond_harvest_plan";         Filter = "select=*" },
    @{ Name = "growout_pond_finance";      Filter = "select=*" },
    @{ Name = "growout_pond_feed_legacy";  Filter = "select=*" },
    @{ Name = "growout_pond_final_legacy"; Filter = "select=*" },
    @{ Name = "weather_logs";              Filter = "select=*" },
    @{ Name = "growout_pond_feed_sap";     Filter = "select=*" }
)

$targetList = if ($QuickOperational) { $operationalTables } else { $operationalTables + $historicalTables }

Write-Output "=================================================================="
Write-Output "  iSHARP GOOGLE DRIVE AUTOMATED DATABASE BACKUP ENGINE"
Write-Output "  Mode       : $($modeTag.ToUpper()) ($($targetList.Count) tables/views)"
Write-Output "  Output Dir : $runDir"
Write-Output "  Started At : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=================================================================="

$manifestTables = New-Object System.Collections.Generic.List[object]
$browserSnapshotTables = [ordered]@{}
$totalRowsBackedUp = 0

foreach ($item in $targetList) {
    $tName  = $item.Name
    $filter = $item.Filter
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $rows = @(Get-AllPaginated -tableName $tName -filterQuery $filter)
        $sw.Stop()
        $rowCount = $rows.Count
        $totalRowsBackedUp += $rowCount

        $outFile = Join-Path $runDir "${tName}.json"
        $jsonText = ConvertTo-Json -InputObject @($rows) -Depth 10 -Compress
        if ([string]::IsNullOrWhiteSpace($jsonText) -or $rowCount -eq 0) {
            $jsonText = "[]"
        }
        [System.IO.File]::WriteAllText($outFile, $jsonText, [System.Text.Encoding]::UTF8)

        $hash = (Get-FileHash -Path $outFile -Algorithm SHA256).Hash
        $manifestTables.Add([ordered]@{
            table_name = $tName
            row_count  = $rowCount
            sha256     = $hash
            elapsed_ms = $sw.ElapsedMilliseconds
            status     = "OK"
        })

        # Include in browser offline snapshot bundle if it is an operational table
        if ($operationalTables.Name -contains $tName) {
            $browserSnapshotTables[$tName] = $rows
        }

        Write-Output ("  [OK] {0,-32} : {1,7} rows ({2,5} ms)" -f $tName, $rowCount, $sw.ElapsedMilliseconds)
    } catch {
        $sw.Stop()
        Write-Warning ("  [SKIP/WARN] {0,-25} : {1}" -f $tName, $_.Exception.Message)
        $manifestTables.Add([ordered]@{
            table_name = $tName
            row_count  = 0
            sha256     = $null
            elapsed_ms = $sw.ElapsedMilliseconds
            status     = "ERROR: $($_.Exception.Message)"
        })
    }
}

# Write cryptographic manifest.json
$manifestObj = [ordered]@{
    schema_version = "2.0"
    backup_mode    = $modeTag
    created_at     = (Get-Date).ToString("o")
    supabase_url   = $supabaseUrl
    total_rows     = $totalRowsBackedUp
    tables         = $manifestTables
}
$manifestPath = Join-Path $runDir "manifest.json"
$manifestJson = ConvertTo-Json -InputObject $manifestObj -Depth 6
[System.IO.File]::WriteAllText($manifestPath, $manifestJson, [System.Text.Encoding]::UTF8)

# Write browser-importable latest_farm_snapshot.json at backups/ root
$latestBundle = [ordered]@{
    schema_version = "2.0"
    generated_at   = (Get-Date).ToString("o")
    source         = "iSHARP Google Drive Backup Engine"
    tables         = $browserSnapshotTables
}
$latestSnapshotPath = Join-Path $backupRoot "latest_farm_snapshot.json"
$latestBundleJson = ConvertTo-Json -InputObject $latestBundle -Depth 10 -Compress
[System.IO.File]::WriteAllText($latestSnapshotPath, $latestBundleJson, [System.Text.Encoding]::UTF8)

# Rotate old backup folders beyond $RetainCount
$allFolders = Get-ChildItem -Path $backupRoot -Directory | Sort-Object Name -Descending
if ($allFolders.Count -gt $RetainCount) {
    $toDelete = $allFolders | Select-Object -Skip $RetainCount
    foreach ($oldDir in $toDelete) {
        Remove-Item -Path $oldDir.FullName -Recurse -Force -ErrorAction SilentlyContinue
        Write-Output "  [ROTATED] Removed old backup folder: $($oldDir.Name)"
    }
}

Write-Output "=================================================================="
Write-Output "  BACKUP COMPLETE: $totalRowsBackedUp total rows saved to Google Drive."
Write-Output "  Manifest        : $manifestPath"
Write-Output "  Browser Bundle  : $latestSnapshotPath"
Write-Output "=================================================================="
