param(
    [string]$dbPath = "",
    [int]$reconcileDays = 180
)

$ErrorActionPreference = "Stop"

$legacyDbDir = "D:\DB"
$supabaseUrl = "https://keappoukeagyzpoxkrru.supabase.co"
$supabaseKey = if ($env:SUPABASE_SERVICE_ROLE_KEY) { $env:SUPABASE_SERVICE_ROLE_KEY } else { "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s" }
$editorPasscode = if ($env:ISHARP_EDITOR_PASSCODE) { $env:ISHARP_EDITOR_PASSCODE } else { "mantaray" }

$reconcileCutoff = (Get-Date).AddDays(-$reconcileDays).ToString("yyyy-MM-dd")

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json; charset=utf-8"
    "Prefer" = "resolution=merge-duplicates"
    "x-isharp-passcode" = $editorPasscode
}

Write-Output "=========================================================="
Write-Output "  iSHARP ENTERPRISE SMART WEEKLY SYNC (Access -> Supabase)"
Write-Output "  Architecture: Authoritative Cycle-Reconciliation (No index_no)"
Write-Output "  Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="

# Auto-detect latest Setiu Access file from D:\DB or local directories if not explicitly specified
if (-not $dbPath -or -not (Test-Path $dbPath)) {
    $searchDirs = @($legacyDbDir, "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Legacy Access DB", "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Legacy Access DB")
    foreach ($dir in $searchDirs) {
        if (Test-Path $dir) {
            Write-Output "Scanning for latest Setiu Access DB in: $dir"
            $latestFile = Get-ChildItem -Path $dir -Filter "Bab SGo*.accdb" |
                Sort-Object {
                    if ($_.Name -match '26\.(\d{2})\.(\d{2})') {
                        "2026-$($Matches[1])-$($Matches[2])"
                    } elseif ($_.Name -match '(\d{2})\.(\d{2})\.26') {
                        "2026-$($Matches[2])-$($Matches[1])"
                    } else {
                        $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                } -Descending | Select-Object -First 1
            if ($latestFile) {
                $dbPath = $latestFile.FullName
                break
            }
        }
    }
    if (-not $dbPath -or -not (Test-Path $dbPath)) {
        throw "No Setiu Access database ('Bab SGo*.accdb') found in search paths. Please connect the D: drive or place the file in Legacy Access DB."
    }
}

Write-Output "Using Source DB: $dbPath"
Write-Output "File Size: $([math]::Round((Get-Item $dbPath).Length / 1MB, 2)) MB"
$lockFile = [System.IO.Path]::ChangeExtension($dbPath, ".laccdb")
if (Test-Path $lockFile) {
    Write-Output "  [NOTICE] An active lock file ($([System.IO.Path]::GetFileName($lockFile))) was detected."
    Write-Output "           Microsoft Access may be open. Reading in shared mode..."
}
Write-Output "Target Cloud: $supabaseUrl"
Write-Output "Active Reconcile Cutoff: $reconcileCutoff"
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

# Resilient Supabase REST GET Helper (Omit Content-Type to prevent PostgREST 404s, 3 retries)
function Get-FromSupabase([string]$uri) {
    $getHeaders = @{
        "apikey" = $supabaseKey
        "Authorization" = "Bearer $supabaseKey"
    }
    $retryCount = 0
    while ($retryCount -lt 3) {
        try {
            return (Invoke-RestMethod -Uri $uri -Headers $getHeaders -Method Get -TimeoutSec 45)
        } catch {
            $retryCount++
            $err = $_.Exception.Message
            if ($_.ErrorDetails) { $err = $_.ErrorDetails.Message }
            Write-Warning "GET retry $retryCount for ${uri}: $err"
            Start-Sleep -Seconds 2
        }
    }
    throw "Failed to fetch from Supabase after 3 retries: $uri"
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
    while ($retryCount -lt 3) {
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
            # Fallback if conflictKey constraint is not yet created in PostgreSQL
            if ($conflictKey -and $errDetails -match "unique or exclusion constraint") {
                Write-Warning "Unique constraint for $conflictKey not found on $endpoint; retrying with default primary key resolution."
                $uri = "$supabaseUrl/rest/v1/$endpoint"
                continue
            }
            Write-Warning "Retry $retryCount for ${endpoint}: $errDetails"
            Start-Sleep -Seconds 2
        }
    }
    throw "Failed to upload batch to ${endpoint} after 3 retries: $errDetails"
}

