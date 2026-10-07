param(
    [string]$dbPath = ""
)

$ErrorActionPreference = "Stop"

$legacyDbDir = "C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Legacy Access DB"
$supabaseUrl = "https://keappoukeagyzpoxkrru.supabase.co"
$supabaseKey = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json; charset=utf-8"
    "Prefer" = "resolution=merge-duplicates"
}

Write-Output "=========================================================="
Write-Output "  iSHARP ENTERPRISE MIGRATION: GrowoutPondHarvestPlan"
Write-Output "  Uploading legacy harvest planning targets to Supabase"
Write-Output "  Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="

# Auto-detect latest Access file if not specified
if (-not $dbPath -or -not (Test-Path $dbPath)) {
    Write-Output "Scanning for latest Access DB in: $legacyDbDir"
    $latestFile = Get-ChildItem -Path $legacyDbDir -Filter "*.accdb" |
        Sort-Object {
            if ($_.Name -match '(\d{2})\.(\d{2})\.(\d{2})') {
                "20$($Matches[1])-$($Matches[2])-$($Matches[3])"
            } else {
                $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            }
        } -Descending | Select-Object -First 1
    if (-not $latestFile) {
        throw "No .accdb database file found in $legacyDbDir"
    }
    $dbPath = $latestFile.FullName
}

Write-Output "Using Source DB: $dbPath"
Write-Output "File Size: $([math]::Round((Get-Item $dbPath).Length / 1MB, 2)) MB"
Write-Output "Target Cloud: $supabaseUrl"
Write-Output ""

# Connect to Access via OLEDB
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()
Write-Output "[OK] Connected to Microsoft Access DB successfully."

# Data Conversion Helpers
function SafeDate($val) {
    if ($val -eq $null -or $val -eq [DBNull]::Value) { return $null }
    try {
        $dt = [datetime]$val
        if ($dt.Year -lt 1990 -or $dt.Year -gt 2099) { return $null }
        return $dt.ToString("yyyy-MM-dd")
    } catch {
        return $null
    }
}

function SafeTime($val) {
    if ($val -eq $null -or $val -eq [DBNull]::Value) { return $null }
    try {
        $dt = [datetime]$val
        return $dt.ToString("HH:mm")
    } catch {
        return $null
    }
}

function SafeDecimal($val) {
    if ($val -eq $null -or $val -eq [DBNull]::Value) { return $null }
    try {
        return [decimal]$val
    } catch {
        return $null
    }
}

function SafeInt($val) {
    if ($val -eq $null -or $val -eq [DBNull]::Value) { return $null }
    try {
        return [int]$val
    } catch {
        return $null
    }
}

function SafeString($val) {
    if ($val -eq $null -or $val -eq [DBNull]::Value) { return $null }
    $s = [string]$val
    $s = $s.Trim()
    if ($s.Length -eq 0) { return $null }
    return $s
}

function Post-BatchToSupabase([string]$endpoint, [array]$batch, [string]$conflictKey) {
    if ($batch.Count -eq 0) { return }
    $uri = "$supabaseUrl/rest/v1/$endpoint"
    if ($conflictKey) {
        $uri += "?on_conflict=$conflictKey"
    }
    $json = $batch | ConvertTo-Json -Depth 5
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $retryCount = 0
    while ($retryCount -lt 5) {
        try {
            $null = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $bodyBytes -TimeoutSec 60
            return
        } catch {
            $retryCount++
            $errDetails = $_.Exception.Message
            if ($_.ErrorDetails) {
                $errDetails = $_.ErrorDetails.Message
            } elseif ($_.Exception.Response) {
                try {
                    $stream = $_.Exception.Response.GetResponseStream()
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errDetails = $reader.ReadToEnd()
                } catch {}
            }
            Write-Warning "Retry $retryCount for ${endpoint}: $errDetails"
            Start-Sleep -Seconds 2
        }
    }
    throw "Failed to upload batch to ${endpoint} after 5 retries."
}

# Count total rows
$countCmd = $conn.CreateCommand()
$countCmd.CommandText = "SELECT COUNT(*) FROM [GrowoutPondHarvestPlan]"
$totalRows = [int]$countCmd.ExecuteScalar()
Write-Output "Total rows to migrate: $totalRows"

# Stream rows deterministically
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT PondIndex, planharvstts, planharvdate, planharvabw, planharvwgt, timeHvt, timeDlv, Team, indexNo FROM [GrowoutPondHarvestPlan] ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()

$batch = @()
$processed = 0
$batchSize = 1000
$startTime = Get-Date

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    $planDate = SafeDate $reader["planharvdate"]
    $planStts = SafeString $reader["planharvstts"]
    $planAbw = SafeDecimal $reader["planharvabw"]
    $planWgt = SafeDecimal $reader["planharvwgt"]
    $timeHvt = SafeTime $reader["timeHvt"]
    $timeDlv = SafeTime $reader["timeDlv"]
    $team = SafeString $reader["Team"]
    $indexNo = SafeInt $reader["indexNo"]

    if (-not $pIdx -or -not $planDate) {
        continue
    }

    $pLabel = if ($pIdx.Length -ge 7) {
        "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))"
    } else {
        $pIdx
    }

    $syncKey = "${pIdx}_${planDate}_${planStts}_${indexNo}"

    $batch += [ordered]@{
        index_no = $indexNo
        sync_key = $syncKey
        pond_index = $pIdx
        pond = $pLabel
        plan_harv_date = $planDate
        plan_harv_status = $(if ($planStts) { $planStts } else { "TERMINATION" })
        plan_harv_abw = $planAbw
        plan_harv_weight = $planWgt
        time_harvest = $timeHvt
        time_delivery = $timeDlv
        team = $team
    }

    $processed++

    if ($batch.Count -ge $batchSize) {
        Post-BatchToSupabase "pond_harvest_plan" $batch "sync_key"
        $elapsed = (Get-Date) - $startTime
        $pct = [math]::Round(($processed / $totalRows) * 100, 1)
        Write-Output "  -> Processed $processed / $totalRows rows ($pct%) - Elapsed: $([int]$elapsed.TotalSeconds)s"
        $batch = @()
    }
}
$reader.Close()

if ($batch.Count -gt 0) {
    Post-BatchToSupabase "pond_harvest_plan" $batch "sync_key"
}

$conn.Close()

$totalElapsed = (Get-Date) - $startTime
Write-Output ""
Write-Output "=========================================================="
Write-Output "  [SUCCESS] Migrated $processed records to pond_harvest_plan"
Write-Output "  Total Execution Time: $([int]$totalElapsed.TotalSeconds)s"
Write-Output "  Finish Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="
