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
Write-Output "  iSHARP ENTERPRISE SMART WEEKLY SYNC (Access -> Supabase)"
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
            Write-Warning "Retry $retryCount for ${endpoint}: $errDetails"
            Start-Sleep -Seconds 2
        }
    }
    throw "Failed to upload batch to ${endpoint} after 3 retries."
}

function Get-SupabaseMaxIndex([string]$tableName) {
    $uri = "$supabaseUrl/rest/v1/" + $tableName + "?select=index_no&order=index_no.desc&limit=1"
    try {
        $res = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
        if ($res.Count -gt 0 -and $res[0].index_no -ne $null) {
            return [int]$res[0].index_no
        }
    } catch {
        Write-Warning ("Could not fetch max index for " + $tableName + ": " + $_.Exception.Message)
    }
    return 0
}

# -------------------------------------------------------------
# STAGE 1: Synchronize Master Cycles (growout_pond_master)
# Upsert active cycles + recently closed/modified cycles + any new cycles
# -------------------------------------------------------------
Write-Output ""
Write-Output "[1/7] Synchronizing Master Culture Cycles (growout_pond_master)..."

# Fetch all existing pond_index in Supabase to guarantee referential integrity
$sbPondIndices = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$offset = 0
$limit = 1000
while ($true) {
    $queryUrl = "$supabaseUrl/rest/v1/growout_pond_master?select=pond_index&limit=" + $limit + "&offset=" + $offset
    $res = Invoke-RestMethod -Uri $queryUrl -Headers $headers -Method Get
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
$masterCount = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx) { continue }

    $rawActive = SafeString $reader["pond active"]
    $rawStatus = SafeString $reader["pond status"]
    $dtClose = SafeDate $reader["date close"]

    # Normalize casing and status to clean architectural standard
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

    # Filter: sync if active, or if not yet in Supabase, or if closed within the last 60 days
    $isNew = -not $sbPondIndices.Contains($pIdx)
    $isActive = ($cleanActive -eq "ACTIVE")
    $isRecentClose = ($dtClose -ne $null -and [datetime]$dtClose -ge (Get-Date).AddDays(-60))

    if (-not ($isNew -or $isActive -or $isRecentClose)) {
        continue
    }

    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { SafeString $reader["pond"] }

    # Refactored GrowoutPondMaster record (schema hardened, spreadsheet columns extracted)
    $obj = [ordered]@{
        pond_index = $pIdx
        pond = $pLabel
        farm = "SETiU"
        modl = SafeString $reader["modl"]
        row_no = SafeString $reader["row"]
        crop_no = SafeString $reader["cropno"]
        cycle_no = SafeString $reader["cycleno"]
        pond_status = $cleanStatus
        pond_active = $cleanActive
        area = $(if ($reader["area"] -ne [DBNull]::Value) { SafeDecimal $reader["area"] } else { 0.50 })
        pond_type = $(if ($reader["pond type"] -ne [DBNull]::Value) { SafeString $reader["pond type"] } else { "FULL LiNiNG" })
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

    # Collect lifecycle event dates for pond_event_date table
    $dateMap = @{
        "disease"    = SafeDate $reader["date disease"]
        "close"      = $dtClose
        "cycle"      = SafeDate $reader["date cycle"]
        "cleaning"   = SafeDate $reader["date cleaning"]
        "repair"     = SafeDate $reader["DateRepair"]
        "filling"    = SafeDate $reader["date filling"]
        "culture"    = SafeDate $reader["date culture"]
        "baby_box"   = SafeDate $reader["DateBabyBox"]
        "qaqc"       = SafeDate $reader["DateQaqc"]
        "ready"      = SafeDate $reader["date ready"]
        "plan_stock" = SafeDate $reader["DatePlanStock"]
    }
    foreach ($evt in $dateMap.Keys) {
        $dVal = $dateMap[$evt]
        if ($dVal) {
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

if ($dateBatch.Count -gt 0) {
    # Chunk dates to avoid payload size limits
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
Write-Output "[2/7] Synchronizing Active Gatekeeper (active_operational_ponds)..."
$cmd.CommandText = "SELECT PondIndex, pond FROM [GrowoutPondMaster] WHERE [pond status] = 'PRODUCTION' AND ([pond active] = 'ACTiVE' OR [pond active] = 'ACTIVE')"
$reader = $cmd.ExecuteReader()
$accessActiveDict = @{}
while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { SafeString $reader["pond"] }
    $accessActiveDict[$pLabel] = $pIdx
}
$reader.Close()

$sbActive = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/active_operational_ponds?select=pond,pond_index" -Headers $headers -Method Get
$sbActiveDict = @{}
foreach ($item in $sbActive) {
    $sbActiveDict[$item.pond] = $item.pond_index
}

# Determine removals (ponds no longer in production)
$removedCount = 0
foreach ($p in $sbActiveDict.Keys) {
    if (-not $accessActiveDict.ContainsKey($p)) {
        try {
            $delUrl = "$supabaseUrl/rest/v1/active_operational_ponds?pond=eq." + $p
            $null = Invoke-RestMethod -Uri $delUrl -Headers $headers -Method Delete
            $removedCount++
        } catch {
            Write-Warning ("Could not remove pond " + $p + " from gatekeeper: " + $_.Exception.Message)
        }
    }
}

# Determine adds/updates (ponds currently in production)
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
# STAGE 3: Incremental GrowoutPondStocking -> pond_stocking_batches
# Protected against Access indexNo re-sequencing via composite key deduplication
# -------------------------------------------------------------
Write-Output ""
Write-Output "[3/7] Incremental Sync: GrowoutPondStocking -> pond_stocking_batches (with deduplication shield)..."
$maxStocking = Get-SupabaseMaxIndex "pond_stocking_batches"

# Pre-load existing stocking signatures from Supabase (past 180 days)
$existingStockingKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$stockingCutoff = (Get-Date).AddDays(-180).ToString("yyyy-MM-dd")
$stockingSigUrl = "$supabaseUrl/rest/v1/pond_stocking_batches?select=pond_index,stck_date,stck_pcs&stck_date=gte.$stockingCutoff&limit=5000"
try {
    $existingStockingRes = Invoke-RestMethod -Uri $stockingSigUrl -Headers $headers -Method Get
    foreach ($row in $existingStockingRes) {
        $pcs = [math]::Round([decimal]$row.stck_pcs, 0)
        $existingStockingKeys.Add("$($row.pond_index)_$($row.stck_date)_$pcs") | Out-Null
    }
    Write-Output "  -> Loaded $($existingStockingKeys.Count) recent stocking signatures from Supabase."
} catch {
    Write-Warning "Could not pre-load stocking signatures: $($_.Exception.Message)"
}

$cmd.CommandText = "SELECT PondIndex, stckdate, stcksource, stckspcs, stckpcs, stcktype, stckallow, stcktotal, stcktank, stcksize, stckplstts, BSLine, indexNo FROM [GrowoutPondStocking] WHERE stckdate >= DateAdd('d', -180, Date()) OR indexNo > $maxStocking ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newStockingCount = 0
$skippedStockingDupes = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $stckDate = SafeDate $reader["stckdate"]
    $stckPcs = SafeDecimal $reader["stckpcs"]
    $pcsRound = if ($stckPcs -ne $null) { [math]::Round($stckPcs, 0) } else { 0 }
    $sig = "${pIdx}_${stckDate}_${pcsRound}"

    if ($existingStockingKeys.Contains($sig)) {
        $skippedStockingDupes++
        continue
    }
    $existingStockingKeys.Add($sig) | Out-Null

    $stckSource = SafeString $reader["stcksource"]
    $stckSpecies = $(if ($reader["stckspcs"] -ne [DBNull]::Value) { SafeString $reader["stckspcs"] } else { "P. VANNAMEi" })
    $stckType = $(if ($reader["stcktype"] -ne [DBNull]::Value) { SafeString $reader["stcktype"] } else { "SPT" })
    $stckAllow = SafeDecimal $reader["stckallow"]
    $stckTotal = SafeDecimal $reader["stcktotal"]
    $stckTank = SafeString $reader["stcktank"]
    $stckSize = SafeDecimal $reader["stcksize"]
    $stckPlstts = $(if ($reader["stckplstts"] -ne [DBNull]::Value) { SafeString $reader["stckplstts"] } else { "1. NPL" })
    $bsLine = SafeString $reader["BSLine"]

    $batch += [ordered]@{
        pond_index = $pIdx
        index_no = SafeInt $reader["indexNo"]
        stck_date = $stckDate
        stck_source = $stckSource
        stck_species = $stckSpecies
        stck_pcs = $stckPcs
        stck_type = $stckType
        stck_allow = $stckAllow
        stck_total = $stckTotal
        stck_tank = $stckTank
        stck_size = $stckSize
        stck_plstts = $stckPlstts
        bs_line = $bsLine
    }

    $newStockingCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "pond_stocking_batches" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "pond_stocking_batches" $batch "index_no"
}
Write-Output "  [OK] Added $newStockingCount new stocking batches to pond_stocking_batches ($skippedStockingDupes existing/re-numbered entries prevented from duplicating)."


# -------------------------------------------------------------
# STAGE 4: Incremental GrowoutPondHarvestDaily -> pond_harvest_daily
# Protected against Access indexNo re-sequencing via composite key deduplication
# -------------------------------------------------------------
Write-Output ""
Write-Output "[4/7] Incremental Sync: GrowoutPondHarvestDaily (with deduplication shield)..."
$maxHarvestDaily = Get-SupabaseMaxIndex "pond_harvest_daily"

# Pre-load existing harvest signatures from Supabase (past 180 days) to guard against Access AutoNumber jumps
$existingHarvestKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$harvestCutoff = (Get-Date).AddDays(-180).ToString("yyyy-MM-dd")
$harvestSigUrl = "$supabaseUrl/rest/v1/pond_harvest_daily?select=pond_index,harv_date,harv_status,harv_weight&harv_date=gte.$harvestCutoff&limit=5000"
try {
    $existingHarvestRes = Invoke-RestMethod -Uri $harvestSigUrl -Headers $headers -Method Get
    foreach ($row in $existingHarvestRes) {
        $wt = "{0:F2}" -f [double]$row.harv_weight
        $existingHarvestKeys.Add("$($row.pond_index)_$($row.harv_date)_$($row.harv_status)_$wt") | Out-Null
    }
    Write-Output "  -> Loaded $($existingHarvestKeys.Count) recent harvest signatures from Supabase."
} catch {
    Write-Warning "Could not pre-load harvest signatures: $($_.Exception.Message)"
}

$cmd.CommandText = "SELECT PondIndex, harvdate, harvstts, harvwgt, harvabw, harvRev, harvmtd, indexNo FROM [GrowoutPondHarvestDaily] WHERE harvdate >= DateAdd('d', -180, Date()) OR indexNo > $maxHarvestDaily ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newHarvestDailyCount = 0
$skippedHarvestDupes = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $hDate = $(if ($reader["harvdate"] -ne [DBNull]::Value) { SafeDate $reader["harvdate"] } else { "2026-01-01" })
    $hStts = $(if ($reader["harvstts"] -ne [DBNull]::Value) { SafeString $reader["harvstts"] } else { "TERMINATION" })
    $hWgt = $(if ($reader["harvwgt"] -ne [DBNull]::Value) { SafeDecimal $reader["harvwgt"] } else { 0.0 })
    $wtFormatted = "{0:F2}" -f [double]$hWgt
    $sig = "${pIdx}_${hDate}_${hStts}_${wtFormatted}"

    if ($existingHarvestKeys.Contains($sig)) {
        $skippedHarvestDupes++
        continue
    }
    $existingHarvestKeys.Add($sig) | Out-Null

    $batch += [ordered]@{
        pond_index = $pIdx
        index_no = SafeInt $reader["indexNo"]
        harv_date = $hDate
        harv_status = $hStts
        harv_weight = $hWgt
        harv_abw = $(if ($reader["harvabw"] -ne [DBNull]::Value) { SafeDecimal $reader["harvabw"] } else { 0.0 })
        harv_revenue = $(if ($reader["harvRev"] -ne [DBNull]::Value) { SafeDecimal $reader["harvRev"] } else { 0.0 })
        harv_method = $(if ($reader["harvmtd"] -ne [DBNull]::Value) { SafeString $reader["harvmtd"] } else { "M" })
    }
    $newHarvestDailyCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "pond_harvest_daily" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "pond_harvest_daily" $batch "index_no"
}
Write-Output "  [OK] Added $newHarvestDailyCount new harvest daily logs ($skippedHarvestDupes existing/re-numbered entries prevented from duplicating)."

# -------------------------------------------------------------
# STAGE 5: Incremental GrowoutPondHarvestSales -> pond_harvest_sales
# Protected against Access indexNo re-sequencing via composite key deduplication
# -------------------------------------------------------------
Write-Output ""
Write-Output "[5/7] Incremental Sync: GrowoutPondHarvestSales (with deduplication shield)..."
$maxHarvestSales = Get-SupabaseMaxIndex "pond_harvest_sales"

# Pre-load existing sales signatures from Supabase (past 90 days)
$existingSalesKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$salesCutoff = (Get-Date).AddDays(-90).ToString("yyyy-MM-dd")
$salesSigUrl = "$supabaseUrl/rest/v1/pond_harvest_sales?select=pond_index,hvt_date,hvt_buyer,raw_wgt&hvt_date=gte.$salesCutoff&limit=5000"
try {
    $existingSalesRes = Invoke-RestMethod -Uri $salesSigUrl -Headers $headers -Method Get
    foreach ($row in $existingSalesRes) {
        $rw = "{0:F2}" -f [double]$row.raw_wgt
        $existingSalesKeys.Add("$($row.pond_index)_$($row.hvt_date)_$($row.hvt_buyer)_$rw") | Out-Null
    }
    Write-Output "  -> Loaded $($existingSalesKeys.Count) recent sales signatures from Supabase."
} catch {
    Write-Warning "Could not pre-load sales signatures: $($_.Exception.Message)"
}

$cmd.CommandText = "SELECT indexNo, HvtPondIndx, HvtDate, HvtABW, GoodWGT, GoodPRC, [2ndGradeWGT], [2ndGradePRC], SmallWGT, BelowWGT, RubbishwGT, RawWGT, HvtSLS, HvtBuyer FROM [GrowoutPondHarvestSales] WHERE HvtDate >= DateAdd('d', -90, Date()) OR indexNo > $maxHarvestSales ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newHarvestSalesCount = 0
$skippedSalesDupes = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["HvtPondIndx"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $hvtDate = SafeDate $reader["HvtDate"]
    $hvtBuyer = SafeString $reader["HvtBuyer"]
    $rawWgt = SafeDecimal $reader["RawWGT"]
    $rwFormatted = if ($rawWgt -ne $null) { "{0:F2}" -f [double]$rawWgt } else { "0.00" }
    $sig = "${pIdx}_${hvtDate}_${hvtBuyer}_${rwFormatted}"

    if ($existingSalesKeys.Contains($sig)) {
        $skippedSalesDupes++
        continue
    }
    $existingSalesKeys.Add($sig) | Out-Null

    $batch += [ordered]@{
        pond_index = $pIdx
        index_no = SafeInt $reader["indexNo"]
        hvt_date = $hvtDate
        hvt_buyer = $hvtBuyer
        hvt_abw = SafeDecimal $reader["HvtABW"]
        good_wgt = SafeDecimal $reader["GoodWGT"]
        good_prc = SafeDecimal $reader["GoodPRC"]
        second_grade_wgt = SafeDecimal $reader["2ndGradeWGT"]
        second_grade_prc = SafeDecimal $reader["2ndGradePRC"]
        small_wgt = SafeDecimal $reader["SmallWGT"]
        below_wgt = SafeDecimal $reader["BelowWGT"]
        rubbish_wgt = SafeDecimal $reader["RubbishwGT"]
        raw_wgt = $rawWgt
        net_sales = SafeDecimal $reader["HvtSLS"]
    }
    $newHarvestSalesCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "pond_harvest_sales" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "pond_harvest_sales" $batch "index_no"
}
Write-Output "  [OK] Added $newHarvestSalesCount new harvest sales logs ($skippedSalesDupes existing/re-numbered entries prevented from duplicating)."

# -------------------------------------------------------------
# STAGE 6: Incremental GrowoutPondIssues -> pond_issues & Notes
# Protected against Access indexNo re-sequencing via composite key deduplication
# -------------------------------------------------------------
Write-Output ""
Write-Output "[6/7] Incremental Sync: GrowoutPondIssues and Notes (with deduplication shield)..."
$maxIssues = Get-SupabaseMaxIndex "pond_issues"

# Pre-load existing issue signatures from Supabase (past 90 days)
$existingIssueKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$issueCutoff = (Get-Date).AddDays(-90).ToString("yyyy-MM-dd")
$issueSigUrl = "$supabaseUrl/rest/v1/pond_issues?select=pond_index,issue_date,issue_category,issue_status,issue_flag&issue_date=gte.$issueCutoff&limit=5000"
try {
    $existingIssueRes = Invoke-RestMethod -Uri $issueSigUrl -Headers $headers -Method Get
    foreach ($row in $existingIssueRes) {
        $existingIssueKeys.Add("$($row.pond_index)_$($row.issue_date)_$($row.issue_category)_$($row.issue_status)_$($row.issue_flag)") | Out-Null
    }
    Write-Output "  -> Loaded $($existingIssueKeys.Count) recent pathology signatures from Supabase."
} catch {
    Write-Warning "Could not pre-load issue signatures: $($_.Exception.Message)"
}

$cmd.CommandText = "SELECT PondIndex, issuedate, issueCat, issuestts, issuetest, issueflag, issueGrade, issueNote, indexNo FROM [GrowoutPondIssues] WHERE issuedate >= DateAdd('d', -90, Date()) OR indexNo > $maxIssues ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newIssuesCount = 0
$skippedIssueDupes = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $iDate = $(if ($reader["issuedate"] -ne [DBNull]::Value) { SafeDate $reader["issuedate"] } else { "2026-01-01" })
    $iCat = $(if ($reader["issueCat"] -ne [DBNull]::Value) { SafeString $reader["issueCat"] } else { "DISEASE" })
    $iStts = $(if ($reader["issuestts"] -ne [DBNull]::Value) { SafeString $reader["issuestts"] } else { "EHP" })
    $iFlag = $(if ($reader["issueflag"] -ne [DBNull]::Value) { SafeString $reader["issueflag"] } else { "GREEN" })
    $sig = "${pIdx}_${iDate}_${iCat}_${iStts}_${iFlag}"

    if ($existingIssueKeys.Contains($sig)) {
        $skippedIssueDupes++
        continue
    }
    $existingIssueKeys.Add($sig) | Out-Null

    $batch += [ordered]@{
        pond_index = $pIdx
        index_no = SafeInt $reader["indexNo"]
        issue_date = $iDate
        issue_category = $iCat
        issue_status = $iStts
        issue_test = $(if ($reader["issuetest"] -ne [DBNull]::Value) { SafeString $reader["issuetest"] } else { "MICROSCOPY" })
        issue_flag = $iFlag
        issue_grade = $(if ($reader["issueGrade"] -ne [DBNull]::Value) { SafeString $reader["issueGrade"] } else { "G0" })
        issue_note = $(if ($reader["issueNote"] -ne [DBNull]::Value) { SafeString $reader["issueNote"] } else { "NEGATIVE" })
    }
    $newIssuesCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "pond_issues" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "pond_issues" $batch "index_no"
}
Write-Output "  [OK] Added $newIssuesCount new pathology issues ($skippedIssueDupes existing/re-numbered entries prevented from duplicating)."