# Purges existing Supabase records for a collection of pond_index cycles
function Purge-PondIndexRecords([string]$endpoint, [array]$pondIndices) {
    if ($pondIndices.Count -eq 0) { return }
    $chunkSize = 40
    for ($i = 0; $i -lt $pondIndices.Count; $i += $chunkSize) {
        $slice = $pondIndices[$i..[Math]::Min($i + $chunkSize - 1, $pondIndices.Count - 1)]
        $inList = ($slice | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join ","
        $delUrl = "$supabaseUrl/rest/v1/$endpoint?pond_index=in.($inList)"
        $delHeaders = @{
            "apikey" = $supabaseKey
            "Authorization" = "Bearer $supabaseKey"
        }
        $retryCount = 0
        while ($retryCount -lt 3) {
            try {
                $null = Invoke-RestMethod -Uri $delUrl -Headers $delHeaders -Method Delete -TimeoutSec 60
                break
            } catch {
                $retryCount++
                Write-Warning "Purge retry $retryCount for ${endpoint}: $($_.Exception.Message)"
                Start-Sleep -Seconds 1
            }
        }
    }
}

# -------------------------------------------------------------
# STAGE 1: Synchronize Master Cycles (growout_pond_master)
# Upsert active cycles + recently closed/modified cycles + any new cycles
# -------------------------------------------------------------
Write-Output ""
Write-Output "[1/12] Synchronizing Master Culture Cycles (growout_pond_master)..."

$sbPondIndices = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$offset = 0
$limit = 1000
while ($true) {
    $queryUrl = "$supabaseUrl/rest/v1/growout_pond_master?select=pond_index&limit=" + $limit + "&offset=" + $offset
    $res = Get-FromSupabase $queryUrl
    if ($res.Count -eq 0) { break }
    foreach ($row in $res) {
        $sbPondIndices.Add($row.pond_index) | Out-Null
    }
    $offset += $limit
    if ($res.Count -lt $limit) { break }
}
Write-Output "  -> Supabase currently tracks $($sbPondIndices.Count) culture cycles."

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT PondIndex, pond, modl, row, cropno, cycleno, [pond status], [pond active], [date cycle], [date ready], [culture status], [disease status], area, [pond type], [pond usage], [date cleaning], [DateRepair], [date filling], [date culture], [DateBabyBox], [DateQaqc], [date close], [final status], IdleStatus, [water type], Initiative, [I HP], [2 HP], [DatePlanStock], [strategy], [date disease], [Initiative1], [Initiative2], [Tested] FROM [GrowoutPondMaster]"
$reader = $cmd.ExecuteReader()

$masterBatch = @()
$dateBatch = @()
$initBatch = @()
$activeCyclesNeedingCloseCleanup = @()
$masterCount = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx) { continue }

    $rawActive = SafeString $reader["pond active"]
    $rawStatus = SafeString $reader["pond status"]
    $dtClose = SafeDate $reader["date close"]

    # Normalize casing and status
    $cleanActive = if ($rawActive) {
        $norm = $rawActive.Replace(" ", "").ToUpper()
        if ($norm -eq "INACTIVE") { "INACTIVE" } else { "ACTIVE" }
    } else { "ACTIVE" }

    $cleanStatus = if ($rawStatus) {
        $s = $rawStatus.Trim().ToUpper()
        if ($s -in @("NOT IN USED", "NOT IN USE", "NOT_IN_USE")) { "NOT IN USE" }
        elseif ($s -in @("PRODUCTION", "IDLE", "PREPARATION", "RESERVOIR", "MAINTENANCE", "CLOSE")) { $s }
        else { $s }
    } else { "IDLE" }

    # Sync if active, or if not yet in Supabase, or if closed within the last 60 days
    $isNew = -not $sbPondIndices.Contains($pIdx)
    $isActive = ($cleanActive -eq "ACTIVE")
    $isRecentClose = ($dtClose -ne $null -and [datetime]$dtClose -ge (Get-Date).AddDays(-60))

    if (-not ($isNew -or $isActive -or $isRecentClose)) {
        continue
    }

    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { SafeString $reader["pond"] }

    $obj = [ordered]@{
        pond_index = $pIdx
        pond = $pLabel
        farm = "SETIU"
        modl = SafeString $reader["modl"]
        row_no = SafeString $reader["row"]
        crop_no = SafeString $reader["cropno"]
        cycle_no = SafeString $reader["cycleno"]
        pond_status = $cleanStatus
        pond_active = $cleanActive
        area = $(if ($reader["area"] -ne [DBNull]::Value) { SafeDecimal $reader["area"] } else { 0.50 })
        pond_type = $(if ($reader["pond type"] -ne [DBNull]::Value) { SafeString $reader["pond type"] } else { "FULL LINING" })
        pond_usage = $(if ($reader["pond usage"] -ne [DBNull]::Value) { SafeString $reader["pond usage"] } else { "GROWOUT" })
        culture_status = $(if ($reader["culture status"] -ne [DBNull]::Value) { SafeString $reader["culture status"] } else { "STANDARD" })
        disease_status = $(if ($reader["disease status"] -ne [DBNull]::Value) { SafeString $reader["disease status"] } else { "NO ISSUES" })
        final_status = SafeString $reader["final status"]
        idle_days = 0
        idle_status = SafeString $reader["IdleStatus"]
        water_type = $(if ($reader["water type"] -ne [DBNull]::Value) { SafeString $reader["water type"] } else { "SEA WATER" })
        strategy = SafeString $reader["strategy"]
        tested = SafeString $reader["Tested"]
    }
    $masterBatch += $obj
    $sbPondIndices.Add($pIdx) | Out-Null
    $masterCount++

    # If cycle is ACTIVE in Access and date close is empty, track for cleanup in case user prematurely closed in UI
    if ($cleanActive -eq "ACTIVE" -and -not $dtClose) {
        $activeCyclesNeedingCloseCleanup += $pIdx
    }

    # Collect lifecycle event dates for pond_event_date table
    $dateCycle = SafeDate $reader["date cycle"]
    $dateMap = @{
        "disease"    = SafeDate $reader["date disease"]
        "close"      = $dtClose
        "cycle"      = $dateCycle
        "cleaning"   = SafeDate $reader["date cleaning"]
        "repair"     = SafeDate $reader["DateRepair"]
        "filling"    = SafeDate $reader["date filling"]
        "culture"    = SafeDate $reader["date culture"]
        "baby_box"   = SafeDate $reader["DateBabyBox"]
        "qaqc"       = SafeDate $reader["DateQaqc"]
        "ready"      = SafeDate $reader["date ready"]
        "plan_stock" = SafeDate $reader["DatePlanStock"]
    }
    $prepEvents = @("cleaning", "repair", "filling", "culture", "baby_box", "qaqc", "ready", "plan_stock")

    foreach ($evt in $dateMap.Keys) {
        $dVal = $dateMap[$evt]
        if ($dVal) {
            if ($evt -in $prepEvents) {
                if (-not $dateCycle) {
                    if ($cleanStatus -eq "IDLE") { continue }
                } else {
                    if ([datetime]$dVal -lt [datetime]$dateCycle) { continue }
                }
            }

            $dateBatch += [ordered]@{
                pond_index = $pIdx
                event_name = $evt
                event_date = $dVal
            }
        }
    }

    # Collect initiatives for pond_initiatives table
    $rawInits = @(
        (SafeString $reader["Initiative"]),
        (SafeString $reader["Initiative1"]),
        (SafeString $reader["Initiative2"])
    )
    foreach ($initStr in $rawInits) {
        if ($initStr -and $initStr.Trim() -ne "") {
            $initBatch += [ordered]@{
                pond_index = $pIdx
                initiative_name = $initStr.Trim()
            }
        }
    }
}
$reader.Close()

