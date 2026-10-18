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
Write-Output "  iSHARP ENTERPRISE MIGRATION: GrowoutPondFinance"
Write-Output "  Uploading audited financial cycle records to Supabase Cloud"
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
$connStr = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
try {
    $conn.Open()
} catch {
    $connStr16 = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
    $conn = New-Object System.Data.OleDb.OleDbConnection($connStr16)
    $conn.Open()
}
Write-Output "[OK] Connected to Microsoft Access DB successfully."

# Data Conversion Helpers
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
    if ([string]::IsNullOrWhiteSpace($s)) { return $null }
    return $s.Trim()
}

function Post-BatchToSupabase([string]$endpoint, [array]$batch) {
    $uri = "$supabaseUrl/rest/v1/$endpoint"
    $json = $batch | ConvertTo-Json -Depth 5
    $retryCount = 0
    $maxRetries = 3
    while ($retryCount -lt $maxRetries) {
        try {
            $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $json
            return $resp
        } catch {
            $retryCount++
            $errDetails = $_.Exception.Message
            if ($_.Exception.Response) {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errDetails = $reader.ReadToEnd()
                }
            }
            Write-Warning "Retry $retryCount for $($endpoint): $errDetails"
            Start-Sleep -Seconds 2
        }
    }
    throw "Failed to upload batch to $($endpoint) after $maxRetries retries."
}

# Pre-load existing pond indices from growout_pond_master to ensure valid linkage
Write-Output "Pre-loading pond indices from Supabase..."
$sbPondIndices = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$offset = 0
$limit = 1000
while ($true) {
    $queryUrl = "$supabaseUrl/rest/v1/growout_pond_master?select=pond_index&limit=$limit&offset=$offset"
    try {
        $res = Invoke-RestMethod -Uri $queryUrl -Headers $headers -Method Get
        if (-not $res -or $res.Count -eq 0) { break }
        foreach ($r in $res) {
            if ($r.pond_index) { $sbPondIndices.Add($r.pond_index) | Out-Null }
        }
        $offset += $limit
        if ($res.Count -lt $limit) { break }
    } catch {
        Write-Warning "Failed reading growout_pond_master batch at offset $($offset): $($_.Exception.Message)"
        break
    }
}
Write-Output "Loaded $($sbPondIndices.Count) valid pond cycles from Supabase."

# Read records from Access GrowoutPondFinance
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT 
    [indexNo], [Pond No], [Revenue], [Premium], [Small], 
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
ORDER BY indexNo ASC
"@

Write-Output "Executing Access query on [GrowoutPondFinance]..."
$reader = $cmd.ExecuteReader()
$batch = @()
$totalRead = 0
$totalUploaded = 0

while ($reader.Read()) {
    $totalRead++
    $pIdx = SafeString $reader["Pond No"]
    $idxNo = SafeInt $reader["indexNo"]

    if (-not $pIdx -or -not $idxNo) { continue }

    $batch += [ordered]@{
        index_no = $idxNo
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
    }

    if ($batch.Count -ge 500) {
        Post-BatchToSupabase "growout_pond_finance" $batch
        $totalUploaded += $batch.Count
        Write-Output "  -> Uploaded $totalUploaded / $totalRead records..."
        $batch = @()
    }
}
$reader.Close()

if ($batch.Count -gt 0) {
    Post-BatchToSupabase "growout_pond_finance" $batch
    $totalUploaded += $batch.Count
}

$conn.Close()

Write-Output ""
Write-Output "=========================================================="
Write-Output "  MIGRATION COMPLETED SUCCESSFULLY!"
Write-Output "  Total Access Records Read: $totalRead"
Write-Output "  Total Uploaded to Supabase: $totalUploaded"
Write-Output "  Finish Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="
