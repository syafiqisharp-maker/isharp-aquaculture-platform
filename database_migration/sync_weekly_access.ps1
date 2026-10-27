param(
    [string]$dbPath = "",
    [int]$reconcileDays = 180,
    [switch]$forceFull
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$legacyDbDir = "D:\DB"
$supabaseUrl = "https://keappoukeagyzpoxkrru.supabase.co"
$supabaseKey = if ($env:SUPABASE_SERVICE_ROLE_KEY) { $env:SUPABASE_SERVICE_ROLE_KEY } else { "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s" }
$editorPasscode = if ($env:ISHARP_EDITOR_PASSCODE) { $env:ISHARP_EDITOR_PASSCODE } else { "mantaray" }

$reconcileCutoff = (Get-Date).AddDays(-$reconcileDays).ToString("yyyy-MM-dd")
$checkpointPath = Join-Path $PSScriptRoot "sync_checkpoint.json"

$headers = @{
    "apikey"            = $supabaseKey
    "Authorization"     = "Bearer $supabaseKey"
    "Content-Type"      = "application/json; charset=utf-8"
    "Prefer"            = "resolution=merge-duplicates"
    "x-isharp-passcode" = $editorPasscode
}

Write-Output "=========================================================="
Write-Output "  iSHARP ENTERPRISE SMART WEEKLY SYNC (Access -> Supabase)"
Write-Output "  Architecture: Atomic Cycle-Reconciliation & Natural Keys"
Write-Output "  Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="

# -------------------------------------------------------------
# 0. Locate Latest Setiu Access Database
# -------------------------------------------------------------
if (-not $dbPath -or -not (Test-Path $dbPath)) {
    $searchDirs = @(
        $legacyDbDir,
        "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Legacy Access DB",
        "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Legacy Access DB"
    )
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

$dbItem = Get-Item $dbPath
$dbSignature = "$($dbItem.FullName)|$($dbItem.Length)|$($dbItem.LastWriteTimeUtc.ToString('o'))"

Write-Output "Using Source DB: $dbPath"
Write-Output "File Size: $([math]::Round($dbItem.Length / 1MB, 2)) MB"
$lockFile = [System.IO.Path]::ChangeExtension($dbPath, ".laccdb")
if (Test-Path $lockFile) {
    Write-Output "  [NOTICE] An active lock file ($([System.IO.Path]::GetFileName($lockFile))) was detected."
    Write-Output "           Microsoft Access may be open. Reading in shared mode..."
}
Write-Output "Target Cloud: $supabaseUrl"
Write-Output "Active Reconcile Cutoff: $reconcileCutoff ($reconcileDays days)"
Write-Output ""

# -------------------------------------------------------------
# Data Conversion & Normalization Helpers
# -------------------------------------------------------------
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

function NormalizeNoteKey([string]$pIdx, [string]$noteText) {
    if (-not $noteText) { return "${pIdx}_" }
    $clean = ($noteText.Trim() -replace "\r\n", "`n" -replace "\r", "`n")
    return "${pIdx}_${clean}"
}

function FormatNumKey($val) {
    if ($val -eq $null -or $val -eq [DBNull]::Value) { return "0.00" }
    try {
        return ([decimal]$val).ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture)
    } catch {
        return "0.00"
    }
}

# -------------------------------------------------------------
# Checkpoint State Manager (Survives Network Drops & Power Loss)
# -------------------------------------------------------------
$script:checkpoint = @{
    dbSignature     = $dbSignature
    startedAt       = (Get-Date).ToString("o")
    reconcileDays   = $reconcileDays
    completedStages = @()
    completedPonds  = @{
        stage3 = @()
        stage4 = @()
        stage5 = @()
        stage6 = @()
        stage7 = @()
    }
}

if (-not $forceFull -and (Test-Path $checkpointPath)) {
    try {
        $loaded = Get-Content $checkpointPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $ageHours = ((Get-Date) - [datetime]$loaded.startedAt).TotalHours
        if ($loaded.dbSignature -eq $dbSignature -and $loaded.reconcileDays -eq $reconcileDays -and $ageHours -lt 24) {
            $script:checkpoint.startedAt = $loaded.startedAt
            $script:checkpoint.completedStages = @($loaded.completedStages)
            foreach ($sKey in @("stage3", "stage4", "stage5", "stage6", "stage7")) {
                if ($loaded.completedPonds -and $loaded.completedPonds.$sKey) {
                    $script:checkpoint.completedPonds[$sKey] = @($loaded.completedPonds.$sKey)
                }
            }
            Write-Output "[RESUME] Found active checkpoint from $($loaded.startedAt) ($([math]::Round($ageHours, 1))h ago)."
            Write-Output "         Completed stages so far: $(if ($script:checkpoint.completedStages.Count -gt 0) { $script:checkpoint.completedStages -join ', ' } else { 'none' })"
        } else {
            Write-Output "[CHECKPOINT] Existing checkpoint is from a previous DB snapshot or >24h old. Starting fresh run."
        }
    } catch {
        Write-Warning "Could not parse existing checkpoint file; starting fresh run."
    }
}

function Save-Checkpoint() {
    try {
        $json = $script:checkpoint | ConvertTo-Json -Depth 6 -Compress
        [System.IO.File]::WriteAllText($checkpointPath, $json, [System.Text.Encoding]::UTF8)
    } catch {
        Write-Warning "Could not save checkpoint file: $($_.Exception.Message)"
    }
}

function Test-StageDone([int]$stageNo) {
    return ($script:checkpoint.completedStages -contains $stageNo)
}

function Complete-Stage([int]$stageNo) {
    if (-not ($script:checkpoint.completedStages -contains $stageNo)) {
        $script:checkpoint.completedStages += $stageNo
        Save-Checkpoint
    }
}

# -------------------------------------------------------------
# Network-Resilient HTTP Layer (Exponential Backoff up to ~13m)
# -------------------------------------------------------------
$script:backoffScheduleSec = @(2, 4, 8, 15, 30, 60, 90, 120, 180, 240)

function Get-HttpErrorDetails($errRecord) {
    $msg = $errRecord.Exception.Message
    if ($errRecord.ErrorDetails -and $errRecord.ErrorDetails.Message) {
        return $errRecord.ErrorDetails.Message
    }
    if ($errRecord.Exception.Response) {
        try {
            $stream = $errRecord.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                if ($body) { return $body }
            }
        } catch {}
    }
    return $msg
}

function Invoke-SupabaseRequest(
    [string]$Uri,
    [string]$Method = "Get",
    [hashtable]$RequestHeaders = $null,
    [byte[]]$BodyBytes = $null,
    [int]$TimeoutSec = 60,
    [int]$MaxAttempts = 10
) {
    if (-not $RequestHeaders) { $RequestHeaders = $headers }
    $attempt = 0
    while ($attempt -lt $MaxAttempts) {
        try {
            $params = @{
                Uri        = $Uri
                Method     = $Method
                Headers    = $RequestHeaders
                TimeoutSec = $TimeoutSec
            }
            if ($BodyBytes -ne $null) {
                $params["Body"] = $BodyBytes
            }
            return (Invoke-RestMethod @params)
        } catch {
            $attempt++
            $errDetails = Get-HttpErrorDetails $_
            $statusCode = 0
            if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }

            # Do not retry permanent schema/constraint/auth errors (400/401/403/404/422) except 408/429
            $isPermanentClientError = ($statusCode -in @(400, 401, 403, 404, 422)) -and ($errDetails -notmatch "57014")
            if ($isPermanentClientError -or $attempt -ge $MaxAttempts) {
                throw "Supabase $Method failed ($statusCode) on ${Uri}: $errDetails"
            }

            $waitSec = $script:backoffScheduleSec[[Math]::Min($attempt - 1, $script:backoffScheduleSec.Count - 1)]
            Write-Warning "[Network/DB Retry $attempt/$MaxAttempts] $Method failed ($errDetails). Waiting ${waitSec}s before retry..."
            Start-Sleep -Seconds $waitSec
        }
    }
}

# Resilient Supabase REST GET Helper (Single Request)
function Get-FromSupabase([string]$uri) {
    $getHeaders = @{
        "apikey"            = $supabaseKey
        "Authorization"     = "Bearer $supabaseKey"
        "x-isharp-passcode" = $editorPasscode
    }
    return (Invoke-SupabaseRequest -Uri $uri -Method "Get" -RequestHeaders $getHeaders -TimeoutSec 45)
}

# Paginated GET Helper (Fetches ALL rows across 1000-row PostgREST pages)
function Get-AllFromSupabase([string]$baseUri, [int]$pageSize = 1000) {
    $allRows = New-Object System.Collections.Generic.List[object]
    $offset = 0
    $sep = if ($baseUri.Contains("?")) { "&" } else { "?" }
    while ($true) {
        $pagedUri = "${baseUri}${sep}limit=${pageSize}&offset=${offset}"
        $page = @(Get-FromSupabase $pagedUri)
        if ($page.Count -eq 0) { break }
        foreach ($item in $page) {
            $allRows.Add($item)
        }
        $offset += $pageSize
        if ($page.Count -lt $pageSize) { break }
    }
    return ,$allRows.ToArray()
}

# -------------------------------------------------------------
# Pre-Flight Connectivity, Security & RPC Capability Check
# -------------------------------------------------------------
Write-Output "[PRE-FLIGHT] Verifying Supabase connectivity & DBMS Editor authorization..."
$verifyBody = [System.Text.Encoding]::UTF8.GetBytes((@{ p_passcode = $editorPasscode } | ConvertTo-Json -Compress))
$verifyRole = Invoke-SupabaseRequest -Uri "$supabaseUrl/rest/v1/rpc/fn_verify_dbms_passcode" -Method "Post" -RequestHeaders $headers -BodyBytes $verifyBody -TimeoutSec 30
if ($verifyRole -ne "EDITOR") {
    throw "SECURITY PRE-FLIGHT FAILED: Passcode was rejected by Supabase (returned role: '$verifyRole'). Verify ISHARP_EDITOR_PASSCODE."
}
Write-Output "  [OK] Authenticated with Supabase as DBMS EDITOR."