if ($masterBatch.Count -gt 0) {
    Post-BatchToSupabase "growout_pond_master" $masterBatch "pond_index"
    Write-Output "  [OK] Upserted $masterCount active/recent culture cycles into growout_pond_master."
} else {
    Write-Output "  [OK] All master cycles already up-to-date."
}

# Clean accidental close dates for active cycles
if ($activeCyclesNeedingCloseCleanup.Count -gt 0) {
    $cSize = 40
    for ($i = 0; $i -lt $activeCyclesNeedingCloseCleanup.Count; $i += $cSize) {
        $sSlice = $activeCyclesNeedingCloseCleanup[$i..[Math]::Min($i + $cSize - 1, $activeCyclesNeedingCloseCleanup.Count - 1)]
        $inStr = ($sSlice | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join ","
        $delCloseUrl = "$supabaseUrl/rest/v1/pond_event_date?event_name=eq.close&pond_index=in.($inStr)"
        try {
            $null = Invoke-RestMethod -Uri $delCloseUrl -Headers $headers -Method Delete -TimeoutSec 30
        } catch {}
    }
}

if ($dateBatch.Count -gt 0) {
    $chunkSize = 200
    for ($i = 0; $i -lt $dateBatch.Count; $i += $chunkSize) {
        $slice = $dateBatch[$i..[Math]::Min($i + $chunkSize - 1, $dateBatch.Count - 1)]
        Post-BatchToSupabase "pond_event_date" $slice "pond_index,event_name"
    }
    Write-Output "  [OK] Upserted $($dateBatch.Count) lifecycle dates into pond_event_date."
}

if ($initBatch.Count -gt 0) {
    Post-BatchToSupabase "pond_initiatives" $initBatch "pond_index,initiative_name"
    Write-Output "  [OK] Upserted $($initBatch.Count) farm trials into pond_initiatives."
}

# -------------------------------------------------------------
# STAGE 2: Synchronize Gatekeeper (active_operational_ponds)
# Reconcile currently active PRODUCTION ponds
# -------------------------------------------------------------
Write-Output ""
Write-Output "[2/12] Synchronizing Active Gatekeeper (active_operational_ponds)..."
$cmd.CommandText = "SELECT PondIndex, pond FROM [GrowoutPondMaster] WHERE [pond status] = 'PRODUCTION' AND ([pond active] = 'ACTiVE' OR [pond active] = 'ACTIVE')"
$reader = $cmd.ExecuteReader()
$accessActiveDict = @{}
while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { SafeString $reader["pond"] }
    $accessActiveDict[$pLabel] = $pIdx
}
$reader.Close()

$sbActive = Get-FromSupabase "$supabaseUrl/rest/v1/active_operational_ponds?select=pond,pond_index"
$sbActiveDict = @{}
foreach ($item in $sbActive) {
    $sbActiveDict[$item.pond] = $item.pond_index
}

# Determine removals
$removedCount = 0
foreach ($p in $sbActiveDict.Keys) {
    if (-not $accessActiveDict.ContainsKey($p)) {
        try {
            $delUrl = "$supabaseUrl/rest/v1/active_operational_ponds?pond=eq." + [System.Uri]::EscapeDataString($p)
            $null = Invoke-RestMethod -Uri $delUrl -Headers $headers -Method Delete
            $removedCount++
        } catch {
            Write-Warning ("Could not remove pond " + $p + " from gatekeeper: " + $_.Exception.Message)
        }
    }
}

# Determine adds/updates
$gateBatch = @()
foreach ($p in $accessActiveDict.Keys) {
    if (-not $sbActiveDict.ContainsKey($p) -or $sbActiveDict[$p] -ne $accessActiveDict[$p]) {
        $gateBatch += [ordered]@{
            pond = $p
            pond_index = $accessActiveDict[$p]
            activated_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")
        }
    }
}

if ($gateBatch.Count -gt 0) {
    Post-BatchToSupabase "active_operational_ponds" $gateBatch "pond"
}
Write-Output "  [OK] Gatekeeper updated: $($accessActiveDict.Count) active ponds ($($gateBatch.Count) added/updated, $removedCount removed)."

# -------------------------------------------------------------
# STAGE 3: Authoritative GrowoutPondStocking -> pond_stocking_batches
# Cycle-level replacement: Access is the official master source.
# -------------------------------------------------------------
Write-Output ""
Write-Output "[3/12] Reconciling Stocking Batches (pond_stocking_batches)..."
$cmd.CommandText = "SELECT PondIndex, stckdate, stcksource, stckspcs, stckpcs, stcktype, stckallow, stcktotal, stcktank, stcksize, stckplstts, BSLine FROM [GrowoutPondStocking] WHERE stckdate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY PondIndex ASC, stckdate ASC"
$reader = $cmd.ExecuteReader()
$stockingByPond = @{}
$totalAccessStockingRows = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    if (-not $stockingByPond.ContainsKey($pIdx)) {
        $stockingByPond[$pIdx] = @()
    }

    $stockingByPond[$pIdx] += [ordered]@{
        pond_index = $pIdx
        stck_date = SafeDate $reader["stckdate"]
        stck_source = SafeString $reader["stcksource"]
        stck_species = $(if ($reader["stckspcs"] -ne [DBNull]::Value) { SafeString $reader["stckspcs"] } else { "P. VANNAMEI" })
        stck_pcs = SafeDecimal $reader["stckpcs"]
        stck_type = $(if ($reader["stcktype"] -ne [DBNull]::Value) { SafeString $reader["stcktype"] } else { "SPT" })
        stck_allow = SafeDecimal $reader["stckallow"]
        stck_total = SafeDecimal $reader["stcktotal"]
        stck_tank = SafeString $reader["stcktank"]
        stck_size = SafeDecimal $reader["stcksize"]
        stck_plstts = $(if ($reader["stckplstts"] -ne [DBNull]::Value) { SafeString $reader["stckplstts"] } else { "1. NPL" })
        bs_line = SafeString $reader["BSLine"]
    }
    $totalAccessStockingRows++
}
$reader.Close()

