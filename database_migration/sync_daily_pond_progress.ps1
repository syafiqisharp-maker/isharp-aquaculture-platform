<#
.SYNOPSIS
    iSHARP DBMS 2.0 — Daily Pond Progress & Event Sync Engine (Excel -> Supabase)
    Reads daily status and event progress from the OneDrive Excel mapping workbook,
    normalizes event stages, clamps days in status, and upserts to Supabase cloud.

.DESCRIPTION
    Source File:
        "C:\Users\syafiq\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\240811 Daily Status Daily Mapping rev2 (version 1)-isharp.xlsx"
        Sheet: "Data-Input", Rows 3..218 (216 Ponds)

    Lock-Safety:
        Automatically creates a temp snapshot copy before opening to prevent
        PermissionError when the workbook is actively open by the farm team in Excel.

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
Write-Output "  Source: Daily Status Daily Mapping Workbook (Data-Input)"
Write-Output "  Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Output "=========================================================="

# 1. Locate Daily Status Excel File
if (-not $excelPath -or -not (Test-Path $excelPath)) {
    $searchPaths = @(
        "C:\Users\syafiq\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\240811 Daily Status Daily Mapping rev2 (version 1)-isharp.xlsx",
        "C:\Users\$env:USERNAME\OneDrive - BLUE ARCHIPELAGO BERHAD\Shared Documents - iSHARP Data Management Team\iSharp Data\240811 Daily Status Daily Mapping rev2 (version 1)-isharp.xlsx",
        (Join-Path $PSScriptRoot "240811 Daily Status Daily Mapping rev2 (version 1)-isharp.xlsx")
    )
    foreach ($path in $searchPaths) {
        if (Test-Path $path) {
            $excelPath = $path
            break
        }
    }
}

if (-not $excelPath -or -not (Test-Path $excelPath)) {
    throw "Daily status Excel workbook not found. Please verify OneDrive sync or provide -excelPath."
}

Write-Output "Using Source File: $excelPath"
$fileItem = Get-Item $excelPath
Write-Output "File Size: $([math]::Round($fileItem.Length / 1MB, 2)) MB | Last Modified: $($fileItem.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"

# 2. Lock-Safe Snapshot Copy (Bypasses active Excel editing locks)
$tempExcel = Join-Path $env:TEMP "isharp_daily_status_sync_$([System.Guid]::NewGuid().ToString('N')).xlsx"
$tempJson  = Join-Path $env:TEMP "isharp_daily_status_payload_$([System.Guid]::NewGuid().ToString('N')).json"