$script:hasAtomicRpc = $false
try {
    $probeJson = '{"p_table":"biometrics_sampling","p_pond_indices":[],"p_rows":[]}'
    $probeBytes = [System.Text.Encoding]::UTF8.GetBytes($probeJson)
    $null = Invoke-SupabaseRequest -Uri "$supabaseUrl/rest/v1/rpc/fn_sync_replace_cycles" -Method "Post" -RequestHeaders $headers -BodyBytes $probeBytes -TimeoutSec 20 -MaxAttempts 2
    $script:hasAtomicRpc = $true
    Write-Output "  [OK] Migration 15 Atomic Cycle-Replacement RPC (fn_sync_replace_cycles) is ACTIVE."
} catch {
    $script:hasAtomicRpc = $false
    Write-Output "  [NOTICE] Migration 15 RPC (fn_sync_replace_cycles) not detected yet."
    Write-Output "           Running in safe small-batch fallback mode (strictly aborts on failed purge)."
    Write-Output "           Tip: Run database_migration/15_sync_hardening.sql in Supabase SQL Editor for 10x faster atomic sync."
}
Write-Output ""

# -------------------------------------------------------------
# Batch Upload & Atomic Cycle Reconciliation Helpers
# -------------------------------------------------------------
function Post-BatchToSupabase(
    [string]$endpoint,
    [array]$batch,
    [string]$conflictKey = $null,
    [string]$preferResolution = "resolution=merge-duplicates"
) {
    if (-not $batch -or $batch.Count -eq 0) { return }

    # When Migration 15 InitPlan RLS is active, statement passcode check runs ONCE per query (fast 100-row batches).
    # In fallback mode, use small chunks to stay below the 3s bcrypt per-row timeout.
    $chunkSize = if ($script:hasAtomicRpc) {
        if ($endpoint -eq "growout_pond_finance") { 50 } else { 100 }
    } else {
        if ($endpoint -in @("growout_pond_finance", "pond_stocking_batches")) { 2 } else { 5 }
    }

    # For pure inserts without a conflict key, use return=minimal to avoid double RLS (INSERT + UPDATE) evaluation.
    $effectivePrefer = if ($conflictKey -or $preferResolution -ne "resolution=merge-duplicates") {
        $preferResolution
    } else {
        "return=minimal"
    }

    $postHeaders = @{
        "apikey"            = $supabaseKey
        "Authorization"     = "Bearer $supabaseKey"
        "Content-Type"      = "application/json; charset=utf-8"
        "Prefer"            = $effectivePrefer
        "x-isharp-passcode" = $editorPasscode
    }

    for ($chunkIdx = 0; $chunkIdx -lt $batch.Count; $chunkIdx += $chunkSize) {
        $slice = @($batch[$chunkIdx..[Math]::Min($chunkIdx + $chunkSize - 1, $batch.Count - 1)])
        $uri = "$supabaseUrl/rest/v1/$endpoint"
        if ($conflictKey) {
            $uri += "?on_conflict=$conflictKey"
        }
        $json = ConvertTo-Json -InputObject $slice -Depth 5 -Compress
        if (-not $json.StartsWith("[")) { $json = "[$json]" }
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)

        try {
            $null = Invoke-SupabaseRequest -Uri $uri -Method "Post" -RequestHeaders $postHeaders -BodyBytes $bodyBytes -TimeoutSec 60
        } catch {
            $errStr = $_.Exception.Message
            # Fallback if conflictKey unique constraint is not yet created in PostgreSQL
            if ($conflictKey -and $errStr -match "unique or exclusion constraint|42P10") {
                Write-Warning "Unique constraint ($conflictKey) not yet applied on $endpoint; retrying with primary key resolution."
                $fallbackUri = "$supabaseUrl/rest/v1/$endpoint"
                $null = Invoke-SupabaseRequest -Uri $fallbackUri -Method "Post" -RequestHeaders $postHeaders -BodyBytes $bodyBytes -TimeoutSec 60
            } elseif ($errStr -match "57014" -and $slice.Count -gt 1) {
                # Statement timeout: split slice and upload row-by-row
                Write-Warning "Batch timeout on $endpoint; splitting $($slice.Count) rows into individual requests..."
                foreach ($singleItem in $slice) {
                    $singleJson = "[" + ($singleItem | ConvertTo-Json -Depth 5 -Compress) + "]"
                    $singleBytes = [System.Text.Encoding]::UTF8.GetBytes($singleJson)
                    $null = Invoke-SupabaseRequest -Uri $uri -Method "Post" -RequestHeaders $postHeaders -BodyBytes $singleBytes -TimeoutSec 60
                }
            } else {
                throw
            }
        }
    }
}