$distinctStockingPonds = @($stockingByPond.Keys)
if ($distinctStockingPonds.Count -gt 0) {
    # Purge existing Supabase records for cycles present in Access (erasing any UI mistakes/duplicates)
    Purge-PondIndexRecords "pond_stocking_batches" $distinctStockingPonds

    # Insert authoritative records from Access (Supabase generates clean IDs)
    $uploadBatch = @()
    foreach ($p in $distinctStockingPonds) {
        $uploadBatch += $stockingByPond[$p]
        if ($uploadBatch.Count -ge 500) {
            Post-BatchToSupabase "pond_stocking_batches" $uploadBatch $null
            $uploadBatch = @()
        }
    }
    if ($uploadBatch.Count -gt 0) {
        Post-BatchToSupabase "pond_stocking_batches" $uploadBatch $null
    }
    Write-Output "  [OK] Reconciled $totalAccessStockingRows official stocking batches across $($distinctStockingPonds.Count) pond cycles."
} else {
    Write-Output "  [OK] No stocking records in Access within the reconcile window."
}

# -------------------------------------------------------------
# STAGE 4: Authoritative GrowoutPondHarvestDaily -> pond_harvest_daily
# Cycle-level replacement: Access is the official master source.
# -------------------------------------------------------------
Write-Output ""
Write-Output "[4/12] Reconciling Daily Harvest Runs (pond_harvest_daily)..."
$cmd.CommandText = "SELECT PondIndex, harvdate, harvstts, harvwgt, harvabw, harvRev, harvmtd FROM [GrowoutPondHarvestDaily] WHERE harvdate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY PondIndex ASC, harvdate ASC"
$reader = $cmd.ExecuteReader()
$harvestByPond = @{}
$totalAccessHarvestRows = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    if (-not $harvestByPond.ContainsKey($pIdx)) {
        $harvestByPond[$pIdx] = @()
    }

    $harvestByPond[$pIdx] += [ordered]@{
        pond_index = $pIdx
        harv_date = $(if ($reader["harvdate"] -ne [DBNull]::Value) { SafeDate $reader["harvdate"] } else { (Get-Date).ToString("yyyy-MM-dd") })
        harv_status = $(if ($reader["harvstts"] -ne [DBNull]::Value) { SafeString $reader["harvstts"] } else { "TERMINATION" })
        harv_weight = $(if ($reader["harvwgt"] -ne [DBNull]::Value) { SafeDecimal $reader["harvwgt"] } else { 0.0 })
        harv_abw = $(if ($reader["harvabw"] -ne [DBNull]::Value) { SafeDecimal $reader["harvabw"] } else { 0.0 })
        harv_revenue = $(if ($reader["harvRev"] -ne [DBNull]::Value) { SafeDecimal $reader["harvRev"] } else { 0.0 })
        harv_method = $(if ($reader["harvmtd"] -ne [DBNull]::Value) { SafeString $reader["harvmtd"] } else { "M" })
    }
    $totalAccessHarvestRows++
}
$reader.Close()

$distinctHarvestPonds = @($harvestByPond.Keys)
if ($distinctHarvestPonds.Count -gt 0) {
    # Purge existing Supabase records for cycles present in Access (erasing any UI mistakes/duplicates)
    Purge-PondIndexRecords "pond_harvest_daily" $distinctHarvestPonds

    $uploadBatch = @()
    foreach ($p in $distinctHarvestPonds) {
        $uploadBatch += $harvestByPond[$p]
        if ($uploadBatch.Count -ge 500) {
            Post-BatchToSupabase "pond_harvest_daily" $uploadBatch $null
            $uploadBatch = @()
        }
    }
    if ($uploadBatch.Count -gt 0) {
        Post-BatchToSupabase "pond_harvest_daily" $uploadBatch $null
    }
    Write-Output "  [OK] Reconciled $totalAccessHarvestRows official harvest daily logs across $($distinctHarvestPonds.Count) pond cycles."
} else {
    Write-Output "  [OK] No harvest records in Access within the reconcile window."
}

# -------------------------------------------------------------
# STAGE 5: Authoritative GrowoutPondHarvestSales -> pond_harvest_sales
# Cycle-level replacement: Access is the official master source.
# -------------------------------------------------------------
Write-Output ""
Write-Output "[5/12] Reconciling Harvest Sales (pond_harvest_sales)..."
$cmd.CommandText = "SELECT HvtPondIndx, HvtDate, HvtABW, GoodWGT, GoodPRC, [2ndGradeWGT], [2ndGradePRC], SmallWGT, BelowWGT, RubbishwGT, RawWGT, HvtSLS, HvtBuyer FROM [GrowoutPondHarvestSales] WHERE HvtDate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY HvtPondIndx ASC, HvtDate ASC"
$reader = $cmd.ExecuteReader()
$salesByPond = @{}
$totalAccessSalesRows = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["HvtPondIndx"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $hDate = SafeDate $reader["HvtDate"]
    if (-not $hDate) { continue }

    if (-not $salesByPond.ContainsKey($pIdx)) {
        $salesByPond[$pIdx] = @()
    }

    $salesByPond[$pIdx] += [ordered]@{
        pond_index = $pIdx
        hvt_date = $hDate
        hvt_buyer = SafeString $reader["HvtBuyer"]
        hvt_abw = SafeDecimal $reader["HvtABW"]
        good_wgt = SafeDecimal $reader["GoodWGT"]
        good_prc = SafeDecimal $reader["GoodPRC"]
        second_grade_wgt = SafeDecimal $reader["2ndGradeWGT"]
        second_grade_prc = SafeDecimal $reader["2ndGradePRC"]
        small_wgt = SafeDecimal $reader["SmallWGT"]
        below_wgt = SafeDecimal $reader["BelowWGT"]
        rubbish_wgt = SafeDecimal $reader["RubbishwGT"]
        raw_wgt = SafeDecimal $reader["RawWGT"]
        net_sales = SafeDecimal $reader["HvtSLS"]
    }
    $totalAccessSalesRows++
}
$reader.Close()