# Check notes
$maxNotes = Get-SupabaseMaxIndex "pond_notes"
$cmd.CommandText = "SELECT PondIndex, Remark, indexNo FROM [GrowoutPondNote] WHERE indexNo > $maxNotes AND Remark IS NOT NULL ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newNotesCount = 0
while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    $rem = SafeString $reader["Remark"]
    if (-not $pIdx -or -not $rem -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $batch += [ordered]@{
        pond_index = $pIdx
        index_no = SafeInt $reader["indexNo"]
        note = $rem
        logged_by = "ACCESS_WEEKLY_SYNC"
    }
    $newNotesCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "pond_notes" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "pond_notes" $batch "index_no"
}
Write-Output "  [OK] Added $newNotesCount new pond notes (Max ID was $maxNotes)."

# -------------------------------------------------------------
# STAGE 7: Incremental GrowoutPondSampling -> biometrics_sampling
# Protected against Access indexNo re-sequencing via composite key deduplication
# -------------------------------------------------------------
Write-Output ""
Write-Output "[7/7] Incremental Sync: GrowoutPondSampling (Biometrics, with deduplication shield)..."
$maxSampling = Get-SupabaseMaxIndex "biometrics_sampling"

# Pre-load existing sampling signatures from Supabase (past 90 days)
$existingSamplingKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$samplingCutoff = (Get-Date).AddDays(-90).ToString("yyyy-MM-dd")
$samplingSigUrl = "$supabaseUrl/rest/v1/biometrics_sampling?select=pond_index,smpl_date,smpl_doc&smpl_date=gte.$samplingCutoff&limit=5000"
try {
    $existingSamplingRes = Invoke-RestMethod -Uri $samplingSigUrl -Headers $headers -Method Get
    foreach ($row in $existingSamplingRes) {
        $existingSamplingKeys.Add("$($row.pond_index)_$($row.smpl_date)_$($row.smpl_doc)") | Out-Null
    }
    Write-Output "  -> Loaded $($existingSamplingKeys.Count) recent sampling signatures from Supabase."
} catch {
    Write-Warning "Could not pre-load sampling signatures: $($_.Exception.Message)"
}

