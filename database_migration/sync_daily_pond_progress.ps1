<#
.SYNOPSIS
    iSHARP DBMS 2.0 — Daily Pond Progress & Event Sync Engine (Excel -> Supabase)
    Zero-Python Native Architecture (Pure PowerShell + Windows Excel COM)
    Reads daily status and event progress from the OneDrive Excel mapping workbook,
    normalizes event stages, clamps days in status, and upserts to Supabase cloud.

.DESCRIPTION
    Supports:
        1. Drag-and-Drop: Drag any Daily Status Excel file onto the .bat launcher.
        2. Auto-Detection: Automatically searches the current folder for the latest
           *Daily Status*.xlsx workbook if double-clicked without dragging.
        3. Zero-Python: Requires NO Python, NO pip, and NO openpyxl. Uses native
           Windows PowerShell and Microsoft Excel COM objects.
        4. Lock-Safety: Creates a temporary snapshot copy before opening to bypass
           active Excel editing locks when the workbook is open by team members.

    Security & RLS:
        Sends "x-isharp-passcode: mantaray" (Editor authorization) and
        "Prefer: resolution=merge-duplicates,return=minimal" to avoid bcrypt doubling
        and prevent statement timeouts.
#>

param(
    [string]$excelPath = "",
    [string]$supabaseUrl = "https://keappoukeagyzpoxkrru.supabase.co",
    [string]$supabaseKey = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s",
    [string]$editorPasscode = "mantaray"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Output "=========================================================="
Write-Output "  iSHARP DAILY POND PROGRESS SYNC (Excel -> Supabase)"
Write-Output "  Zero-Python Native Windows Engine"
Write-Output "  Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="

# 1. Locate Daily Status Excel File (Drag & Drop or Smart Auto-Detection)
if (-not $excelPath -or -not (Test-Path $excelPath)) {
    Write-Output "Scanning folder for Daily Status Excel workbook..."
    
    # Check current directory where script is running
    $localCandidates = @()
    if ($PSScriptRoot -and (Test-Path $PSScriptRoot)) {
        $localCandidates = Get-ChildItem -Path $PSScriptRoot -Filter "*Daily Status*.xlsx" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
    }

    if ($localCandidates -and $localCandidates.Count -gt 0) {
        $excelPath = $localCandidates[0].FullName
    } else {
        # Check standard user OneDrive paths
        $searchPaths = @(
            "C:\Users\$env:USERNAME\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\240811 Daily Status Daily Mapping rev2 (version 1)-isharp.xlsx",
            "C:\Users\syafiq\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\240811 Daily Status Daily Mapping rev2 (version 1)-isharp.xlsx"
        )
        foreach ($p in $searchPaths) {
            if (Test-Path $p) {
                $excelPath = $p
                break
            }
        }
    }
}

if (-not $excelPath -or -not (Test-Path $excelPath)) {
    throw "Daily status Excel workbook not found. Please drag and drop your Excel file onto the .bat launcher, or verify OneDrive sync."
}

Write-Output "Using Source File: $excelPath"
$fileItem = Get-Item $excelPath
Write-Output "File Size: $([math]::Round($fileItem.Length / 1MB, 2)) MB | Last Modified: $($fileItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"

# Helper function to convert Excel dates (serial numbers or strings) to yyyy-MM-dd
function Format-ExcelDate($val) {
    if ($null -eq $val -or "$val".Trim() -eq "") { return $null }
    if ($val -is [double] -or $val -is [int]) {
        if ($val -ge 30000 -and $val -le 75000) {
            try { return [DateTime]::FromOADate([double]$val).ToString('yyyy-MM-dd') } catch { return $null }
        }
    }
    if ($val -is [DateTime]) {
        return $val.ToString('yyyy-MM-dd')
    }
    $str = "$val".Trim()
    if ($str.Length -ge 10 -and $str[4] -eq '-' -and $str[7] -eq '-') {
        return $str.Substring(0, 10)
    }
    return $null
}

# 2. Lock-Safe Snapshot Copy (Bypasses active Excel editing locks)
$tempExcel = Join-Path $env:TEMP "isharp_daily_status_sync_$([System.Guid]::NewGuid().ToString('N')).xlsx"

$excel = $null
$wb = $null
$ws = $null

try {
    Write-Output "Creating lock-safe snapshot in temp directory..."
    Copy-Item -Path $excelPath -Destination $tempExcel -Force

    # 3. Native Windows Excel COM Extraction Engine
    Write-Output "Parsing 216 ponds and milestone dates via Native Excel COM..."
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $false

    $wb = $excel.Workbooks.Open($tempExcel, 0, $true) # Open read-only
    
    # Locate Data-Input worksheet
    $wsFound = $false
    foreach ($sheet in $wb.Sheets) {
        if ($sheet.Name -eq "Data-Input") {
            $ws = $sheet
            $wsFound = $true
            break
        }
    }
    if (-not $wsFound) {
        throw "Worksheet 'Data-Input' was not found in the workbook."
    }

    # Extract As-Of Date from Cell M1
    $m1Raw = $ws.Range("M1").Value2
    $asOfDate = Format-ExcelDate $m1Raw
    if (-not $asOfDate) {
        $m1Text = "$($ws.Range('M1').Text)".Trim()
        $parsedDt = $null
        if ([DateTime]::TryParse($m1Text, [ref]$parsedDt)) {
            $asOfDate = $parsedDt.ToString('yyyy-MM-dd')
        } else {
            $asOfDate = (Get-Date).ToString('yyyy-MM-dd')
        }
    }

    # Read Range A3:V218 in one high-speed COM array read
    $data = $ws.Range("A3:V218").Value2
    $rowCount = $data.GetLength(0)

    $records = [System.Collections.Generic.List[PSObject]]::new()

    for ($r = 1; $r -le $rowCount; $r++) {
        $pondRaw = $data[$r, 2]
        if ($null -eq $pondRaw -or "$pondRaw".Trim() -eq "") { continue }
        $pond = "$pondRaw".Trim()
        if ($pond.Length -lt 7) { continue }

        $split = $pond.Split('.')
        $rowNoRaw = $data[$r, 1]
        $rowNo = if ($null -ne $rowNoRaw -and "$rowNoRaw".Trim() -ne "") { "$rowNoRaw".Trim().PadLeft(2, '0') } else { if ($split.Count -gt 1) { $split[1] } else { "01" } }

        $modRaw = $data[$r, 15]
        $modNo = if ($null -ne $modRaw -and "$modRaw".Trim() -ne "") { "$modRaw".Trim().PadLeft(2, '0') } else { if ($split.Count -gt 0) { $split[0] } else { "01" } }

        $statusCodeRaw = $data[$r, 12]
        $statusCode = if ($null -ne $statusCodeRaw -and "$statusCodeRaw".Trim() -ne "") { "$statusCodeRaw".Trim() } else { $null }

        $rawDays = $data[$r, 13]
        $daysInStatus = 0
        if ($null -ne $rawDays) {
            $parsedDays = 0.0
            if ([double]::TryParse("$rawDays", [ref]$parsedDays)) {
                $daysInStatus = [Math]::Max(0, [int][Math]::Round($parsedDays))
            }
        }

        $mapCodeRaw = $data[$r, 14]
        $mapCode = if ($null -ne $mapCodeRaw -and "$mapCodeRaw".Trim() -ne "") { "$mapCodeRaw".Trim() } else { $null }

        $rawTemplateRaw = $data[$r, 17]
        $rawTemplate = if ($null -ne $rawTemplateRaw -and "$rawTemplateRaw".Trim() -ne "") { "$rawTemplateRaw".Trim() } else { $null }

        $d_dt = Format-ExcelDate $data[$r, 4]
        $e_dt = Format-ExcelDate $data[$r, 5]
        $f_dt = Format-ExcelDate $data[$r, 6]
        $g_dt = Format-ExcelDate $data[$r, 7]
        $h_dt = Format-ExcelDate $data[$r, 8]
        $i_dt = Format-ExcelDate $data[$r, 9]
        $j_dt = Format-ExcelDate $data[$r, 10]
        $k_dt = Format-ExcelDate $data[$r, 11]

        $bioassayRaw = $data[$r, 16]
        $passBioassay = ($null -ne $bioassayRaw -and ("$bioassayRaw".Trim().ToLower() -eq 'true' -or "$bioassayRaw" -eq "1"))
        $bioassayDate = Format-ExcelDate $data[$r, 19]
        $qaqcDate = Format-ExcelDate $data[$r, 22]

        $tmplNorm = if ($rawTemplate) { $rawTemplate.ToUpper() } else { "" }
        $mapNorm  = if ($mapCode) { $mapCode.ToUpper() } else { "" }

        # State Normalization into 7 core states
        if ($tmplNorm.Contains("READY") -or $mapNorm.Contains("BIOA")) {
            $progressState = "READY"
            $progressLabel = "Ready for Stocking"
            $statusStartDate = if ($j_dt) { $j_dt } else { $i_dt }
        } elseif ($tmplNorm.Contains("WATER CULTURE") -or $tmplNorm.Contains("WATER FILLING") -or $statusCode -in @("Wc", "Fw")) {
            $progressState = "WATER_CULTURE"
            $progressLabel = "Water Culture"
            $statusStartDate = if ($j_dt) { $j_dt } else { $i_dt }
        } elseif ($tmplNorm.Contains("REPAIRED") -or $tmplNorm.Contains("REPAIR") -or $statusCode -in @("Rw", "RW", "Rp")) {
            $progressState = "REPAIRED"
            $progressLabel = "Repaired"
            $statusStartDate = if ($h_dt) { $h_dt } else { $g_dt }
        } elseif ($tmplNorm.Contains("CLEANED") -or $statusCode -eq "Cr") {
            $progressState = "CLEANED"
            $progressLabel = "Cleaned"
            $statusStartDate = if ($f_dt) { $f_dt } else { $e_dt }
        } elseif ($tmplNorm.Contains("CLEANING") -or $statusCode -eq "Cp") {
            $progressState = "CLEANING"
            $progressLabel = "Cleaning"
            $statusStartDate = $e_dt
        } elseif ($tmplNorm.Contains("CULTURE") -or $statusCode -eq "Opr") {
            $progressState = "CULTURE"
            $progressLabel = "Culture"
            $statusStartDate = $k_dt
        } else {
            $progressState = "IDLE"
            $progressLabel = "Idle"
            $statusStartDate = $d_dt
        }

        $records.Add([PSCustomObject]@{
            pond                = $pond
            module_no           = $modNo
            row_no              = $rowNo
            status_code         = $statusCode
            raw_template_status = $rawTemplate
            progress_state      = $progressState
            progress_label      = $progressLabel
            days_in_status      = $daysInStatus
            map_code            = $mapCode
            status_start_date   = $statusStartDate
            last_harvest_date   = $d_dt
            clean_progress_date = $e_dt
            cleaning_done_date  = $f_dt
            repair_progress_date= $g_dt
            repair_done_date    = $h_dt
            filled_water_date   = $i_dt
            water_treat_date    = $j_dt
            stocking_date       = $k_dt
            pass_bioassay       = $passBioassay
            bioassay_date       = $bioassayDate
            qaqc_date           = $qaqcDate
            excel_as_of_date    = $asOfDate
        })
    }

    Write-Output "Successfully extracted $($records.Count) pond records from Excel (As of: $asOfDate)."

    # 4. Summary Breakdown
    $grouped = $records | Group-Object progress_label | Sort-Object Count -Descending
    Write-Output "`n--- Daily Status Breakdown ---"
    foreach ($g in $grouped) {
        Write-Output ("  {0,-22} : {1,3} Ponds" -f $g.Name, $g.Count)
    }
    Write-Output "------------------------------`n"

    # 5. Upsert to Supabase in Safe Batches (54 rows per batch = 4 chunks)
    $headers = @{
        "apikey"            = $supabaseKey
        "Authorization"     = "Bearer $supabaseKey"
        "Content-Type"      = "application/json; charset=utf-8"
        "Prefer"            = "resolution=merge-duplicates,return=minimal"
        "x-isharp-passcode" = $editorPasscode
    }

    $uri = "$supabaseUrl/rest/v1/pond_daily_progress?on_conflict=pond"
    $chunkSize = 54
    $totalUpserted = 0

    for ($i = 0; $i -lt $records.Count; $i += $chunkSize) {
        $chunk = $records[$i..[Math]::Min($i + $chunkSize - 1, $records.Count - 1)]
        $chunkJson = ConvertTo-Json -InputObject $chunk -Depth 5 -Compress
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($chunkJson)

        try {
            $null = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $bodyBytes -TimeoutSec 30
            $totalUpserted += $chunk.Count
            Write-Output "Upserted batch ($($i + 1) .. $($i + $chunk.Count)) of $($records.Count) to public.pond_daily_progress."
        } catch {
            $errDetail = $_.Exception.Message
            if ($_.Exception.Response) {
                try {
                    $stream = $_.Exception.Response.GetResponseStream()
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errDetail = $reader.ReadToEnd()
                } catch {}
            }
            throw "Supabase batch upsert failed: $errDetail"
        }
    }

    Write-Output "`n=========================================================="
    Write-Output "  Sync Completed Successfully!"
    Write-Output "  Total Ponds Synchronized: $totalUpserted / $($records.Count)"
    Write-Output "  End Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Output "=========================================================="

} finally {
    # 6. Cleanup COM Objects and Temporary Snapshot Files
    if ($wb) { 
        try { $wb.Close($false) } catch {} 
    }
    if ($excel) { 
        try { $excel.Quit() } catch {} 
    }
    if ($ws)    { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null }
    if ($wb)    { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null }
    if ($excel) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
    
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()

    if (Test-Path $tempExcel) { 
        Remove-Item $tempExcel -Force -ErrorAction SilentlyContinue 
    }
}