$distinctSalesPonds = @($salesByPond.Keys)
if ($distinctSalesPonds.Count -gt 0) {
    # Purge existing Supabase records for cycles present in Access
    Purge-PondIndexRecords "pond_harvest_sales" $distinctSalesPonds

    $uploadBatch = @()
    foreach ($p in $distinctSalesPonds) {
        $uploadBatch += $salesByPond[$p]
        if ($uploadBatch.Count -ge 500) {
            Post-BatchToSupabase "pond_harvest_sales" $uploadBatch $null
            $uploadBatch = @()
        }
    }
    if ($uploadBatch.Count -gt 0) {
        Post-BatchToSupabase "pond_harvest_sales" $uploadBatch $null
    }
    Write-Output "  [OK] Reconciled $totalAccessSalesRows official sales slips across $($distinctSalesPonds.Count) pond cycles."
} else {
    Write-Output "  [OK] No sales records in Access within the reconcile window."
}

# -------------------------------------------------------------
# STAGE 6: Authoritative Pathology Issues (pond_issues) & Notes (pond_notes)
# Cycle-level replacement: Access is the official master source.
# -------------------------------------------------------------
Write-Output ""
Write-Output "[6/12] Reconciling Pathology Issues (pond_issues) & Notes..."
$cmd.CommandText = "SELECT PondIndex, issuedate, issueCat, issuestts, issuetest, issueflag, issueGrade, issueNote FROM [GrowoutPondIssues] WHERE issuedate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY PondIndex ASC, issuedate ASC"
$reader = $cmd.ExecuteReader()
$issuesByPond = @{}
$totalAccessIssueRows = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    if (-not $issuesByPond.ContainsKey($pIdx)) {
        $issuesByPond[$pIdx] = @()
    }

    $issuesByPond[$pIdx] += [ordered]@{
        pond_index = $pIdx
        issue_date = $(if ($reader["issuedate"] -ne [DBNull]::Value) { SafeDate $reader["issuedate"] } else { (Get-Date).ToString("yyyy-MM-dd") })
        issue_category = $(if ($reader["issueCat"] -ne [DBNull]::Value) { SafeString $reader["issueCat"] } else { "DISEASE" })
        issue_status = $(if ($reader["issuestts"] -ne [DBNull]::Value) { SafeString $reader["issuestts"] } else { "EHP" })
        issue_test = $(if ($reader["issuetest"] -ne [DBNull]::Value) { SafeString $reader["issuetest"] } else { "MICROSCOPY" })
        issue_flag = $(if ($reader["issueflag"] -ne [DBNull]::Value) { SafeString $reader["issueflag"] } else { "GREEN" })
        issue_grade = $(if ($reader["issueGrade"] -ne [DBNull]::Value) { SafeString $reader["issueGrade"] } else { "G0" })
        issue_note = $(if ($reader["issueNote"] -ne [DBNull]::Value) { SafeString $reader["issueNote"] } else { "NEGATIVE" })
    }
    $totalAccessIssueRows++
}
$reader.Close()

$distinctIssuePonds = @($issuesByPond.Keys)
if ($distinctIssuePonds.Count -gt 0) {
    Purge-PondIndexRecords "pond_issues" $distinctIssuePonds

    $uploadBatch = @()
    foreach ($p in $distinctIssuePonds) {
        $uploadBatch += $issuesByPond[$p]
        if ($uploadBatch.Count -ge 500) {
            Post-BatchToSupabase "pond_issues" $uploadBatch $null
            $uploadBatch = @()
        }
    }
    if ($uploadBatch.Count -gt 0) {
        Post-BatchToSupabase "pond_issues" $uploadBatch $null
    }
    Write-Output "  [OK] Reconciled $totalAccessIssueRows pathology issues across $($distinctIssuePonds.Count) pond cycles."
}

# Notes: Deduplicate by pond_index + note content
$existingNotesUrl = "$supabaseUrl/rest/v1/pond_notes?select=pond_index,note&limit=5000"
$existingNoteSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
try {
    $existingNotesRes = Get-FromSupabase $existingNotesUrl
    foreach ($nr in $existingNotesRes) {
        if ($nr.pond_index -and $nr.note) {
            $existingNoteSet.Add("$($nr.pond_index)_$($nr.note.Trim())") | Out-Null
        }
    }
} catch {}

$cmd.CommandText = "SELECT PondIndex, Remark FROM [GrowoutPondNote] WHERE Remark IS NOT NULL"
$reader = $cmd.ExecuteReader()
$notesBatch = @()
$newNotesCount = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    $rem = SafeString $reader["Remark"]
    if (-not $pIdx -or -not $rem -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $sig = "${pIdx}_${rem}"
    if ($existingNoteSet.Contains($sig)) { continue }
    $existingNoteSet.Add($sig) | Out-Null

    $notesBatch += [ordered]@{
        pond_index = $pIdx
        note = $rem
        logged_by = "ACCESS_WEEKLY_SYNC"
    }
    $newNotesCount++

    if ($notesBatch.Count -ge 500) {
        Post-BatchToSupabase "pond_notes" $notesBatch $null
        $notesBatch = @()
    }
}
$reader.Close()

if ($notesBatch.Count -gt 0) {
    Post-BatchToSupabase "pond_notes" $notesBatch $null
}
Write-Output "  [OK] Added $newNotesCount new pond notes."