try {
    Write-Output "Creating lock-safe snapshot in temp directory..."
    Copy-Item -Path $excelPath -Destination $tempExcel -Force

    # 3. Python Extraction Engine
    Write-Output "Parsing 216 ponds and milestone dates via Python openpyxl..."
    $pyScript = @"
import os, sys, datetime, json
try:
    import openpyxl
except ImportError:
    sys.stderr.write('Missing openpyxl. Run pip install openpyxl\n')
    sys.exit(1)

excel_file = sys.argv[1]
output_json = sys.argv[2]

wb = openpyxl.load_workbook(excel_file, read_only=True, data_only=True)
if 'Data-Input' not in wb.sheetnames:
    sys.stderr.write('Sheet Data-Input not found in workbook\n')
    sys.exit(2)

ws = wb['Data-Input']

def fmt_date(val):
    if not val:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.strftime('%Y-%m-%d')
    s = str(val).strip()[:10]
    return s if len(s) == 10 and s[4] == '-' and s[7] == '-' else None

m1_raw = ws['M1'].value
excel_as_of = fmt_date(m1_raw) or datetime.date.today().strftime('%Y-%m-%d')

records = []
for r in ws.iter_rows(min_row=3, max_row=218, values_only=True):
    if not r or len(r) < 2 or not r[1]:
        continue
    pond = str(r[1]).strip()
    if not pond or len(pond) < 7:
        continue
        
    row_no = str(r[0]).strip().zfill(2) if r[0] is not None else pond.split('.')[1]
    module_no = str(r[14]).strip().zfill(2) if len(r) > 14 and r[14] is not None else pond.split('.')[0]
    status_code = str(r[11]).strip() if len(r) > 11 and r[11] is not None else None
    
    raw_days = r[12] if len(r) > 12 else 0
    try:
        days_in_status = max(0, int(round(float(raw_days))))
    except (ValueError, TypeError):
        days_in_status = 0
        
    map_code = str(r[13]).strip() if len(r) > 13 and r[13] is not None else None
    raw_template = str(r[16]).strip() if len(r) > 16 and r[16] is not None else None
    
    d_dt = fmt_date(r[3]) if len(r) > 3 else None
    e_dt = fmt_date(r[4]) if len(r) > 4 else None
    f_dt = fmt_date(r[5]) if len(r) > 5 else None
    g_dt = fmt_date(r[6]) if len(r) > 6 else None
    h_dt = fmt_date(r[7]) if len(r) > 7 else None
    i_dt = fmt_date(r[8]) if len(r) > 8 else None
    j_dt = fmt_date(r[9]) if len(r) > 9 else None
    k_dt = fmt_date(r[10]) if len(r) > 10 else None
    
    bioassay_raw = r[15] if len(r) > 15 else None
    pass_bioassay = bool(bioassay_raw is True or str(bioassay_raw).strip().lower() == 'true')
    bioassay_date = fmt_date(r[18]) if len(r) > 18 else None
    qaqc_date = fmt_date(r[21]) if len(r) > 21 else None
    
    # State Normalization into 7 core states
    template_norm = (raw_template or '').upper()
    if 'READY' in template_norm or (map_code and 'BIOA' in map_code.upper()):
        progress_state = 'READY'
        progress_label = 'Ready for Stocking'
        status_start_date = j_dt or i_dt
    elif 'WATER CULTURE' in template_norm or 'WATER FILLING' in template_norm or status_code in ('Wc', 'Fw'):
        progress_state = 'WATER_CULTURE'
        progress_label = 'Water Culture'
        status_start_date = j_dt or i_dt
    elif 'REPAIRED' in template_norm or 'REPAIR' in template_norm or status_code in ('Rw', 'RW', 'Rp'):
        progress_state = 'REPAIRED'
        progress_label = 'Repaired'
        status_start_date = h_dt or g_dt
    elif 'CLEANED' in template_norm or status_code == 'Cr':
        progress_state = 'CLEANED'
        progress_label = 'Cleaned'
        status_start_date = f_dt or e_dt
    elif 'CLEANING' in template_norm or status_code == 'Cp':
        progress_state = 'CLEANING'
        progress_label = 'Cleaning'
        status_start_date = e_dt
    elif 'CULTURE' in template_norm or status_code == 'Opr':
        progress_state = 'CULTURE'
        progress_label = 'Culture'
        status_start_date = k_dt
    else:
        progress_state = 'IDLE'
        progress_label = 'Idle'
        status_start_date = d_dt
        
    records.append({
        'pond': pond,
        'module_no': module_no,
        'row_no': row_no,
        'status_code': status_code,
        'raw_template_status': raw_template,
        'progress_state': progress_state,
        'progress_label': progress_label,
        'days_in_status': days_in_status,
        'map_code': map_code,
        'status_start_date': status_start_date,
        'last_harvest_date': d_dt,
        'clean_progress_date': e_dt,
        'cleaning_done_date': f_dt,
        'repair_progress_date': g_dt,
        'repair_done_date': h_dt,
        'filled_water_date': i_dt,
        'water_treat_date': j_dt,
        'stocking_date': k_dt,
        'pass_bioassay': pass_bioassay,
        'bioassay_date': bioassay_date,
        'qaqc_date': qaqc_date,
        'excel_as_of_date': excel_as_of
    })

wb.close()

with open(output_json, 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False)
"@

    $tempPyScript = Join-Path $env:TEMP "extract_daily_status_$([System.Guid]::NewGuid().ToString('N')).py"
    Set-Content -Path $tempPyScript -Value $pyScript -Encoding UTF8

    try {
        & python $tempPyScript $tempExcel $tempJson
        if ($LASTEXITCODE -ne 0) {
            throw "Python extraction failed with exit code $LASTEXITCODE"
        }
    } finally {
        if (Test-Path $tempPyScript) { Remove-Item $tempPyScript -Force -ErrorAction SilentlyContinue }
    }

    if (-not (Test-Path $tempJson)) {
        throw "Extraction output JSON was not created."
    }

    $rawJson = Get-Content -Path $tempJson -Raw -Encoding UTF8
    $records = ConvertFrom-Json $rawJson
    Write-Output "Successfully extracted $($records.Count) pond records from Excel (As of: $($records[0].excel_as_of_date))."

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
    # 6. Cleanup Temporary Snapshot Files
    if (Test-Path $tempExcel) { Remove-Item $tempExcel -Force -ErrorAction SilentlyContinue }
    if (Test-Path $tempJson)  { Remove-Item $tempJson -Force -ErrorAction SilentlyContinue }
}