$cmd.CommandText = "SELECT PondIndex, smpldate, SmplDoc, smplabw, smplsurv, SmplDFed, SmplTFed, Psmpldate, PSmplDoc, Psmplabw, Psmplsurv, PSmplDFed, PSmplTFed, sttgabw, sttgsurv, sttgbms, sttgDFed, sttgTFed, smplbms, indexNo FROM [GrowoutPondSampling] WHERE smpldate >= DateAdd('d', -90, Date()) OR indexNo > $maxSampling ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newSamplingCount = 0
$skippedSamplingDupes = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }

    $sDate = $(if ($reader["smpldate"] -ne [DBNull]::Value) { SafeDate $reader["smpldate"] } else { "2026-01-01" })
    $sDoc = $(if ($reader["SmplDoc"] -ne [DBNull]::Value) { SafeInt $reader["SmplDoc"] } else { 0 })
    $sig = "${pIdx}_${sDate}_${sDoc}"

    if ($existingSamplingKeys.Contains($sig)) {
        $skippedSamplingDupes++
        continue
    }
    $existingSamplingKeys.Add($sig) | Out-Null

    $batch += [ordered]@{
        pond_index = $pIdx
        index_no = SafeInt $reader["indexNo"]
        smpl_date = $sDate
        smpl_doc = $sDoc
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
    $newSamplingCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "biometrics_sampling" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "biometrics_sampling" $batch "index_no"
}
Write-Output "  [OK] Added $newSamplingCount new biometrics samplings ($skippedSamplingDupes existing/re-numbered entries prevented from duplicating)."