# -------------------------------------------------------------
# STAGE 7: Authoritative Biometrics Sampling -> biometrics_sampling
# Cycle-level replacement: Access is the official master source.
# -------------------------------------------------------------
Write-Output ""
Write-Output "[7/12] Reconciling Biometrics Samplings (biometrics_sampling)..."
$cmd.CommandText = "SELECT PondIndex, smpldate, SmplDoc, smplabw, smplsurv, SmplDFed, SmplTFed, Psmpldate, PSmplDoc, Psmplabw, Psmplsurv, PSmplDFed, PSmplTFed, sttgabw, sttgsurv, sttgbms, sttgDFed, sttgTFed, smplbms FROM [GrowoutPondSampling] WHERE smpldate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY PondIndex ASC, smpldate ASC"
$reader = $cmd.ExecuteReader()
$samplingByPond = @{}
$totalAccessSamplingRows = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    if (-not $samplingByPond.ContainsKey($pIdx)) {
        $samplingByPond[$pIdx] = @()
    }

    $samplingByPond[$pIdx] += [ordered]@{
        pond_index = $pIdx
        smpl_date = $(if ($reader["smpldate"] -ne [DBNull]::Value) { SafeDate $reader["smpldate"] } else { (Get-Date).ToString("yyyy-MM-dd") })
        smpl_doc = $(if ($reader["SmplDoc"] -ne [DBNull]::Value) { SafeInt $reader["SmplDoc"] } else { 0 })
        smpl_abw = $(if ($reader["smplabw"] -ne [DBNull]::Value) { SafeDecimal $reader["smplabw"] } else { 0.0 })
        smpl_surv = SafeDecimal $reader["smplsurv"]
        smpl_dfed = SafeDecimal $reader["SmplDFed"]
        smpl_tfed = SafeDecimal $reader["SmplTFed"]
        smpl_bms = SafeDecimal $reader["smplbms"]
        p_smpl_date = SafeDate $reader["Psmpldate"]
        p_smpl_doc = SafeInt $reader["PSmplDoc"]
        p_smpl_abw = SafeDecimal $reader["Psmplabw"]
        p_smpl_surv = SafeDecimal $reader["Psmplsurv"]
        p_smpl_dfed = SafeDecimal $reader["PSmplDFed"]
        p_smpl_tfed = SafeDecimal $reader["PSmplTFed"]
        sttg_abw = SafeDecimal $reader["sttgabw"]
        sttg_surv = SafeDecimal $reader["sttgsurv"]
        sttg_bms = SafeDecimal $reader["sttgbms"]
        sttg_dfed = SafeDecimal $reader["sttgDFed"]
        sttg_tfed = SafeDecimal $reader["sttgTFed"]
    }
    $totalAccessSamplingRows++
}
$reader.Close()

$distinctSamplingPonds = @($samplingByPond.Keys)
if ($distinctSamplingPonds.Count -gt 0) {
    Purge-PondIndexRecords "biometrics_sampling" $distinctSamplingPonds

    $uploadBatch = @()
    foreach ($p in $distinctSamplingPonds) {
        $uploadBatch += $samplingByPond[$p]
        if ($uploadBatch.Count -ge 500) {
            Post-BatchToSupabase "biometrics_sampling" $uploadBatch $null
            $uploadBatch = @()
        }
    }
    if ($uploadBatch.Count -gt 0) {
        Post-BatchToSupabase "biometrics_sampling" $uploadBatch $null
    }
    Write-Output "  [OK] Reconciled $totalAccessSamplingRows official biometrics samplings across $($distinctSamplingPonds.Count) pond cycles."
} else {
    Write-Output "  [OK] No sampling records in Access within the reconcile window."
}

# -------------------------------------------------------------
# STAGE 8: Synchronize Paddlewheel Aerators (pond_aerator_inventory)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[8/12] Synchronizing Paddlewheel Aerators (pond_aerator_inventory)..."
$cmd.CommandText = "SELECT [Pond Index], [1HP], [2HP] FROM [MNA-PWA Status] WHERE [Pond Index] IS NOT NULL"
$reader = $cmd.ExecuteReader()
$aeratorBatch = @()
$aeratorCount = 0
while ($reader.Read()) {
    $pIdx = SafeString $reader["Pond Index"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }
    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { $pIdx }

    $u1 = SafeInt $reader["1HP"]
    $u2 = SafeInt $reader["2HP"]
    $nowStr = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")

    if ($u1 -ne $null -and $u1 -ge 0) {
        $aeratorBatch += [ordered]@{
            pond_index = $pIdx
            pond = $pLabel
            aerator_model = "1.0 HP Paddlewheel"
            hp = 1.0
            total_units = $u1
            active_units = $u1
            updated_at = $nowStr
        }
    }
    if ($u2 -ne $null -and $u2 -ge 0) {
        $aeratorBatch += [ordered]@{
            pond_index = $pIdx
            pond = $pLabel
            aerator_model = "2.0 HP Paddlewheel"
            hp = 2.0
            total_units = $u2
            active_units = $u2
            updated_at = $nowStr
        }
    }
    $aeratorCount++
    if ($aeratorBatch.Count -ge 500) {
        Post-BatchToSupabase "pond_aerator_inventory" $aeratorBatch "pond_index,aerator_model,hp"
        $aeratorBatch = @()
    }
}
$reader.Close()
if ($aeratorBatch.Count -gt 0) {
    Post-BatchToSupabase "pond_aerator_inventory" $aeratorBatch "pond_index,aerator_model,hp"
}
Write-Output "  [OK] Synchronized aerator configurations for $aeratorCount pond cycles."

# -------------------------------------------------------------
# STAGE 9: Preservation of Legacy Feed Records (growout_pond_feed_legacy)
# Architecture: Zero index_no / Natural Key deduplication
# -------------------------------------------------------------
Write-Output ""
Write-Output "[9/12] Preserving Legacy Feed (growout_pond_feed_legacy)..."
$existingFeedKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
try {
    $feedRes = Get-FromSupabase "$supabaseUrl/rest/v1/growout_pond_feed_legacy?select=pond_index,feed_date,feed_type,quantity_kg&order=created_at.desc&limit=5000"
    foreach ($r in $feedRes) {
        if ($r.pond_index -and $r.feed_date) {
            $existingFeedKeys.Add("$($r.pond_index)_$($r.feed_date)_$($r.feed_type)_$($r.quantity_kg)") | Out-Null
        }
    }
} catch {
    Write-Warning "Could not preload existing feed keys: $($_.Exception.Message)"
}

