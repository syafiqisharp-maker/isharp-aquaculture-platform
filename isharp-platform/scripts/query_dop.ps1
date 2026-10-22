$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

Write-Host "=== POND IDLE DAYS [idle day] DISTRIBUTION (2018-2026) ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT 
    [idle day] AS IdleDay, 
    [preparation day] AS PrepDay,
    [final status] AS FinalStatus,
    [stock species] AS Species
FROM GrowoutPondFinal 
WHERE [idle day] IS NOT NULL AND [idle day] > 0 AND [idle day] <= 365 AND YEAR([date cycle]) >= 2018
ORDER BY [idle day]
"@
$r = $cmd.ExecuteReader()
$idleList = @()
$prepList = @()
while ($r.Read()) {
    $idleList += [int]$r["IdleDay"]
    if ($r["PrepDay"] -ne [DBNull]::Value) {
        $prepList += [int]$r["PrepDay"]
    }
}
$r.Close()

$count = $idleList.Count
if ($count -gt 0) {
    $avgIdle = ($idleList | Measure-Object -Average).Average
    $median = $idleList[[int]($count * 0.50)]
    $p10 = $idleList[[int]($count * 0.10)]
    $p25 = $idleList[[int]($count * 0.25)]
    $p75 = $idleList[[int]($count * 0.75)]
    $p90 = $idleList[[int]($count * 0.90)]
    
    Write-Host ("Total Closed Cycles with Recorded Idle Days: {0}" -f $count)
    Write-Host ("Mean Idle Days:           {0:N1} days" -f $avgIdle)
    Write-Host ("Median Idle Days:         {0} days" -f $median)
    Write-Host ("10th Percentile:          {0} days" -f $p10)
    Write-Host ("25th Percentile:          {0} days" -f $p25)
    Write-Host ("75th Percentile:          {0} days" -f $p75)
    Write-Host ("90th Percentile:          {0} days" -f $p90)
    
    $b_under21 = ($idleList | Where-Object { $_ -lt 21 }).Count
    $b_21_35   = ($idleList | Where-Object { $_ -ge 21 -and $_ -le 35 }).Count
    $b_36_50   = ($idleList | Where-Object { $_ -gt 35 -and $_ -le 50 }).Count
    $b_51_75   = ($idleList | Where-Object { $_ -gt 50 -and $_ -le 75 }).Count
    $b_over75  = ($idleList | Where-Object { $_ -gt 75 }).Count
    
    Write-Host "`nDistribution of Historical Idle Time [idle day]:"
    Write-Host ("  < 21 days (Severely Rushed / Risk): {0,4} ({1,4:N1}%)" -f $b_under21, ($b_under21/$count*100))
    Write-Host ("  21 - 35 days (Fast Turnaround):     {0,4} ({1,4:N1}%)" -f $b_21_35, ($b_21_35/$count*100))
    Write-Host ("  36 - 50 days (Golden Rest Target):   {0,4} ({1,4:N1}%)" -f $b_36_50, ($b_36_50/$count*100))
    Write-Host ("  51 - 75 days (Moderate Buffer):     {0,4} ({1,4:N1}%)" -f $b_51_75, ($b_51_75/$count*100))
    Write-Host ("  > 75 days (Excessive Sitting Idle): {0,4} ({1,4:N1}%)" -f $b_over75, ($b_over75/$count*100))
}

$conn.Close()