# Strictly safe purge helper: NEVER swallows errors. If a purge fails after retries, throws to prevent duplicate inserts.
function Purge-PondIndexRecords([string]$endpoint, [array]$pondIndices) {
    if (-not $pondIndices -or $pondIndices.Count -eq 0) { return }
    $chunkSize = if ($script:hasAtomicRpc) { 25 } else { 2 }
    $delHeaders = @{
        "apikey"            = $supabaseKey
        "Authorization"     = "Bearer $supabaseKey"
        "x-isharp-passcode" = $editorPasscode
    }
    for ($i = 0; $i -lt $pondIndices.Count; $i += $chunkSize) {
        $slice = @($pondIndices[$i..[Math]::Min($i + $chunkSize - 1, $pondIndices.Count - 1)])
        $inList = ($slice | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join ","
        $delUrl = if ($slice.Count -eq 1) {
            "$supabaseUrl/rest/v1/${endpoint}?pond_index=eq.$inList"
        } else {
            "$supabaseUrl/rest/v1/${endpoint}?pond_index=in.($inList)"
        }
        try {
            $null = Invoke-SupabaseRequest -Uri $delUrl -Method "Delete" -RequestHeaders $delHeaders -TimeoutSec 60
        } catch {
            if ($slice.Count -gt 1) {
                Write-Warning "Purge batch timed out on $endpoint; retrying single-cycle deletes..."
                foreach ($singlePond in $slice) {
                    $singleEsc = [System.Uri]::EscapeDataString($singlePond)
                    $singleUrl = "$supabaseUrl/rest/v1/${endpoint}?pond_index=eq.$singleEsc"
                    $null = Invoke-SupabaseRequest -Uri $singleUrl -Method "Delete" -RequestHeaders $delHeaders -TimeoutSec 60
                }
            } else {
                throw "CRITICAL: Failed to purge $endpoint for pond_index $($slice -join ','). Aborting stage to prevent duplicate records: $($_.Exception.Message)"
            }
        }
    }
}

function Format-CanonicalValue($val) {
    if ($val -eq $null -or $val -eq [DBNull]::Value) { return "" }
    if ($val -is [decimal] -or $val -is [double] -or $val -is [single] -or $val -is [int] -or $val -is [long]) {
        try {
            return ([Math]::Round([decimal]$val, 2)).ToString("0.##", [System.Globalization.CultureInfo]::InvariantCulture)
        } catch {
            return ([string]$val).Trim().ToUpper()
        }
    }
    return ([string]$val).Trim().ToUpper()
}

function Get-RowCanonicalSig($row, [string[]]$cols) {
    $parts = New-Object System.Collections.Generic.List[string]
    $isDict = ($row -is [System.Collections.IDictionary])
    foreach ($c in $cols) {
        $v = if ($isDict) { $row[$c] } else { $row.$c }
        $parts.Add((Format-CanonicalValue $v))
    }
    return ($parts -join "|")
}

# Reconciles a cycle-level table atomically (with smart cloud diffing + per-chunk checkpointing)
function Sync-CycleTable(
    [string]$stageKey,
    [string]$endpoint,
    [hashtable]$recordsByPond,
    [string]$conflictKey = $null
) {
    $allPonds = @($recordsByPond.Keys | Sort-Object)
    if ($allPonds.Count -eq 0) { return }

    $doneSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if ($script:checkpoint.completedPonds[$stageKey]) {
        foreach ($p in $script:checkpoint.completedPonds[$stageKey]) {
            $doneSet.Add([string]$p) | Out-Null
        }
    }

    $candidatePonds = @($allPonds | Where-Object { -not $doneSet.Contains($_) })
    if ($candidatePonds.Count -lt $allPonds.Count) {
        Write-Output "  [RESUME] Skipping $($allPonds.Count - $candidatePonds.Count) already-reconciled cycles in $endpoint; $($candidatePonds.Count) to check."
    }
    if ($candidatePonds.Count -eq 0) { return }

    # Determine schema columns from first non-empty cycle
    $sampleRow = $null
    foreach ($p in $candidatePonds) {
        if ($recordsByPond[$p] -and $recordsByPond[$p].Count -gt 0) {
            $sampleRow = $recordsByPond[$p][0]
            break
        }
    }
    $cols = if ($sampleRow) { @($sampleRow.Keys) } else { @("pond_index") }
    $selectCols = $cols -join ","

    # Pre-fetch existing rows for candidatePonds in chunks of 40 pond_index values to skip unchanged cycles
    $supaByPond = @{}
    if (-not $forceFull) {
        for ($i = 0; $i -lt $candidatePonds.Count; $i += 40) {
            $pSlice = @($candidatePonds[$i..[Math]::Min($i + 39, $candidatePonds.Count - 1)])
            $inStr = ($pSlice | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join ","
            $existingRows = Get-AllFromSupabase "$supabaseUrl/rest/v1/${endpoint}?select=${selectCols}&pond_index=in.($inStr)"
            foreach ($er in $existingRows) {
                $ep = [string]$er.pond_index
                if (-not $supaByPond.ContainsKey($ep)) {
                    $supaByPond[$ep] = New-Object System.Collections.Generic.List[string]
                }
                $supaByPond[$ep].Add((Get-RowCanonicalSig $er $cols))
            }
        }
    }

    $pendingPonds = @()
    $unchangedCount = 0
    foreach ($p in $candidatePonds) {
        if (-not $forceFull) {
            $accSigs = @($recordsByPond[$p] | ForEach-Object { Get-RowCanonicalSig $_ $cols } | Sort-Object)
            $supSigs = if ($supaByPond.ContainsKey($p)) { @($supaByPond[$p] | Sort-Object) } else { @() }
            if ($accSigs.Count -eq $supSigs.Count -and (($accSigs -join "||") -eq ($supSigs -join "||"))) {
                $unchangedCount++
                $doneSet.Add($p) | Out-Null
                continue
            }
        }
        $pendingPonds += $p
    }

    if ($unchangedCount -gt 0) {
        $script:checkpoint.completedPonds[$stageKey] = @($doneSet)
        Save-Checkpoint
    }

    if ($pendingPonds.Count -eq 0) {
        Write-Output "  [DELTA] All $($candidatePonds.Count) target cycles in $endpoint already match Supabase 100% (0 writes needed)."
        return
    }
    Write-Output "  [DELTA] $($pendingPonds.Count) of $($candidatePonds.Count) target cycles in $endpoint have changes ($unchangedCount unchanged skipped)."

    $syncedRowCount = 0
    $cycleChunkSize = if ($script:hasAtomicRpc) { 10 } else { 2 }

    for ($i = 0; $i -lt $pendingPonds.Count; $i += $cycleChunkSize) {
        $cycleSlice = @($pendingPonds[$i..[Math]::Min($i + $cycleChunkSize - 1, $pendingPonds.Count - 1)])
        $rowsSlice = @()
        foreach ($p in $cycleSlice) {
            $rowsSlice += $recordsByPond[$p]
        }

        if ($script:hasAtomicRpc) {
            $payload = [ordered]@{
                p_table        = $endpoint
                p_pond_indices = $cycleSlice
                p_rows         = $rowsSlice
            }
            $json = $payload | ConvertTo-Json -Depth 6 -Compress
            $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            try {
                $null = Invoke-SupabaseRequest -Uri "$supabaseUrl/rest/v1/rpc/fn_sync_replace_cycles" -Method "Post" -RequestHeaders $headers -BodyBytes $bodyBytes -TimeoutSec 90
            } catch {
                if ($cycleSlice.Count -gt 1) {
                    Write-Warning "RPC batch timed out on $endpoint; retrying 1 cycle at a time..."
                    foreach ($singleP in $cycleSlice) {
                        $singlePayload = [ordered]@{
                            p_table        = $endpoint
                            p_pond_indices = @($singleP)
                            p_rows         = @($recordsByPond[$singleP])
                        }
                        $singleBytes = [System.Text.Encoding]::UTF8.GetBytes(($singlePayload | ConvertTo-Json -Depth 6 -Compress))
                        $null = Invoke-SupabaseRequest -Uri "$supabaseUrl/rest/v1/rpc/fn_sync_replace_cycles" -Method "Post" -RequestHeaders $headers -BodyBytes $singleBytes -TimeoutSec 90
                    }
                } else {
                    throw
                }
            }
        } else {
            # Fallback mode: Only purge cycles that actually have existing rows in Supabase.
            # Cycles with 0 rows in Supabase use pure INSERT (zero risk of destructive purge).
            $cyclesToPurge = @($cycleSlice | Where-Object { $forceFull -or ($supaByPond.ContainsKey($_) -and $supaByPond[$_].Count -gt 0) })
            if ($cyclesToPurge.Count -gt 0) {
                Purge-PondIndexRecords $endpoint $cyclesToPurge
            }
            if ($rowsSlice.Count -gt 0) {
                Post-BatchToSupabase $endpoint $rowsSlice $conflictKey
            }
        }

        $syncedRowCount += $rowsSlice.Count
        foreach ($p in $cycleSlice) {
            $doneSet.Add($p) | Out-Null
        }
        $script:checkpoint.completedPonds[$stageKey] = @($doneSet)
        Save-Checkpoint
    }
}

# Connect to Access via OLEDB
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()
Write-Output "[OK] Connected to Microsoft Access DB successfully."

# Preload per-pond stocking totals and species/type for strategy inference & biomass calculations
$stockSummaryCmd = $conn.CreateCommand()
$stockSummaryCmd.CommandText = "SELECT PondIndex, Min(stckdate) AS FirstStockDate, Sum(stckpcs) AS TotalPieces, Max(stcktype) AS StckType, Max(stckspcs) AS StckSpecies FROM [GrowoutPondStocking] GROUP BY PondIndex"
$stockSummaryReader = $stockSummaryCmd.ExecuteReader()
$accessStockSummaryByPond = @{}
while ($stockSummaryReader.Read()) {
    $p = SafeString $stockSummaryReader["PondIndex"]
    if (-not $p) { continue }
    $stType = SafeString $stockSummaryReader["StckType"]
    $stSpcs = SafeString $stockSummaryReader["StckSpecies"]
    $normType = if ($stType) { $stType.Trim().ToUpper() } else { "" }
    # Derive Setiu fallback strategy using Access query ~sq_cGrowoutPondMaster~sq_cstrategy
    $fallbackSttg = if ($normType -eq "P.M") { "SD05DS.M" }
        elseif ($normType -eq "SPR") { "SD05DS.R" }
        elseif ($normType -eq "SPT") { "SD05DS.T" }
        elseif ($stSpcs -and $stSpcs.ToUpper().Contains("MONODON")) { "SD05DS.M" }
        else { "SD05DS.T" }

    $accessStockSummaryByPond[$p] = @{
        FirstStockDate   = SafeDate $stockSummaryReader["FirstStockDate"]
        TotalPieces      = if ($stockSummaryReader["TotalPieces"] -ne [DBNull]::Value) { SafeDecimal $stockSummaryReader["TotalPieces"] } else { 0.0 }
        FallbackStrategy = $fallbackSttg
    }
}
$stockSummaryReader.Close()
$pondStrategyMap = @{}

# -------------------------------------------------------------
# STAGE 1: Synchronize Master Cycles (growout_pond_master)
# Upsert active cycles + recently closed/modified cycles + any new cycles
# -------------------------------------------------------------
Write-Output ""
Write-Output "[1/12] Synchronizing Master Culture Cycles (growout_pond_master)..."

$sbPondIndices = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$sbMasterSigs = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$masterRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/growout_pond_master?select=pond_index,pond_status,pond_active,culture_status,disease_status,final_status,idle_status,strategy,tested"
foreach ($row in $masterRes) {
    if ($row.pond_index) {
        $pStr = [string]$row.pond_index
        $sbPondIndices.Add($pStr) | Out-Null
        $sbMasterSigs.Add("$pStr|$($row.pond_status)|$($row.pond_active)|$($row.culture_status)|$($row.disease_status)|$($row.final_status)|$($row.idle_status)|$($row.strategy)|$($row.tested)") | Out-Null
    }
}
Write-Output "  -> Supabase currently tracks $($sbPondIndices.Count) culture cycles."

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT PondIndex, pond, modl, row, cropno, cycleno, [pond status], [pond active], [date cycle], [date ready], [culture status], [disease status], area, [pond type], [pond usage], [date cleaning], [DateRepair], [date filling], [date culture], [DateBabyBox], [DateQaqc], [date close], [final status], IdleStatus, [water type], Initiative, [I HP], [2 HP], [DatePlanStock], [strategy], [date disease], [Initiative1], [Initiative2], [Tested] FROM [GrowoutPondMaster]"
$reader = $cmd.ExecuteReader()

$masterBatch = @()
$dateBatch = @()
$initBatch = @()
$activeCyclesNeedingCloseCleanup = @()
$activePondIndexSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$reconcileMasterPondSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$masterCloseLookbackDays = [Math]::Max(60, $reconcileDays)
$masterCount = 0

while ($reader.Read()) {
    $pIdx = SafeString $reader["PondIndex"]
    if (-not $pIdx) { continue }

    $rawActive = SafeString $reader["pond active"]
    $rawStatus = SafeString $reader["pond status"]
    $dtClose = SafeDate $reader["date close"]

    $cleanActive = if ($rawActive) {
        $norm = $rawActive.Replace(" ", "").ToUpper()
        if ($norm -eq "INACTIVE") { "INACTIVE" } else { "ACTIVE" }
    } else { "ACTIVE" }

    if ($cleanActive -eq "ACTIVE") {
        $activePondIndexSet.Add($pIdx) | Out-Null
    }

    $cleanStatus = if ($rawStatus) {
        $s = $rawStatus.Trim().ToUpper()
        if ($s -in @("NOT IN USED", "NOT IN USE", "NOT_IN_USE")) { "NOT IN USE" }
        elseif ($s -in @("PRODUCTION", "IDLE", "PREPARATION", "RESERVOIR", "MAINTENANCE", "CLOSE")) { $s }
        else { $s }
    } else { "IDLE" }

    $isNew = -not $sbPondIndices.Contains($pIdx)
    $isActive = ($cleanActive -eq "ACTIVE")
    $isRecentClose = ($dtClose -ne $null -and [datetime]$dtClose -ge (Get-Date).AddDays(-$masterCloseLookbackDays))

    if (-not ($isNew -or $isActive -or $isRecentClose)) {
        continue
    }
    $reconcileMasterPondSet.Add($pIdx) | Out-Null

    $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { SafeString $reader["pond"] }

    $obj = [ordered]@{
        pond_index     = $pIdx
        pond           = $pLabel
        farm           = "SETIU"
        modl           = SafeString $reader["modl"]
        row_no         = SafeString $reader["row"]
        crop_no        = SafeString $reader["cropno"]
        cycle_no       = SafeString $reader["cycleno"]
        pond_status    = $cleanStatus
        pond_active    = $cleanActive
        area           = $(if ($reader["area"] -ne [DBNull]::Value) { SafeDecimal $reader["area"] } else { 0.50 })
        pond_type      = $(if ($reader["pond type"] -ne [DBNull]::Value) { SafeString $reader["pond type"] } else { "FULL LINING" })
        pond_usage     = $(if ($reader["pond usage"] -ne [DBNull]::Value) { SafeString $reader["pond usage"] } else { "GROWOUT" })
        culture_status = $(if ($reader["culture status"] -ne [DBNull]::Value) { SafeString $reader["culture status"] } else { "STANDARD" })
        disease_status = $(if ($reader["disease status"] -ne [DBNull]::Value) { SafeString $reader["disease status"] } else { "NO ISSUES" })
        final_status   = SafeString $reader["final status"]
        idle_days      = 0
        idle_status    = SafeString $reader["IdleStatus"]
        water_type     = $(if ($reader["water type"] -ne [DBNull]::Value) { SafeString $reader["water type"] } else { "SEA WATER" })
        strategy       = $(
            $rawSttg = SafeString $reader["strategy"]
            if ($rawSttg) {
                $rawSttg.Trim().ToUpper()
            } elseif ($accessStockSummaryByPond.ContainsKey($pIdx) -and $accessStockSummaryByPond[$pIdx].FallbackStrategy) {
                $accessStockSummaryByPond[$pIdx].FallbackStrategy
            } else {
                "STANDARD"
            }
        )
        tested         = SafeString $reader["Tested"]
    }
    $pondStrategyMap[$pIdx] = $obj.strategy
    $masterBatch += $obj
    $sbPondIndices.Add($pIdx) | Out-Null
    $masterCount++

    if ($cleanActive -eq "ACTIVE" -and -not $dtClose) {
        $activeCyclesNeedingCloseCleanup += $pIdx
    }

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

    $rawInits = @(
        (SafeString $reader["Initiative"]),
        (SafeString $reader["Initiative1"]),
        (SafeString $reader["Initiative2"])
    )
    foreach ($initStr in $rawInits) {
        if ($initStr -and $initStr.Trim() -ne "") {
            $initBatch += [ordered]@{
                pond_index      = $pIdx
                initiative_name = $initStr.Trim()
            }
        }
    }
}
$reader.Close()

if (-not (Test-StageDone 1)) {
    $masterToUpload = if ($forceFull) {
        $masterBatch
    } else {
        @($masterBatch | Where-Object {
            $mSig = "$($_.pond_index)|$($_.pond_status)|$($_.pond_active)|$($_.culture_status)|$($_.disease_status)|$($_.final_status)|$($_.idle_status)|$($_.strategy)|$($_.tested)"
            -not $sbMasterSigs.Contains($mSig)
        })
    }

    if ($masterToUpload.Count -gt 0) {
        Post-BatchToSupabase "growout_pond_master" $masterToUpload "pond_index"
        Write-Output "  [OK] Upserted $($masterToUpload.Count) changed/new culture cycles into growout_pond_master (checked $masterCount active/recent)."
    } else {
        Write-Output "  [OK] All $masterCount active/recent master cycles already match Supabase 100%."
    }

    # Pre-fetch existing dates and initiatives for the active/recent cycles
    $existingDates = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $existingInits = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $activeClosePonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if ($masterBatch.Count -gt 0) {
        $mPonds = @($masterBatch | ForEach-Object { $_.pond_index })
        for ($i = 0; $i -lt $mPonds.Count; $i += 40) {
            $pSlice = @($mPonds[$i..[Math]::Min($i + 39, $mPonds.Count - 1)])
            $inStr = ($pSlice | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join ","
            $dRows = Get-AllFromSupabase "$supabaseUrl/rest/v1/pond_event_date?select=pond_index,event_name,event_date&pond_index=in.($inStr)"
            foreach ($dr in $dRows) {
                $existingDates.Add("$($dr.pond_index)|$($dr.event_name)|$($dr.event_date)") | Out-Null
                if ($dr.event_name -eq "close") {
                    $activeClosePonds.Add([string]$dr.pond_index) | Out-Null
                }
            }
            $iRows = Get-AllFromSupabase "$supabaseUrl/rest/v1/pond_initiatives?select=pond_index,initiative_name&pond_index=in.($inStr)"
            foreach ($ir in $iRows) {
                $existingInits.Add("$($ir.pond_index)|$($ir.initiative_name)") | Out-Null
            }
        }
    }

    $closeCleanupNeeded = @($activeCyclesNeedingCloseCleanup | Where-Object { $activeClosePonds.Contains($_) })
    if ($closeCleanupNeeded.Count -gt 0) {
        for ($i = 0; $i -lt $closeCleanupNeeded.Count; $i += 10) {
            $sSlice = $closeCleanupNeeded[$i..[Math]::Min($i + 9, $closeCleanupNeeded.Count - 1)]
            $inStr = ($sSlice | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join ","
            $delCloseUrl = "$supabaseUrl/rest/v1/pond_event_date?event_name=eq.close&pond_index=in.($inStr)"
            try {
                $null = Invoke-SupabaseRequest -Uri $delCloseUrl -Method "Delete" -RequestHeaders $headers -TimeoutSec 30
            } catch {}
        }
    }

    $datesToUpload = if ($forceFull) { $dateBatch } else { @($dateBatch | Where-Object { -not $existingDates.Contains("$($_.pond_index)|$($_.event_name)|$($_.event_date)") }) }
    if ($datesToUpload.Count -gt 0) {
        Post-BatchToSupabase "pond_event_date" $datesToUpload "pond_index,event_name"
        Write-Output "  [OK] Upserted $($datesToUpload.Count) changed/new lifecycle dates into pond_event_date."
    } else {
        Write-Output "  [OK] All $($dateBatch.Count) lifecycle dates already match Supabase 100%."
    }

    $initsToUpload = if ($forceFull) { $initBatch } else { @($initBatch | Where-Object { -not $existingInits.Contains("$($_.pond_index)|$($_.initiative_name)") }) }
    if ($initsToUpload.Count -gt 0) {
        Post-BatchToSupabase "pond_initiatives" $initsToUpload "pond_index,initiative_name"
        Write-Output "  [OK] Upserted $($initsToUpload.Count) new farm trials into pond_initiatives."
    } else {
        Write-Output "  [OK] All $($initBatch.Count) farm trials already match Supabase 100%."
    }
    Complete-Stage 1
} else {
    Write-Output "  [RESUME] Stage 1 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 2: Synchronize Gatekeeper (active_operational_ponds)
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

if (-not (Test-StageDone 2)) {
    $sbActive = Get-AllFromSupabase "$supabaseUrl/rest/v1/active_operational_ponds?select=pond,pond_index"
    $sbActiveDict = @{}
    foreach ($item in $sbActive) {
        $sbActiveDict[$item.pond] = $item.pond_index
    }

    $removedCount = 0
    foreach ($p in $sbActiveDict.Keys) {
        if (-not $accessActiveDict.ContainsKey($p)) {
            $delUrl = "$supabaseUrl/rest/v1/active_operational_ponds?pond=eq." + [System.Uri]::EscapeDataString($p)
            $null = Invoke-SupabaseRequest -Uri $delUrl -Method "Delete" -RequestHeaders $headers -TimeoutSec 30
            $removedCount++
        }
    }

    $gateBatch = @()
    foreach ($p in $accessActiveDict.Keys) {
        if (-not $sbActiveDict.ContainsKey($p) -or $sbActiveDict[$p] -ne $accessActiveDict[$p]) {
            $gateBatch += [ordered]@{
                pond         = $p
                pond_index   = $accessActiveDict[$p]
                activated_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")
            }
        }
    }

    if ($gateBatch.Count -gt 0) {
        Post-BatchToSupabase "active_operational_ponds" $gateBatch "pond"
    }
    Write-Output "  [OK] Gatekeeper updated: $($accessActiveDict.Count) active ponds ($($gateBatch.Count) added/updated, $removedCount removed)."
    Complete-Stage 2
} else {
    Write-Output "  [RESUME] Stage 2 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 3: Authoritative GrowoutPondStocking -> pond_stocking_batches
# Full-cycle extraction for any cycle active/recently closed, stocked within reconcile window, or missing in Supabase
# -------------------------------------------------------------
Write-Output ""
Write-Output "[3/12] Reconciling Stocking Batches (pond_stocking_batches)..."
$totalAccessStockingRows = 0
if (-not (Test-StageDone 3)) {
    $targetStockingPonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($mp in $reconcileMasterPondSet) { $targetStockingPonds.Add($mp) | Out-Null }

    $cmd.CommandText = "SELECT DISTINCT PondIndex FROM [GrowoutPondStocking] WHERE stckdate >= DateAdd('d', -$reconcileDays, Date())"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if ($pIdx -and $sbPondIndices.Contains($pIdx)) { $targetStockingPonds.Add($pIdx) | Out-Null }
    }
    $reader.Close()

    # Self-heal any cycle that exists in Access GrowoutPondStocking but currently has 0 rows in Supabase
    $supaStockedPonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if (-not $forceFull) {
        $stckPondsRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/pond_stocking_batches?select=pond_index"
        foreach ($sr in $stckPondsRes) {
            if ($sr.pond_index) { $supaStockedPonds.Add([string]$sr.pond_index) | Out-Null }
        }
    }

    $stockingByPond = @{}
    $seenStockingKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    $cmd.CommandText = "SELECT PondIndex, stckdate, stcksource, stckspcs, stckpcs, stcktype, stckallow, stcktotal, stcktank, stcksize, stckplstts, BSLine FROM [GrowoutPondStocking] ORDER BY PondIndex ASC, stckdate ASC"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }
        if (-not $forceFull -and -not $targetStockingPonds.Contains($pIdx) -and $supaStockedPonds.Contains($pIdx)) { continue }
        $targetStockingPonds.Add($pIdx) | Out-Null

        $sDate = SafeDate $reader["stckdate"]
        $sTank = SafeString $reader["stcktank"]
        $sPcs = SafeDecimal $reader["stckpcs"]
        $dedupSig = "${pIdx}|${sDate}|${sTank}|$(FormatNumKey $sPcs)"
        if ($seenStockingKeys.Contains($dedupSig)) { continue }
        $seenStockingKeys.Add($dedupSig) | Out-Null

        if (-not $stockingByPond.ContainsKey($pIdx)) {
            $stockingByPond[$pIdx] = @()
        }

        $stockingByPond[$pIdx] += [ordered]@{
            pond_index   = $pIdx
            stck_date    = $sDate
            stck_source  = SafeString $reader["stcksource"]
            stck_species = $(if ($reader["stckspcs"] -ne [DBNull]::Value) { SafeString $reader["stckspcs"] } else { "P. VANNAMEI" })
            stck_pcs     = $sPcs
            stck_type    = $(if ($reader["stcktype"] -ne [DBNull]::Value) { SafeString $reader["stcktype"] } else { "SPT" })
            stck_allow   = SafeDecimal $reader["stckallow"]
            stck_total   = SafeDecimal $reader["stcktotal"]
            stck_tank    = $sTank
            stck_size    = SafeDecimal $reader["stcksize"]
            stck_plstts  = $(if ($reader["stckplstts"] -ne [DBNull]::Value) { SafeString $reader["stckplstts"] } else { "1. NPL" })
            bs_line      = SafeString $reader["BSLine"]
        }
        $totalAccessStockingRows++
    }
    $reader.Close()

    if ($stockingByPond.Count -gt 0) {
        Sync-CycleTable "stage3" "pond_stocking_batches" $stockingByPond $null
        Write-Output "  [OK] Checked $totalAccessStockingRows official stocking batches across $($stockingByPond.Count) pond cycles."
    } else {
        Write-Output "  [OK] No stocking records in Access within the reconcile window."
    }
    Complete-Stage 3
} else {
    Write-Output "  [RESUME] Stage 3 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 4: Authoritative GrowoutPondHarvestDaily -> pond_harvest_daily
# Full-cycle extraction for any cycle active/recently closed, harvested within reconcile window, or missing in Supabase
# -------------------------------------------------------------
Write-Output ""
Write-Output "[4/12] Reconciling Daily Harvest Runs (pond_harvest_daily)..."
$totalAccessHarvestRows = 0
if (-not (Test-StageDone 4)) {
    $targetHarvestPonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($mp in $reconcileMasterPondSet) { $targetHarvestPonds.Add($mp) | Out-Null }

    $cmd.CommandText = "SELECT DISTINCT PondIndex FROM [GrowoutPondHarvestDaily] WHERE harvdate >= DateAdd('d', -$reconcileDays, Date())"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if ($pIdx -and $sbPondIndices.Contains($pIdx)) { $targetHarvestPonds.Add($pIdx) | Out-Null }
    }
    $reader.Close()

    # Self-heal any cycle that exists in Access GrowoutPondHarvestDaily but currently has 0 rows in Supabase
    $supaHarvestedPonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if (-not $forceFull) {
        $harvPondsRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/pond_harvest_daily?select=pond_index"
        foreach ($hr in $harvPondsRes) {
            if ($hr.pond_index) { $supaHarvestedPonds.Add([string]$hr.pond_index) | Out-Null }
        }
    }

    $harvestByPond = @{}
    $seenHarvestKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    $cmd.CommandText = "SELECT PondIndex, harvdate, harvstts, harvwgt, harvabw, harvRev, harvmtd FROM [GrowoutPondHarvestDaily] ORDER BY PondIndex ASC, harvdate ASC"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }
        if (-not $forceFull -and -not $targetHarvestPonds.Contains($pIdx) -and $supaHarvestedPonds.Contains($pIdx)) { continue }
        $targetHarvestPonds.Add($pIdx) | Out-Null

        $hDate = $(if ($reader["harvdate"] -ne [DBNull]::Value) { SafeDate $reader["harvdate"] } else { (Get-Date).ToString("yyyy-MM-dd") })
        $hStts = $(if ($reader["harvstts"] -ne [DBNull]::Value) { SafeString $reader["harvstts"] } else { "TERMINATION" })
        $hWgt = $(if ($reader["harvwgt"] -ne [DBNull]::Value) { SafeDecimal $reader["harvwgt"] } else { 0.0 })
        $hAbw = $(if ($reader["harvabw"] -ne [DBNull]::Value) { SafeDecimal $reader["harvabw"] } else { 0.0 })

        $dedupSig = "${pIdx}|${hDate}|${hStts}|$(FormatNumKey $hWgt)|$(FormatNumKey $hAbw)"
        if ($seenHarvestKeys.Contains($dedupSig)) { continue }
        $seenHarvestKeys.Add($dedupSig) | Out-Null

        if (-not $harvestByPond.ContainsKey($pIdx)) {
            $harvestByPond[$pIdx] = @()
        }

        $harvestByPond[$pIdx] += [ordered]@{
            pond_index   = $pIdx
            harv_date    = $hDate
            harv_status  = $hStts
            harv_weight  = $hWgt
            harv_abw     = $hAbw
            harv_revenue = $(if ($reader["harvRev"] -ne [DBNull]::Value) { SafeDecimal $reader["harvRev"] } else { 0.0 })
            harv_method  = $(if ($reader["harvmtd"] -ne [DBNull]::Value) { SafeString $reader["harvmtd"] } else { "M" })
        }
        $totalAccessHarvestRows++
    }
    $reader.Close()

    if ($harvestByPond.Count -gt 0) {
        Sync-CycleTable "stage4" "pond_harvest_daily" $harvestByPond $null
        Write-Output "  [OK] Checked $totalAccessHarvestRows official harvest daily logs across $($harvestByPond.Count) pond cycles."
    } else {
        Write-Output "  [OK] No harvest records in Access within the reconcile window."
    }
    Complete-Stage 4
} else {
    Write-Output "  [RESUME] Stage 4 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 5: Authoritative GrowoutPondHarvestSales -> pond_harvest_sales
# Full-cycle extraction + strict natural slip deduplication
# -------------------------------------------------------------
Write-Output ""
Write-Output "[5/12] Reconciling Harvest Sales (pond_harvest_sales)..."
$totalAccessSalesRows = 0
if (-not (Test-StageDone 5)) {
    $targetSalesPonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($mp in $reconcileMasterPondSet) { $targetSalesPonds.Add($mp) | Out-Null }

    $cmd.CommandText = "SELECT DISTINCT HvtPondIndx FROM [GrowoutPondHarvestSales] WHERE HvtDate >= DateAdd('d', -$reconcileDays, Date())"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["HvtPondIndx"]
        if ($pIdx -and $sbPondIndices.Contains($pIdx)) { $targetSalesPonds.Add($pIdx) | Out-Null }
    }
    $reader.Close()

    $salesByPond = @{}
    $seenSalesKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    $cmd.CommandText = "SELECT HvtPondIndx, HvtDate, HvtABW, GoodWGT, GoodPRC, [2ndGradeWGT], [2ndGradePRC], SmallWGT, BelowWGT, RubbishwGT, RawWGT, HvtSLS, HvtBuyer FROM [GrowoutPondHarvestSales] ORDER BY HvtPondIndx ASC, HvtDate ASC"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["HvtPondIndx"]
        if (-not $pIdx -or -not $targetSalesPonds.Contains($pIdx) -or -not $sbPondIndices.Contains($pIdx)) { continue }

        $hDate = SafeDate $reader["HvtDate"]
        if (-not $hDate) { continue }

        $buyer = SafeString $reader["HvtBuyer"]
        $abw = SafeDecimal $reader["HvtABW"]
        $goodW = SafeDecimal $reader["GoodWGT"]
        $goodP = SafeDecimal $reader["GoodPRC"]
        $secW = SafeDecimal $reader["2ndGradeWGT"]
        $secP = SafeDecimal $reader["2ndGradePRC"]
        $smlW = SafeDecimal $reader["SmallWGT"]
        $blwW = SafeDecimal $reader["BelowWGT"]
        $rubW = SafeDecimal $reader["RubbishwGT"]
        $rawW = SafeDecimal $reader["RawWGT"]
        $netS = SafeDecimal $reader["HvtSLS"]

        $buyerUpper = if ($buyer) { $buyer.ToUpper() } else { "" }
        $slipSig = "${pIdx}|${hDate}|${buyerUpper}|$(FormatNumKey $goodW)|$(FormatNumKey $rawW)|$(FormatNumKey $netS)"
        if ($seenSalesKeys.Contains($slipSig)) { continue }
        $seenSalesKeys.Add($slipSig) | Out-Null

        if (-not $salesByPond.ContainsKey($pIdx)) {
            $salesByPond[$pIdx] = @()
        }

        $salesByPond[$pIdx] += [ordered]@{
            pond_index       = $pIdx
            hvt_date         = $hDate
            hvt_buyer        = $buyer
            hvt_abw          = $abw
            good_wgt         = $goodW
            good_prc         = $goodP
            second_grade_wgt = $secW
            second_grade_prc = $secP
            small_wgt        = $smlW
            below_wgt        = $blwW
            rubbish_wgt      = $rubW
            raw_wgt          = $rawW
            net_sales        = $netS
        }
        $totalAccessSalesRows++
    }
    $reader.Close()

    if ($salesByPond.Count -gt 0) {
        Sync-CycleTable "stage5" "pond_harvest_sales" $salesByPond $null
        Write-Output "  [OK] Checked $totalAccessSalesRows official sales slips across $($salesByPond.Count) pond cycles."
    } else {
        Write-Output "  [OK] No sales records in Access within the reconcile window."
    }
    Complete-Stage 5
} else {
    Write-Output "  [RESUME] Stage 5 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 6: Authoritative Pathology Issues (pond_issues) & Notes (pond_notes)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[6/12] Reconciling Pathology Issues (pond_issues) & Notes..."
$totalAccessIssueRows = 0
$newNotesCount = 0
if (-not (Test-StageDone 6)) {
    $targetIssuePonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($mp in $reconcileMasterPondSet) { $targetIssuePonds.Add($mp) | Out-Null }

    $cmd.CommandText = "SELECT DISTINCT PondIndex FROM [GrowoutPondIssues] WHERE issuedate >= DateAdd('d', -$reconcileDays, Date())"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if ($pIdx -and $sbPondIndices.Contains($pIdx)) { $targetIssuePonds.Add($pIdx) | Out-Null }
    }
    $reader.Close()

    $issuesByPond = @{}
    $seenIssueKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    $cmd.CommandText = "SELECT PondIndex, issuedate, issueCat, issuestts, issuetest, issueflag, issueGrade, issueNote FROM [GrowoutPondIssues] ORDER BY PondIndex ASC, issuedate ASC"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if (-not $pIdx -or -not $targetIssuePonds.Contains($pIdx) -or -not $sbPondIndices.Contains($pIdx)) { continue }

        $iDate = $(if ($reader["issuedate"] -ne [DBNull]::Value) { SafeDate $reader["issuedate"] } else { (Get-Date).ToString("yyyy-MM-dd") })
        $iCat  = $(if ($reader["issueCat"] -ne [DBNull]::Value) { SafeString $reader["issueCat"] } else { "DISEASE" })
        $iStts = $(if ($reader["issuestts"] -ne [DBNull]::Value) { SafeString $reader["issuestts"] } else { "EHP" })
        $iTest = $(if ($reader["issuetest"] -ne [DBNull]::Value) { SafeString $reader["issuetest"] } else { "MICROSCOPY" })
        $iFlag = $(if ($reader["issueflag"] -ne [DBNull]::Value) { SafeString $reader["issueflag"] } else { "GREEN" })
        $iGrad = $(if ($reader["issueGrade"] -ne [DBNull]::Value) { SafeString $reader["issueGrade"] } else { "G0" })
        $iNote = $(if ($reader["issueNote"] -ne [DBNull]::Value) { SafeString $reader["issueNote"] } else { "NEGATIVE" })

        $issueSig = "${pIdx}|${iDate}|${iCat}|${iStts}|${iTest}|${iFlag}|${iGrad}|${iNote}"
        if ($seenIssueKeys.Contains($issueSig)) { continue }
        $seenIssueKeys.Add($issueSig) | Out-Null

        if (-not $issuesByPond.ContainsKey($pIdx)) {
            $issuesByPond[$pIdx] = @()
        }

        $issuesByPond[$pIdx] += [ordered]@{
            pond_index     = $pIdx
            issue_date     = $iDate
            issue_category = $iCat
            issue_status   = $iStts
            issue_test     = $iTest
            issue_flag     = $iFlag
            issue_grade    = $iGrad
            issue_note     = $iNote
        }
        $totalAccessIssueRows++
    }
    $reader.Close()

    if ($issuesByPond.Count -gt 0) {
        Sync-CycleTable "stage6" "pond_issues" $issuesByPond $null
        Write-Output "  [OK] Checked $totalAccessIssueRows pathology issues across $($issuesByPond.Count) pond cycles."
    }

    # Notes: Paginated preload of ALL existing notes (prevents 1,000-row truncation bug)
    $existingNoteSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $existingNotesRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/pond_notes?select=pond_index,note"
    foreach ($nr in $existingNotesRes) {
        if ($nr.pond_index -and $nr.note) {
            $existingNoteSet.Add((NormalizeNoteKey ([string]$nr.pond_index) ([string]$nr.note))) | Out-Null
        }
    }

    $cmd.CommandText = "SELECT PondIndex, Remark FROM [GrowoutPondNote] WHERE Remark IS NOT NULL"
    $reader = $cmd.ExecuteReader()
    $notesBatch = @()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        $rem = SafeString $reader["Remark"]
        if (-not $pIdx -or -not $rem -or -not $sbPondIndices.Contains($pIdx)) { continue }

        $sig = NormalizeNoteKey $pIdx $rem
        if ($existingNoteSet.Contains($sig)) { continue }
        $existingNoteSet.Add($sig) | Out-Null

        $notesBatch += [ordered]@{
            pond_index = $pIdx
            note       = $rem
            logged_by  = "ACCESS_WEEKLY_SYNC"
        }
        $newNotesCount++
    }
    $reader.Close()

    if ($notesBatch.Count -gt 0) {
        Post-BatchToSupabase "pond_notes" $notesBatch $null "resolution=ignore-duplicates"
    }
    Write-Output "  [OK] Added $newNotesCount new pond notes (checked against $($existingNotesRes.Count) existing notes)."
    Complete-Stage 6
} else {
    Write-Output "  [RESUME] Stage 6 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 7: Authoritative Biometrics Sampling -> biometrics_sampling
# Full-cycle extraction + Natural Key (pond_index, smpl_date) deduplication
# Automatic derivation of missing smpl_bms & sttg_* when Access macro was not run
# -------------------------------------------------------------
Write-Output ""
Write-Output "[7/12] Reconciling Biometrics Samplings (biometrics_sampling)..."
$totalAccessSamplingRows = 0
if (-not $forceFull -and (Test-StageDone 7)) {
    $probeNullRes = @(Get-FromSupabase "$supabaseUrl/rest/v1/biometrics_sampling?select=id&or=(smpl_bms.is.null,sttg_abw.is.null)&limit=1")
    if ($probeNullRes -and $probeNullRes.Count -gt 0) {
        Write-Output "  [SELF-HEAL] Detected unreconciled/null biometrics rows in Supabase; invalidating Stage 7 checkpoint..."
        $script:checkpoint.completedStages = @($script:checkpoint.completedStages | Where-Object { $_ -ne 7 })
    }
}
if (-not (Test-StageDone 7)) {
    # 1. Preload strategy benchmarks from UtilStockStrategy for fallback calculation
    $utilStrategyMap = @{}
    $sttgCmd = $conn.CreateCommand()
    $sttgCmd.CommandText = "SELECT GetStrategy, SttgDOC, SttgABW, SttgSR, SttgFCR, FeedRate FROM [UtilStockStrategy]"
    $sttgReader = $sttgCmd.ExecuteReader()
    while ($sttgReader.Read()) {
        $st = SafeString $sttgReader["GetStrategy"]
        $doc = SafeInt $sttgReader["SttgDOC"]
        if ($st -and $doc -ne $null) {
            $key = "$($st.ToUpper())|$doc"
            $utilStrategyMap[$key] = @{
                SttgABW  = if ($sttgReader["SttgABW"] -ne [DBNull]::Value) { [decimal]$sttgReader["SttgABW"] } else { $null }
                SttgSR   = if ($sttgReader["SttgSR"] -ne [DBNull]::Value) { [decimal]$sttgReader["SttgSR"] } else { $null }
                SttgFCR  = if ($sttgReader["SttgFCR"] -ne [DBNull]::Value) { [decimal]$sttgReader["SttgFCR"] } else { $null }
                FeedRate = if ($sttgReader["FeedRate"] -ne [DBNull]::Value) { [decimal]$sttgReader["FeedRate"] } else { $null }
            }
        }
    }
    $sttgReader.Close()

    $targetSamplingPonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($mp in $reconcileMasterPondSet) { $targetSamplingPonds.Add($mp) | Out-Null }

    $cmd.CommandText = "SELECT DISTINCT PondIndex FROM [GrowoutPondSampling] WHERE smpldate >= DateAdd('d', -$reconcileDays, Date())"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if ($pIdx -and $sbPondIndices.Contains($pIdx)) { $targetSamplingPonds.Add($pIdx) | Out-Null }
    }
    $reader.Close()

    # Self-heal any cycle in Supabase that currently has NULL smpl_bms or sttg_abw
    $supaMissingSamplingPonds = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if (-not $forceFull) {
        $nullSamplingRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/biometrics_sampling?select=pond_index&or=(smpl_bms.is.null,sttg_abw.is.null)"
        foreach ($ns in $nullSamplingRes) {
            if ($ns.pond_index) {
                $pStr = [string]$ns.pond_index
                $supaMissingSamplingPonds.Add($pStr) | Out-Null
                $targetSamplingPonds.Add($pStr) | Out-Null
            }
        }
        # Invalidate completedPonds checkpoint for any cycle that needs healing
        if ($script:checkpoint.completedPonds["stage7"] -and $supaMissingSamplingPonds.Count -gt 0) {
            $script:checkpoint.completedPonds["stage7"] = @($script:checkpoint.completedPonds["stage7"] | Where-Object { -not $supaMissingSamplingPonds.Contains($_) })
        }
    }

    $samplingByPondAndDate = @{}
    $cmd.CommandText = "SELECT PondIndex, smpldate, SmplDoc, smplabw, smplsurv, SmplDFed, SmplTFed, Psmpldate, PSmplDoc, Psmplabw, Psmplsurv, PSmplDFed, PSmplTFed, sttgabw, sttgsurv, sttgbms, sttgDFed, sttgTFed, smplbms FROM [GrowoutPondSampling] ORDER BY PondIndex ASC, smpldate ASC"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if (-not $pIdx -or -not $targetSamplingPonds.Contains($pIdx) -or -not $sbPondIndices.Contains($pIdx)) { continue }

        $sDate = $(if ($reader["smpldate"] -ne [DBNull]::Value) { SafeDate $reader["smpldate"] } else { $null })
        if (-not $sDate) { continue }

        $stckInfo = if ($accessStockSummaryByPond.ContainsKey($pIdx)) { $accessStockSummaryByPond[$pIdx] } else { $null }
        $totalPieces = if ($stckInfo) { $stckInfo.TotalPieces } else { 0.0 }
        $firstStockDate = if ($stckInfo) { $stckInfo.FirstStockDate } else { $null }

        $docVal = if ($reader["SmplDoc"] -ne [DBNull]::Value) { SafeInt $reader["SmplDoc"] } else { $null }
        if (($docVal -eq $null -or $docVal -le 0) -and $firstStockDate) {
            try {
                $docVal = [int](([datetime]$sDate - [datetime]$firstStockDate).TotalDays)
            } catch {
                $docVal = 0
            }
        }
        $smplDoc = if ($docVal -ne $null) { $docVal } else { 0 }

        $smplAbw = $(if ($reader["smplabw"] -ne [DBNull]::Value) { SafeDecimal $reader["smplabw"] } else { 0.0 })
        $smplSurv = SafeDecimal $reader["smplsurv"]
        $smplDfed = SafeDecimal $reader["SmplDFed"]
        $smplTfed = SafeDecimal $reader["SmplTFed"]
        $smplBms = SafeDecimal $reader["smplbms"]

        # If smplbms is NULL in Access, auto-calculate using exact Access formula:
        # TotalPieces * (smplabw / 1000) * (smplsurv / 100)
        if ($smplBms -eq $null -and $totalPieces -gt 0 -and $smplAbw -ne $null -and $smplSurv -ne $null) {
            $smplBms = [Math]::Round([decimal]($totalPieces * ($smplAbw / 1000.0) * ($smplSurv / 100.0)), 2)
        }

        # Resolve effective strategy for this pond
        $effStrategy = if ($pondStrategyMap.ContainsKey($pIdx) -and $pondStrategyMap[$pIdx]) {
            $pondStrategyMap[$pIdx]
        } elseif ($stckInfo -and $stckInfo.FallbackStrategy) {
            $stckInfo.FallbackStrategy
        } else {
            "SD05DS.T"
        }

        $sttgAbw = SafeDecimal $reader["sttgabw"]
        $sttgSurv = SafeDecimal $reader["sttgsurv"]
        $sttgBms = SafeDecimal $reader["sttgbms"]
        $sttgDfed = SafeDecimal $reader["sttgDFed"]
        $sttgTfed = SafeDecimal $reader["sttgTFed"]

        # If strategy columns are NULL in Access (GrowoutSpecialSttgStckSmpl7 not run), auto-calculate from UtilStockStrategy
        $sttgLookupKey = "$($effStrategy.ToUpper())|$smplDoc"
        if ($utilStrategyMap.ContainsKey($sttgLookupKey)) {
            $u = $utilStrategyMap[$sttgLookupKey]
            if ($sttgAbw -eq $null -and $u.SttgABW -ne $null) {
                $sttgAbw = [Math]::Round([decimal]$u.SttgABW, 2)
            }
            if ($sttgSurv -eq $null -and $u.SttgSR -ne $null) {
                $sttgSurv = [Math]::Round([decimal]$u.SttgSR, 2)
            }
            $calcSttgBms = if ($totalPieces -gt 0 -and $sttgAbw -ne $null -and $sttgSurv -ne $null) {
                [Math]::Round([decimal]($totalPieces * ($sttgAbw / 1000.0) * ($sttgSurv / 100.0)), 2)
            } else { $null }

            if ($sttgBms -eq $null -and $calcSttgBms -ne $null) {
                $sttgBms = $calcSttgBms
            }
            if ($sttgDfed -eq $null -and $calcSttgBms -ne $null -and $u.FeedRate -ne $null) {
                $sttgDfed = [Math]::Round([decimal](($u.FeedRate / 100.0) * $calcSttgBms), 2)
            }
            if ($sttgTfed -eq $null -and $calcSttgBms -ne $null -and $u.SttgFCR -ne $null) {
                $sttgTfed = [Math]::Round([decimal]($calcSttgBms * $u.SttgFCR), 2)
            }
        }

        if (-not $samplingByPondAndDate.ContainsKey($pIdx)) {
            $samplingByPondAndDate[$pIdx] = [ordered]@{}
        }

        $samplingByPondAndDate[$pIdx][$sDate] = [ordered]@{
            pond_index  = $pIdx
            smpl_date   = $sDate
            smpl_doc    = $smplDoc
            smpl_abw    = $smplAbw
            smpl_surv   = $smplSurv
            smpl_dfed   = $smplDfed
            smpl_tfed   = $smplTfed
            smpl_bms    = $smplBms
            p_smpl_date = SafeDate $reader["Psmpldate"]
            p_smpl_doc  = SafeInt $reader["PSmplDoc"]
            p_smpl_abw  = SafeDecimal $reader["Psmplabw"]
            p_smpl_surv = SafeDecimal $reader["Psmplsurv"]
            p_smpl_dfed = SafeDecimal $reader["PSmplDFed"]
            p_smpl_tfed = SafeDecimal $reader["PSmplTFed"]
            sttg_abw    = $sttgAbw
            sttg_surv   = $sttgSurv
            sttg_bms    = $sttgBms
            sttg_dfed   = $sttgDfed
            sttg_tfed   = $sttgTfed
        }
    }
    $reader.Close()

    $samplingByPond = @{}
    foreach ($pIdx in $samplingByPondAndDate.Keys) {
        $vals = @($samplingByPondAndDate[$pIdx].Values)
        $samplingByPond[$pIdx] = $vals
        $totalAccessSamplingRows += $vals.Count
    }

    if ($samplingByPond.Count -gt 0) {
        Sync-CycleTable "stage7" "biometrics_sampling" $samplingByPond "pond_index,smpl_date"
        Write-Output "  [OK] Checked $totalAccessSamplingRows official biometrics samplings across $($samplingByPond.Count) pond cycles."
    } else {
        Write-Output "  [OK] No sampling records in Access within the reconcile window."
    }
    Complete-Stage 7
} else {
    Write-Output "  [RESUME] Stage 7 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 8: Synchronize Paddlewheel Aerators (pond_aerator_inventory)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[8/12] Synchronizing Paddlewheel Aerators (pond_aerator_inventory)..."
$aeratorCount = 0
if (-not (Test-StageDone 8)) {
    $existingAerators = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if (-not $forceFull) {
        $aerRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/pond_aerator_inventory?select=pond_index,aerator_model,hp,total_units,active_units"
        foreach ($ar in $aerRes) {
            if ($ar.pond_index) {
                $existingAerators.Add("$($ar.pond_index)|$($ar.aerator_model)|$(Format-CanonicalValue $ar.hp)|$(Format-CanonicalValue $ar.total_units)|$(Format-CanonicalValue $ar.active_units)") | Out-Null
            }
        }
    }

    $cmd.CommandText = "SELECT [Pond Index], [1HP], [2HP] FROM [MNA-PWA Status] WHERE [Pond Index] IS NOT NULL"
    $reader = $cmd.ExecuteReader()
    $aeratorBatch = @()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["Pond Index"]
        if (-not $pIdx -or -not $sbPondIndices.Contains($pIdx)) { continue }
        $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { $pIdx }

        $u1 = SafeInt $reader["1HP"]
        $u2 = SafeInt $reader["2HP"]
        $nowStr = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")

        if ($u1 -ne $null -and $u1 -ge 0) {
            $sig1 = "${pIdx}|1.0 HP Paddlewheel|1|$u1|$u1"
            if (-not $existingAerators.Contains($sig1)) {
                $aeratorBatch += [ordered]@{
                    pond_index    = $pIdx
                    pond          = $pLabel
                    aerator_model = "1.0 HP Paddlewheel"
                    hp            = 1.0
                    total_units   = $u1
                    active_units  = $u1
                    updated_at    = $nowStr
                }
            }
        }
        if ($u2 -ne $null -and $u2 -ge 0) {
            $sig2 = "${pIdx}|2.0 HP Paddlewheel|2|$u2|$u2"
            if (-not $existingAerators.Contains($sig2)) {
                $aeratorBatch += [ordered]@{
                    pond_index    = $pIdx
                    pond          = $pLabel
                    aerator_model = "2.0 HP Paddlewheel"
                    hp            = 2.0
                    total_units   = $u2
                    active_units  = $u2
                    updated_at    = $nowStr
                }
            }
        }
        $aeratorCount++
    }
    $reader.Close()

    if ($aeratorBatch.Count -gt 0) {
        Post-BatchToSupabase "pond_aerator_inventory" $aeratorBatch "pond_index,aerator_model,hp"
    }
    Write-Output "  [OK] Checked $aeratorCount pond cycles for aerator configurations ($($aeratorBatch.Count) new/changed rows upserted)."
    Complete-Stage 8
} else {
    Write-Output "  [RESUME] Stage 8 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 9: Preservation of Legacy Feed Records (growout_pond_feed_legacy)
# Architecture: Zero index_no / Natural Key (pond_index, feed_date, feed_type, quantity_kg)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[9/12] Preserving Legacy Feed (growout_pond_feed_legacy)..."
$newFeedCount = 0
if (-not (Test-StageDone 9)) {
    $existingFeedKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $feedRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/growout_pond_feed_legacy?select=pond_index,feed_date,feed_type,quantity_kg&feed_date=gte.$reconcileCutoff"
    foreach ($r in $feedRes) {
        if ($r.pond_index -and $r.feed_date) {
            $existingFeedKeys.Add("$($r.pond_index)|$($r.feed_date)|$($r.feed_type)|$(FormatNumKey $r.quantity_kg)") | Out-Null
        }
    }

    $cmd.CommandText = "SELECT PondIndex, [date], feed, quantity FROM [GrowoutPondFeed] WHERE [date] >= DateAdd('d', -$reconcileDays, Date()) ORDER BY [date] ASC"
    $reader = $cmd.ExecuteReader()
    $batch = @()
    while ($reader.Read()) {
        $pIdx = SafeString $reader["PondIndex"]
        if (-not $pIdx) { continue }
        $pLabel = if ($pIdx.Length -ge 7) { "$($pIdx.Substring(1,2)).$($pIdx.Substring(3,2)).$($pIdx.Substring(5,2))" } else { $pIdx }
        $fDate = SafeDate $reader["date"]
        if (-not $fDate) { continue }
        $fType = SafeString $reader["feed"]
        $fQty = $(if ($reader["quantity"] -ne [DBNull]::Value) { SafeDecimal $reader["quantity"] } else { 0.0 })

        $sig = "${pIdx}|${fDate}|${fType}|$(FormatNumKey $fQty)"
        if ($existingFeedKeys.Contains($sig)) { continue }
        $existingFeedKeys.Add($sig) | Out-Null

        # Zero index_no: only natural business columns are synced
        $batch += [ordered]@{
            pond_index  = $pIdx
            pond        = $pLabel
            feed_date   = $fDate
            feed_type   = $fType
            quantity_kg = $fQty
        }
        $newFeedCount++
    }
    $reader.Close()

    if ($batch.Count -gt 0) {
        Post-BatchToSupabase "growout_pond_feed_legacy" $batch "pond_index,feed_date,feed_type,quantity_kg"
    }
    Write-Output "  [OK] Preserved $newFeedCount daily feed entries in growout_pond_feed_legacy."
    Complete-Stage 9
} else {
    Write-Output "  [RESUME] Stage 9 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 10: Authoritative SAP Feed Ledger (growout_pond_feed_sap)
# Deterministic sync_key reconciliation
# -------------------------------------------------------------
Write-Output ""
Write-Output "[10/12] Reconciling SAP Feed Ledger (growout_pond_feed_sap)..."
$newSapFeedCount = 0
if (-not (Test-StageDone 10)) {
    $existingSapSigs = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if (-not $forceFull) {
        $sapRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/growout_pond_feed_sap?select=sync_key,amount_kg&sap_post_date=gte.$reconcileCutoff"
        foreach ($sr in $sapRes) {
            if ($sr.sync_key) {
                $existingSapSigs.Add("$($sr.sync_key)|$(Format-CanonicalValue $sr.amount_kg)") | Out-Null
            }
        }
    }

    $cmd.CommandText = "SELECT Orderno, SapPondidx, SapPostDate, SapFeedidx, SapFeedName, SapFeedKgs, SapMovement FROM [GrowoutPondFeedSAP] WHERE SapPostDate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY Orderno ASC, SapPostDate ASC, SapPondidx ASC, SapFeedidx ASC, SapMovement ASC, SapFeedKgs ASC"
    $reader = $cmd.ExecuteReader()
    $batch = @()
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
        $amtVal = $(if ($feedKgs -ne $null) { $feedKgs } else { 0.0 })
        $sapSig = "${syncKey}|$(Format-CanonicalValue $amtVal)"
        if ($existingSapSigs.Contains($sapSig)) {
            continue
        }

        $batch += [ordered]@{
            sync_key       = $syncKey
            order_no       = $orderno
            pond_index     = $pIdx
            pond           = $pLabel
            sap_post_date  = $postDate
            sap_feed_index = $feedIdx
            sap_feed_name  = $feedName
            amount_kg      = $amtVal
            sap_movement   = $movement
        }
        $newSapFeedCount++
    }
    $reader.Close()

    if ($batch.Count -gt 0) {
        Post-BatchToSupabase "growout_pond_feed_sap" $batch "sync_key"
    }
    Write-Output "  [OK] Synchronized $newSapFeedCount new/changed SAP feed records in growout_pond_feed_sap."
    Complete-Stage 10
} else {
    Write-Output "  [RESUME] Stage 10 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 11: Harvest Planning Targets (pond_harvest_plan)
# Deterministic natural sync_key reconciliation (pond_index + plan_date + plan_status)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[11/12] Reconciling Harvest Planning Targets (pond_harvest_plan)..."
$newHarvestPlanCount = 0
if (-not (Test-StageDone 11)) {
    $existingPlanSigs = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    if (-not $forceFull) {
        $planRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/pond_harvest_plan?select=sync_key,plan_harv_abw,plan_harv_weight,time_harvest,time_delivery,team&plan_harv_date=gte.$reconcileCutoff"
        foreach ($pr in $planRes) {
            if ($pr.sync_key) {
                $existingPlanSigs.Add("$($pr.sync_key)|$(Format-CanonicalValue $pr.plan_harv_abw)|$(Format-CanonicalValue $pr.plan_harv_weight)|$(Format-CanonicalValue $pr.time_harvest)|$(Format-CanonicalValue $pr.time_delivery)|$(Format-CanonicalValue $pr.team)") | Out-Null
            }
        }
    }

    $cmd.CommandText = "SELECT PondIndex, planharvstts, planharvdate, planharvabw, planharvwgt, timeHvt, timeDlv, Team FROM [GrowoutPondHarvestPlan] WHERE planharvdate >= DateAdd('d', -$reconcileDays, Date()) ORDER BY PondIndex ASC, planharvdate ASC"
    $reader = $cmd.ExecuteReader()
    $planMap = [ordered]@{}

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
        $planSig = "${syncKey}|$(Format-CanonicalValue $planAbw)|$(Format-CanonicalValue $planWgt)|$(Format-CanonicalValue $timeHvt)|$(Format-CanonicalValue $timeDlv)|$(Format-CanonicalValue $team)"
        if ($existingPlanSigs.Contains($planSig)) {
            continue
        }

        $planMap[$syncKey] = [ordered]@{
            sync_key         = $syncKey
            pond_index       = $pIdx
            pond             = $pLabel
            plan_harv_date   = $planDate
            plan_harv_status = $cleanStatus
            plan_harv_abw    = $planAbw
            plan_harv_weight = $planWgt
            time_harvest     = $timeHvt
            time_delivery    = $timeDlv
            team             = $team
        }
    }
    $reader.Close()

    $batch = @($planMap.Values)
    $newHarvestPlanCount = $batch.Count
    if ($batch.Count -gt 0) {
        Post-BatchToSupabase "pond_harvest_plan" $batch "sync_key"
    }
    Write-Output "  [OK] Synchronized $newHarvestPlanCount new/changed harvest planning targets in pond_harvest_plan."
    Complete-Stage 11
} else {
    Write-Output "  [RESUME] Stage 11 already completed in current checkpoint."
}

# -------------------------------------------------------------
# STAGE 12: Audited Cycle Financials (growout_pond_finance)
# Natural key: pond_index (1 row per cycle, synced for active/recent/missing cycles)
# -------------------------------------------------------------
Write-Output ""
Write-Output "[12/12] Reconciling Audited Cycle Financials (growout_pond_finance)..."
$newFinanceCount = 0
if (-not (Test-StageDone 12)) {
    $recentMasterSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($m in $masterBatch) {
        $recentMasterSet.Add([string]$m.pond_index) | Out-Null
    }

    # Pre-fetch existing finance signatures ONLY for active/recent target cycles in small slices
    # (avoids full-table RLS scan timeout on growout_pond_finance when Migration 15 is not yet applied)
    $existingFinanceSigs = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $targetFinPonds = @($recentMasterSet)
    $finSliceSize = if ($script:hasAtomicRpc) { 40 } else { 10 }
    if (-not $forceFull -and $targetFinPonds.Count -gt 0) {
        for ($i = 0; $i -lt $targetFinPonds.Count; $i += $finSliceSize) {
            $pSlice = @($targetFinPonds[$i..[Math]::Min($i + $finSliceSize - 1, $targetFinPonds.Count - 1)])
            $inStr = ($pSlice | ForEach-Object { [System.Uri]::EscapeDataString($_) }) -join ","
            $finRes = Get-AllFromSupabase "$supabaseUrl/rest/v1/growout_pond_finance?select=pond_index,revenue,total_cost,gross_profit,ebitda&pond_index=in.($inStr)"
            foreach ($fr in $finRes) {
                if ($fr.pond_index) {
                    $existingFinanceSigs.Add("$($fr.pond_index)|$(Format-CanonicalValue $fr.revenue)|$(Format-CanonicalValue $fr.total_cost)|$(Format-CanonicalValue $fr.gross_profit)|$(Format-CanonicalValue $fr.ebitda)") | Out-Null
                }
            }
        }
    }

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

    while ($reader.Read()) {
        $pIdx = SafeString $reader["Pond No"]
        if (-not $pIdx) { continue }

        if (-not $forceFull -and -not $recentMasterSet.Contains($pIdx)) {
            continue
        }

        $finRev = SafeDecimal $reader["Revenue"]
        $finCost = SafeDecimal $reader["Total Cost"]
        $finGp = SafeDecimal $reader["Gross Profit"]
        $finEbitda = SafeDecimal $reader["EBITDA"]
        $finSig = "${pIdx}|$(Format-CanonicalValue $finRev)|$(Format-CanonicalValue $finCost)|$(Format-CanonicalValue $finGp)|$(Format-CanonicalValue $finEbitda)"

        # Skip if already identical in growout_pond_finance (unless -forceFull is set)
        if (-not $forceFull -and $existingFinanceSigs.Contains($finSig)) {
            continue
        }

        $financeBatch += [ordered]@{
            pond_index                      = $pIdx
            revenue                         = SafeDecimal $reader["Revenue"]
            premium_pct                     = SafeDecimal $reader["Premium"]
            small_pct                       = SafeDecimal $reader["Small"]
            cons_of_fries                   = SafeDecimal $reader["Cons Of Fries"]
            cons_of_feed                    = SafeDecimal $reader["Cons Of Feed"]
            cons_of_chem_fert               = SafeDecimal $reader["Cons Of Chem Fert"]
            cons_of_supplies                = SafeDecimal $reader["Cons Of Supplies"]
            wages_direct                    = SafeDecimal $reader["Wages Benefits (Direct)"]
            wages_indirect                  = SafeDecimal $reader["Wages Benefits (Indirect)"]
            electricity                     = SafeDecimal $reader["Electricity"]
            repair_maintenance              = SafeDecimal $reader["Repair Maintenance"]
            consultant                      = SafeDecimal $reader["Consultant"]
            rental                          = SafeDecimal $reader["Rental"]
            travel_entertainment            = SafeDecimal $reader["Travel Entertainment"]
            training_seminar                = SafeDecimal $reader["Training Seminar"]
            depreciation_fc                 = SafeDecimal $reader["Depreciation Fc"]
            harvest_expenses                = SafeDecimal $reader["Harvest Expenses"]
            security_charges                = SafeDecimal $reader["Security Charges"]
            other_utilities_ins             = SafeDecimal $reader["Other UtilitiesIns"]
            other_charges                   = SafeDecimal $reader["Other Charges"]
            total_cost                      = SafeDecimal $reader["Total Cost"]
            gross_profit                    = SafeDecimal $reader["Gross Profit"]
            sag                             = SafeDecimal $reader["SAG"]
            ebit                            = SafeDecimal $reader["EBIT"]
            depreciation_with_sag           = SafeDecimal $reader["Depreciation with SAG"]
            ebitda                          = SafeDecimal $reader["EBITDA"]
            ytd_sag                         = SafeDecimal $reader["YTD SAG"]
            ytd_sag_annualised              = SafeDecimal $reader["YTD SAG Annualised"]
            cost_per_kg                     = SafeDecimal $reader["Cost per kg"]
            cash_cost_per_kg                = SafeDecimal $reader["Cash Cost per kg"]
            total_cost_per_kg_with_sag      = SafeDecimal $reader["Total Cost per kg with SAG"]
            total_cash_cost_per_kg_with_sag = SafeDecimal $reader["Total Cash Cost per kg with SAG"]
            depreciation_sag_per_pond       = SafeDecimal $reader["Depreciation SAG per pond"]
            ytd_sag_depreciation            = SafeDecimal $reader["YTD SAG Depreciation"]
            ytd_sag_depreciation_annualised = SafeDecimal $reader["YTD SAG Depreciation Annualised"]
            revenue_per_kg                  = SafeDecimal $reader["Revenue per kg"]
            updated_at                      = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss+08:00")
        }
        $newFinanceCount++
    }
    $reader.Close()

    if ($financeBatch.Count -gt 0) {
        Post-BatchToSupabase "growout_pond_finance" $financeBatch "pond_index"
    }
    Write-Output "  [OK] Synchronized $newFinanceCount changed/new financial ledgers in growout_pond_finance (total tracked: $($existingFinanceSigs.Count))."
    Complete-Stage 12
} else {
    Write-Output "  [RESUME] Stage 12 already completed in current checkpoint."
}

$conn.Close()

# -------------------------------------------------------------
# POST-SYNC INTEGRITY & CLOUD COUNT VERIFICATION
# -------------------------------------------------------------
Write-Output ""
Write-Output "[VERIFY] Running Post-Sync Cloud Integrity Check..."
foreach ($tbl in @("growout_pond_master", "pond_stocking_batches", "pond_harvest_daily", "pond_harvest_sales", "pond_issues", "biometrics_sampling")) {
    try {
        $cntHeaders = @{
            "apikey"            = $supabaseKey
            "Authorization"     = "Bearer $supabaseKey"
            "Prefer"            = "count=exact"
            "Range-Unit"        = "items"
            "Range"             = "0-0"
            "x-isharp-passcode" = $editorPasscode
        }
        $resp = Invoke-WebRequest -Uri "$supabaseUrl/rest/v1/${tbl}?select=pond_index" -Method Get -Headers $cntHeaders -UseBasicParsing -TimeoutSec 20
        $cr = [string]$resp.Headers["Content-Range"]
        $totalCnt = if ($cr -match '/(\d+)$') { $Matches[1] } else { "OK" }
        Write-Output ("  [PASS] {0,-24} : {1} rows verified in Supabase" -f $tbl, $totalCnt)
    } catch {
        Write-Warning "  [VERIFY] Could not read exact count header for ${tbl}: $($_.Exception.Message)"
    }
}

# Clear checkpoint upon 100% completion
if (Test-Path $checkpointPath) {
    Remove-Item $checkpointPath -Force -ErrorAction SilentlyContinue
}

# -------------------------------------------------------------
# AUTOMATED DAILY POND PROGRESS SYNC TRIGGER
# -------------------------------------------------------------
$dailySyncScript = Join-Path $PSScriptRoot "sync_daily_pond_progress.ps1"
if (Test-Path $dailySyncScript) {
    Write-Output ""
    Write-Output "[POST-SYNC] Invoking Daily Pond Progress Sync Engine (Excel -> Supabase)..."
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dailySyncScript -supabaseUrl $supabaseUrl -supabaseKey $supabaseKey -editorPasscode $editorPasscode
    } catch {
        Write-Warning "Daily Pond Progress Sync encountered a warning: $($_.Exception.Message)"
    }
}

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