$cmd.CommandText = "SELECT indexNo, PondIndex, [date], feed, quantity FROM [GrowoutPondFeed] WHERE [date] >= DateAdd('d', -$reconcileDays, Date()) ORDER BY [date] ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newFeedCount = 0
while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx) { continue }
    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { $pIdx }
    $fDate = SafeDate $reader["date"]
    if (-not $fDate) { continue }
    $fType = SafeString $reader["feed"]
    $fQty = $(if ($reader["quantity"] -ne [DBNull]::Value) { SafeDecimal $reader["quantity"] } else { 0.0 })

    $sig = "${pIdx}_${fDate}_${fType}_${fQty}"
    if ($existingFeedKeys.Contains($sig)) { continue }
    $existingFeedKeys.Add($sig) | Out-Null

    $feedObj = [ordered]@{
        pond_index = $pIdx
        pond = $pLabel
        feed_date = $fDate
        feed_type = $fType
        quantity_kg = $fQty
    }
    $idxNo = SafeInt $reader["indexNo"]
    if ($idxNo -ne $null) {
        $feedObj["index_no"] = $idxNo
    }

    $batch += $feedObj
    $newFeedCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "growout_pond_feed_legacy" $batch "pond_index,feed_date,feed_type,quantity_kg"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "growout_pond_feed_legacy" $batch "pond_index,feed_date,feed_type,quantity_kg"
}
Write-Output "  [OK] Preserved $newFeedCount daily feed entries in growout_pond_feed_legacy."

# -------------------------------------------------------------
# STAGE 10: Authoritative SAP Feed Ledger (growout_pond_feed_sap)
# Deterministic sync_key reconciliation
# -------------------------------------------------------------
Write-Output ""
Write-Output "[10/12] Reconciling SAP Feed Ledger (growout_pond_feed_sap)..."
$cmd.CommandText = "SELECT Orderno, SapPondidx, SapPostDate, SapFeedidx, SapFeedName, SapFeedKgs, SapMovement FROM [GrowoutPondFeedSAP] WHERE SapPostDate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY Orderno ASC, SapPostDate ASC, SapPondidx ASC, SapFeedidx ASC, SapMovement ASC, SapFeedKgs ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newSapFeedCount = 0
$prevTuple = ""
$occurrence = 1

while ($reader.Read()) {
    $orderno = SafeString $reader["Orderno"]
    $pIdx = SafeString $reader["SapPondidx"]
    if ($pIdx -and ($pIdx -match '\.([0-9])$')) {
        $pIdx = $pIdx -replace '\.([0-9])$', '.0$1'
    }
    $postDate = SafeDate $reader["SapPostDate"]
    $feedIdx = SafeString $reader["SapFeedidx"]
    $feedName = SafeString $reader["SapFeedName"]
    $feedKgs = SafeDecimal $reader["SapFeedKgs"]
    $movement = SafeDecimal $reader["SapMovement"]

    if (-not $pIdx -or -not $postDate -or -not $feedName) {
        continue
    }

    $pLabel = if ($pIdx.Length -ge 7) {
        "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))"
    } else {
        $pIdx
    }

    $curTuple = "${orderno}_${pIdx}_${postDate}_${feedIdx}_${movement}_${feedKgs}"
    if ($curTuple -eq $prevTuple) {
        $occurrence++
    } else {
        $occurrence = 1
        $prevTuple = $curTuple
    }

    $syncKey = "${curTuple}_${occurrence}"

    $batch += [ordered]@{
        sync_key = $syncKey
        order_no = $orderno
        pond_index = $pIdx
        pond = $pLabel
        sap_post_date = $postDate
        sap_feed_index = $feedIdx
        sap_feed_name = $feedName
        amount_kg = $(if ($feedKgs -ne $null) { $feedKgs } else { 0.0 })
        sap_movement = $movement
    }

    $newSapFeedCount++

    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "growout_pond_feed_sap" $batch "sync_key"
        $batch = @()
    }
}
$reader.Close()

if ($batch.Count -gt 0) {
    Post-BatchToSupabase "growout_pond_feed_sap" $batch "sync_key"
}
Write-Output "  [OK] Synchronized $newSapFeedCount SAP feed records in growout_pond_feed_sap."

# -------------------------------------------------------------
# STAGE 11: Harvest Planning Targets (pond_harvest_plan)
# Deterministic natural sync_key reconciliation (pond_index + plan_date + plan_status)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[11/12] Reconciling Harvest Planning Targets (pond_harvest_plan)..."
$cmd.CommandText = "SELECT PondIndex, planharvstts, planharvdate, planharvabw, planharvwgt, timeHvt, timeDlv, Team FROM [GrowoutPondHarvestPlan] WHERE planharvdate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY PondIndex ASC, planharvdate ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newHarvestPlanCount = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    $planDate = SafeDate $reader["planharvdate"]
    $planStts = SafeString $reader["planharvstts"]
    $planAbw = SafeDecimal $reader["planharvabw"]
    $planWgt = SafeDecimal $reader["planharvwgt"]
    $timeHvt = SafeTime $reader["timeHvt"]
    $timeDlv = SafeTime $reader["timeDlv"]
    $team = SafeString $reader["Team"]

    if (-not $pIdx -or -not $planDate) {
        continue
    }

    $pLabel = if ($pIdx.Length -ge 7) {
        "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))"
    } else {
        $pIdx
    }

    $cleanStatus = if ($planStts) { $planStts } else { "TERMINATION" }
    $syncKey = "${pIdx}_${planDate}_${cleanStatus}"

    $batch += [ordered]@{
        sync_key = $syncKey
        pond_index = $pIdx
        pond = $pLabel
        plan_harv_date = $planDate
        plan_harv_status = $cleanStatus
        plan_harv_abw = $planAbw
        plan_harv_weight = $planWgt
        time_harvest = $timeHvt
        time_delivery = $timeDlv
        team = $team
    }

    $newHarvestPlanCount++

    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "pond_harvest_plan" $batch "sync_key"
        $batch = @()
    }
}
$reader.Close()

if ($batch.Count -gt 0) {
    Post-BatchToSupabase "pond_harvest_plan" $batch "sync_key"
}
Write-Output "  [OK] Synchronized $newHarvestPlanCount harvest planning targets in pond_harvest_plan."

