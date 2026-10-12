param(
    [string]$jsonPath = "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\new_pond_staff_payload.json"
)

$ErrorActionPreference = "Stop"

$supabaseUrl = "https://keappoukeagyzpoxkrru.supabase.co"
$supabaseKey = "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s"

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json; charset=utf-8"
}

Write-Output "=== 1. REMOVING 24 INACTIVE / OUTDATED STAFF FROM SUPABASE ==="
$idsToRemove = @(
    '2572', '1691', '2490', '2256', '1398', '0948', '0955', '1720', 
    '1898', '2388', '1617', '2305', '2582', '2617', '0400', '1140', 
    '0418', '0801', '2463', '2357', '2588', '2589', '1497', '1494'
)

$deletedCount = 0
foreach ($id in $idsToRemove) {
    try {
        $delUri = "$supabaseUrl/rest/v1/pond_staff?staff_no=eq.$id"
        $null = Invoke-RestMethod -Uri $delUri -Method Delete -Headers $headers -TimeoutSec 30
        $deletedCount++
    } catch {
        Write-Warning "Could not delete staff_no ${id}: $($_.Exception.Message)"
    }
}
Write-Output "Successfully removed $deletedCount staff records."

Write-Output "`n=== 2. UPSERTING 121 VERIFIED STAFF FROM HR EXCEL (WITH ZERO PADDING) ==="
$headersUpsert = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json; charset=utf-8"
    "Prefer" = "resolution=merge-duplicates"
}

$rawJson = Get-Content -Path $jsonPath -Raw -Encoding utf8
$uriUpsert = "$supabaseUrl/rest/v1/pond_staff?on_conflict=staff_no"
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($rawJson)

$null = Invoke-RestMethod -Uri $uriUpsert -Method Post -Headers $headersUpsert -Body $bodyBytes -TimeoutSec 60
Write-Output "Successfully upserted 121 staff records into public.pond_staff!"

Write-Output "`n=== 3. VERIFYING TOTAL COUNT IN SUPABASE ==="
$verifyData = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/pond_staff?select=staff_no,staff_name,staff_position&order=staff_no.asc" -Method Get -Headers $headers
Write-Output "Current total active staff count in Supabase: $($verifyData.Count)"