# -------------------------------------------------------------
# STAGE 8: Synchronize Paddlewheel Aerator Inventory (pond_aerator_inventory)
# Source: [MNA-PWA Status]
# -------------------------------------------------------------
Write-Output ""
Write-Output "[8/10] Synchronizing Paddlewheel Aerator Inventory (pond_aerator_inventory)..."
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
# STAGE 9: Incremental Legacy Feed Preservation -> growout_pond_feed_legacy
# -------------------------------------------------------------
Write-Output ""
Write-Output "[9/10] Incremental Sync: GrowoutPondFeed -> growout_pond_feed_legacy..."
$maxFeed = Get-SupabaseMaxIndex "growout_pond_feed_legacy"
$cmd.CommandText = "SELECT indexNo, PondIndex, [date], feed, quantity FROM [GrowoutPondFeed] WHERE indexNo > $maxFeed ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newFeedCount = 0
while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx) { continue }
    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { $pIdx }

    $batch += [ordered]@{
        index_no = SafeInt $reader["indexNo"]
        pond_index = $pIdx
        pond = $pLabel
        feed_date = SafeDate $reader["date"]
        feed_type = SafeString $reader["feed"]
        quantity_kg = $(if ($reader["quantity"] -ne [DBNull]::Value) { SafeDecimal $reader["quantity"] } else { 0.0 })
    }
    $newFeedCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "growout_pond_feed_legacy" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "growout_pond_feed_legacy" $batch "index_no"
}
Write-Output "  [OK] Preserved $newFeedCount daily feed entries in growout_pond_feed_legacy (Max ID was $maxFeed)."