# -------------------------------------------------------------
# STAGE 12: Audited Cycle Financials (growout_pond_finance)
# Natural key: pond_index (1 row per cycle)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[12/12] Reconciling Audited Cycle Financials (growout_pond_finance)..."
$cmd.CommandText = @"
SELECT 
    [Pond No], [Revenue], [Premium], [Small], 
    [Cons Of Fries], [Cons Of Feed], [Cons Of Chem Fert], [Cons Of Supplies], 
    [Wages Benefits (Direct)], [Wages Benefits (Indirect)], [Electricity], 
    [Repair Maintenance], [Consultant], [Rental], [Travel Entertainment], 
    [Training Seminar], [Depreciation Fc], [Harvest Expenses], [Security Charges], 
    [Other UtilitiesIns], [Other Charges], [Total Cost], [Gross Profit], 
    [SAG], [EBIT], [Depreciation with SAG], [EBITDA], [YTD SAG], 
    [YTD SAG Annualised], [Cost per kg], [Cash Cost per kg], 
    [Total Cost per kg with SAG], [Total Cash Cost per kg with SAG], 
    [Depreciation SAG per pond], [YTD SAG Depreciation], 
    [YTD SAG Depreciation Annualised], [Revenue per kg] 
FROM [GrowoutPondFinance] 
WHERE [Pond No] IS NOT NULL
"@

$reader = $cmd.ExecuteReader()
$financeBatch = @()
$newFinanceCount = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["Pond No"]
    if (-not $pIdx) { continue }

    $financeBatch += [ordered]@{
        pond_index = $pIdx
        revenue = SafeDecimal $reader["Revenue"]
        premium_pct = SafeDecimal $reader["Premium"]
        small_pct = SafeDecimal $reader["Small"]
        cons_of_fries = SafeDecimal $reader["Cons Of Fries"]
        cons_of_feed = SafeDecimal $reader["Cons Of Feed"]
        cons_of_chem_fert = SafeDecimal $reader["Cons Of Chem Fert"]
        cons_of_supplies = SafeDecimal $reader["Cons Of Supplies"]
        wages_direct = SafeDecimal $reader["Wages Benefits (Direct)"]
        wages_indirect = SafeDecimal $reader["Wages Benefits (Indirect)"]
        electricity = SafeDecimal $reader["Electricity"]
        repair_maintenance = SafeDecimal $reader["Repair Maintenance"]
        consultant = SafeDecimal $reader["Consultant"]
        rental = SafeDecimal $reader["Rental"]
        travel_entertainment = SafeDecimal $reader["Travel Entertainment"]
        training_seminar = SafeDecimal $reader["Training Seminar"]
        depreciation_fc = SafeDecimal $reader["Depreciation Fc"]
        harvest_expenses = SafeDecimal $reader["Harvest Expenses"]
        security_charges = SafeDecimal $reader["Security Charges"]
        other_utilities_ins = SafeDecimal $reader["Other UtilitiesIns"]
        other_charges = SafeDecimal $reader["Other Charges"]
        total_cost = SafeDecimal $reader["Total Cost"]
        gross_profit = SafeDecimal $reader["Gross Profit"]
        sag = SafeDecimal $reader["SAG"]
        ebit = SafeDecimal $reader["EBIT"]
        depreciation_with_sag = SafeDecimal $reader["Depreciation with SAG"]
        ebitda = SafeDecimal $reader["EBITDA"]
        ytd_sag = SafeDecimal $reader["YTD SAG"]
        ytd_sag_annualised = SafeDecimal $reader["YTD SAG Annualised"]
        cost_per_kg = SafeDecimal $reader["Cost per kg"]
        cash_cost_per_kg = SafeDecimal $reader["Cash Cost per kg"]
        total_cost_per_kg_with_sag = SafeDecimal $reader["Total Cost per kg with SAG"]
        total_cash_cost_per_kg_with_sag = SafeDecimal $reader["Total Cash Cost per kg with SAG"]
        depreciation_sag_per_pond = SafeDecimal $reader["Depreciation SAG per pond"]
        ytd_sag_depreciation = SafeDecimal $reader["YTD SAG Depreciation"]
        ytd_sag_depreciation_annualised = SafeDecimal $reader["YTD SAG Depreciation Annualised"]
        revenue_per_kg = SafeDecimal $reader["Revenue per kg"]
        updated_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")
    }

    $newFinanceCount++

    if ($financeBatch.Count -ge 500) {
        Post-BatchToSupabase "growout_pond_finance" $financeBatch "pond_index"
        $financeBatch = @()
    }
}
$reader.Close()

if ($financeBatch.Count -gt 0) {
    Post-BatchToSupabase "growout_pond_finance" $financeBatch "pond_index"
}
Write-Output "  [OK] Synchronized $newFinanceCount financial ledgers in growout_pond_finance."

$conn.Close()

Write-Output ""
Write-Output "=========================================================="
Write-Output "  WEEKLY SYNC COMPLETED SUCCESSFULLY!"
Write-Output "  Master Cycles Upserted:       $masterCount"
Write-Output "  Active Operational Ponds:     $($accessActiveDict.Count)"
Write-Output "  Stocking Batches Reconciled:  $totalAccessStockingRows"
Write-Output "  Daily Harvest Runs:           $totalAccessHarvestRows"
Write-Output "  Harvest Sales Slips:          $totalAccessSalesRows"
Write-Output "  Pathology Issues:             $totalAccessIssueRows"
Write-Output "  New Pond Notes:               $newNotesCount"
Write-Output "  Biometrics Samplings:         $totalAccessSamplingRows"
Write-Output "  Aerator Configurations:       $aeratorCount"
Write-Output "  Preserved Legacy Feed:        $newFeedCount"
Write-Output "  SAP Feed Records Synced:      $newSapFeedCount"
Write-Output "  Harvest Plans Synced:         $newHarvestPlanCount"
Write-Output "  Financial Ledgers Synced:     $newFinanceCount"
Write-Output "  Finish Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="