# -------------------------------------------------------------
# STAGE 10: Incremental Final Cycle Audits -> growout_pond_final_legacy
# -------------------------------------------------------------
Write-Output ""
Write-Output "[10/10] Incremental Sync: GrowoutPondFinal -> growout_pond_final_legacy..."
$maxFinal = Get-SupabaseMaxIndex "growout_pond_final_legacy"
$cmd.CommandText = "SELECT indexNo, PondIndex, farm, module, row, pond, [crop no], [cycle no], [pond status], [pond active], area, [date cycle], [date close], [final date], [final status], [final doc], [final abw], [final kg], [final pieces], [final adg], [final awg], [final fcr], [final sr], [total feed], [total harvest no], [harvest method], [feed brand], BSLine, [stock date], [stock total fry], [stock density] FROM [GrowoutPondFinal] WHERE indexNo > $maxFinal ORDER BY indexNo ASC"
$reader = $cmd.ExecuteReader()
$batch = @()
$newFinalCount = 0
while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx) { continue }
    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { SafeString $reader["pond"] }

    $batch += [ordered]@{
        index_no = SafeInt $reader["indexNo"]
        pond_index = $pIdx
        pond = $pLabel
        modl = SafeString $reader["module"]
        row_no = SafeString $reader["row"]
        crop_no = SafeString $reader["crop no"]
        cycle_no = SafeString $reader["cycle no"]
        pond_status = SafeString $reader["pond status"]
        pond_active = SafeString $reader["pond active"]
        area = SafeDecimal $reader["area"]
        date_cycle = SafeDate $reader["date cycle"]
        date_close = SafeDate $reader["date close"]
        final_date = SafeDate $reader["final date"]
        final_status = SafeString $reader["final status"]
        final_doc = SafeInt $reader["final doc"]
        final_abw = SafeDecimal $reader["final abw"]
        final_kg = SafeDecimal $reader["final kg"]
        final_pieces = SafeDecimal $reader["final pieces"]
        final_adg = SafeDecimal $reader["final adg"]
        final_awg = SafeDecimal $reader["final awg"]
        final_fcr = SafeDecimal $reader["final fcr"]
        final_sr = SafeDecimal $reader["final sr"]
        total_feed = SafeDecimal $reader["total feed"]
        total_harvest_no = SafeInt $reader["total harvest no"]
        harvest_method = SafeString $reader["harvest method"]
        feed_brand = SafeString $reader["feed brand"]
        bs_line = SafeString $reader["BSLine"]
        stock_date = SafeDate $reader["stock date"]
        stock_total_fry = SafeDecimal $reader["stock total fry"]
        stock_density = SafeDecimal $reader["stock density"]
    }
    $newFinalCount++
    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "growout_pond_final_legacy" $batch "index_no"
        $batch = @()
    }
}
$reader.Close()
if ($batch.Count -gt 0) {
    Post-BatchToSupabase "growout_pond_final_legacy" $batch "index_no"
}
    Write-Output "  [OK] Preserved $newFinalCount finalized cycle audits in growout_pond_final_legacy (Max ID was $maxFinal)."

    # -------------------------------------------------------------
    # STAGE 11: Incremental Sync: GrowoutPondFeedSAP -> growout_pond_feed_sap
    # Authoritative SAP Feed Ledger by SAPFeedName, SapPostDate & amount
    # -------------------------------------------------------------
    Write-Output ""
    Write-Output "[11/11] Incremental Sync: GrowoutPondFeedSAP -> growout_pond_feed_sap..."
    $cmd.CommandText = "SELECT Orderno, SapPondidx, SapPostDate, SapFeedidx, SapFeedName, SapFeedKgs, SapMovement FROM [GrowoutPondFeedSAP] WHERE SapPostDate >= DateAdd('d', -180, Date()) ORDER BY Orderno ASC, SapPostDate ASC, SapPondidx ASC, SapFeedidx ASC, SapMovement ASC, SapFeedKgs ASC"
    $reader = $cmd.ExecuteReader()
    $batch = @()
    $newSapFeedCount = 0
    $prevTuple = ""
    $occurrence = 1

    while ($reader.Read()) {
        $orderno = SafeString $reader["Orderno"]
        $pIdx = SafeString $reader["SapPondidx"]
        # Ensure single-digit cycles (.1 -> .9) are normalized to standard 2-digit format (.01 -> .09)
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
    # STAGE 12: Incremental Sync: GrowoutPondHarvestPlan -> pond_harvest_plan
    # Harvest planning targets, expected biomass, and planned ABW
    # -------------------------------------------------------------
    Write-Output ""
    Write-Output "[12/12] Incremental Sync: GrowoutPondHarvestPlan -> pond_harvest_plan..."
    $cmd.CommandText = "SELECT PondIndex, planharvstts, planharvdate, planharvabw, planharvwgt, timeHvt, timeDlv, Team, indexNo FROM [GrowoutPondHarvestPlan] WHERE planharvdate >= DateAdd('d', -180, Date()) ORDER BY indexNo ASC"
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

    $conn.Close()

    Write-Output ""
    Write-Output "=========================================================="
    Write-Output "  WEEKLY SYNC COMPLETED SUCCESSFULLY!"
    Write-Output "  Master Cycles Upserted:       $masterCount"
    Write-Output "  Active Operational Ponds:     $($accessActiveDict.Count)"
    Write-Output "  New Stocking Batches:         $newStockingCount"
    Write-Output "  New Daily Harvest Runs:       $newHarvestDailyCount"
    Write-Output "  New Harvest Sales Records:    $newHarvestSalesCount"
    Write-Output "  New Pathology Issues:         $newIssuesCount"
    Write-Output "  New Pond Notes:               $newNotesCount"
    Write-Output "  New Biometrics Samplings:     $newSamplingCount"
    Write-Output "  Aerator Cycles Synced:        $aeratorCount"
    Write-Output "  Daily Feed Records Synced:    $newFeedCount"
    Write-Output "  Final Cycle Audits Synced:    $newFinalCount"
    Write-Output "  SAP Feed Records Synced:      $newSapFeedCount"
    Write-Output "  Harvest Plans Synced:         $newHarvestPlanCount"
    Write-Output "  Finish Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Output "=========================================================="
