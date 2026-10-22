$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

Write-Host "================================================================="
Write-Host "1. HISTORICAL MONTHLY STOCKING DISTRIBUTION (2018-2026)"
Write-Host "================================================================="
$sqlMonthly = @"
SELECT 
    MONTH([date cycle]) AS StckMonth,
    COUNT(*) AS TotalPonds,
    SUM(IIF([stock species] LIKE '%MONODON%', 1, 0)) AS MonodonPonds,
    SUM(IIF([stock species] LIKE '%VANNAMEI%', 1, 0)) AS VannameiPonds,
    AVG([stock density]) AS AvgDensity,
    AVG([final sr]) AS AvgSR,
    AVG([final kg]) AS AvgKg
FROM GrowoutPondFinal
WHERE [date cycle] IS NOT NULL AND YEAR([date cycle]) >= 2018
GROUP BY MONTH([date cycle])
ORDER BY MONTH([date cycle])
"@
$cmd = $conn.CreateCommand()
$cmd.CommandText = $sqlMonthly
$r = $cmd.ExecuteReader()
Write-Host ("Month | Total Ponds | Avg/Year | Monodon | Vannamei | AvgDensity | AvgSR% | AvgKg")
Write-Host ("------+-------------+----------+---------+----------+------------+--------+-------")
while ($r.Read()) {
    $m = $r["StckMonth"]
    $tot = $r["TotalPonds"]
    $perYr = $tot / 8.5 # 2018 to mid-2026 ~ 8.5 years
    $mono = $r["MonodonPonds"]
    $van = $r["VannameiPonds"]
    $dens = $r["AvgDensity"]
    $sr = $r["AvgSR"]
    $kg = $r["AvgKg"]
    Write-Host ("{0,5} | {1,11} | {2,8:N1} | {3,7} | {4,8} | {5,10:N1} | {6,5:N1}% | {7,6:N0}" -f $m, $tot, $perYr, $mono, $van, $dens, $sr, $kg)
}
$r.Close()

Write-Host "`n================================================================="
Write-Host "2. RECENT 5-YEAR MONTHLY STOCKING BREAKDOWN (2021-2025 ANNUAL AVG)"
Write-Host "================================================================="
$sqlRecentMonthly = @"
SELECT 
    YEAR([date cycle]) AS StckYear,
    MONTH([date cycle]) AS StckMonth,
    COUNT(*) AS TotalPonds,
    SUM(IIF([stock species] LIKE '%MONODON%', 1, 0)) AS MonodonPonds,
    SUM(IIF([stock species] LIKE '%VANNAMEI%', 1, 0)) AS VannameiPonds
FROM GrowoutPondFinal
WHERE [date cycle] IS NOT NULL AND YEAR([date cycle]) BETWEEN 2021 AND 2025
GROUP BY YEAR([date cycle]), MONTH([date cycle])
ORDER BY YEAR([date cycle]), MONTH([date cycle])
"@
$cmd.CommandText = $sqlRecentMonthly
$r = $cmd.ExecuteReader()
$monthlyTotals = @{}
$monthlyMono = @{}
$monthlyVan = @{}
for ($i = 1; $i -le 12; $i++) {
    $monthlyTotals[$i] = @()
    $monthlyMono[$i] = @()
    $monthlyVan[$i] = @()
}
while ($r.Read()) {
    $m = [int]$r["StckMonth"]
    $monthlyTotals[$m] += [int]$r["TotalPonds"]
    $monthlyMono[$m] += [int]$r["MonodonPonds"]
    $monthlyVan[$m] += [int]$r["VannameiPonds"]
}
$r.Close()

Write-Host ("Month | Avg Total/Mo | Min Total | Max Total | Avg Monodon/Mo | Avg Vannamei/Mo")
Write-Host ("------+--------------+-----------+-----------+----------------+-----------------")
for ($i = 1; $i -le 12; $i++) {
    $totArr = $monthlyTotals[$i]
    $monoArr = $monthlyMono[$i]
    $vanArr = $monthlyVan[$i]
    $avgTot = ($totArr | Measure-Object -Average).Average
    $minTot = ($totArr | Measure-Object -Minimum).Minimum
    $maxTot = ($totArr | Measure-Object -Maximum).Maximum
    $avgMono = ($monoArr | Measure-Object -Average).Average
    $avgVan = ($vanArr | Measure-Object -Average).Average
    Write-Host ("{0,5} | {1,12:N1} | {2,9} | {3,9} | {4,14:N1} | {5,15:N1}" -f $i, $avgTot, $minTot, $maxTot, $avgMono, $avgVan)
}

Write-Host "`n================================================================="
Write-Host "3. MODULE-BY-MONTH STOCKING MATRIX (2018-2026, PONDS STOCKED)"
Write-Host "================================================================="
$sqlModMonth = @"
SELECT 
    MID([pond], 4, 2) AS ModKey,
    MONTH([date cycle]) AS StckMonth,
    COUNT(*) AS Ponds
FROM GrowoutPondFinal
WHERE [date cycle] IS NOT NULL AND YEAR([date cycle]) >= 2018 AND MID([pond], 4, 2) IN ('01','02','03','04','05','06','07','08','09')
GROUP BY MID([pond], 4, 2), MONTH([date cycle])
ORDER BY MID([pond], 4, 2), MONTH([date cycle])
"@
$cmd.CommandText = $sqlModMonth
$r = $cmd.ExecuteReader()
$modMatrix = @{}
while ($r.Read()) {
    $mod = $r["ModKey"]
    $m = [int]$r["StckMonth"]
    $p = [int]$r["Ponds"]
    if (-not $modMatrix.ContainsKey($mod)) {
        $modMatrix[$mod] = @{}
    }
    $modMatrix[$mod][$m] = $p
}
$r.Close()

$header = "Module | " + (1..12 | ForEach-Object { "{0,4}" -f $_ }) -join " " + " | Total"
Write-Host $header
Write-Host ("-" * $header.Length)
foreach ($mod in ('01','02','03','04','05','06','07','08','09')) {
    $rowTot = 0
    $vals = 1..12 | ForEach-Object {
        $v = if ($modMatrix[$mod].ContainsKey($_)) { $modMatrix[$mod][$_] } else { 0 }
        $rowTot += $v
        "{0,4}" -f $v
    }
    Write-Host ("  {0,2}   | {1} | {2,5}" -f $mod, ($vals -join " "), $rowTot)
}

Write-Host "`n================================================================="
Write-Host "4. POND IDLE TIME (DOP) DISTRIBUTION ANALYSIS"
Write-Host "================================================================="
$sqlDOP = @"
SELECT 
    a.[pond],
    a.[date cycle] AS StckDate2,
    b.[final harvest date] AS HarvDate1,
    DateDiff('d', b.[final harvest date], a.[date cycle]) AS IdleDays
FROM GrowoutPondFinal a
INNER JOIN GrowoutPondFinal b ON a.[pond] = b.[pond] 
    AND b.[final harvest date] < a.[date cycle]
    AND b.[final harvest date] IS NOT NULL
    AND a.[date cycle] IS NOT NULL
    AND YEAR(a.[date cycle]) >= 2018
"@
$cmd.CommandText = $sqlDOP
$r = $cmd.ExecuteReader()
$idleList = @()
# Keep closest previous cycle
$closestMap = @{}
while ($r.Read()) {
    $p = $r["pond"]
    $sDate = $r["StckDate2"]
    $days = [int]$r["IdleDays"]
    if ($days -ge 14 -and $days -le 365) {
        $key = "$p::$sDate"
        if (-not $closestMap.ContainsKey($key) -or $days -lt $closestMap[$key]) {
            $closestMap[$key] = $days
        }
    }
}
$r.Close()
$idleList = $closestMap.Values | Sort-Object

if ($idleList.Count -gt 0) {
    $count = $idleList.Count
    $avgIdle = ($idleList | Measure-Object -Average).Average
    $p10 = $idleList[[int]($count * 0.10)]
    $p25 = $idleList[[int]($count * 0.25)]
    $p50 = $idleList[[int]($count * 0.50)]
    $p75 = $idleList[[int]($count * 0.75)]
    $p90 = $idleList[[int]($count * 0.90)]
    Write-Host ("Total Transitions Analyzed: {0}" -f $count)
    Write-Host ("Mean Idle Days: {0:N1} days" -f $avgIdle)
    Write-Host ("10th Percentile: {0} days" -f $p10)
    Write-Host ("25th Percentile: {0} days" -f $p25)
    Write-Host ("50th Percentile (Median): {0} days" -f $p50)
    Write-Host ("75th Percentile: {0} days" -f $p75)
    Write-Host ("90th Percentile: {0} days" -f $p90)
    
    # Bucket distribution
    $b_under30 = ($idleList | Where-Object { $_ -lt 30 }).Count
    $b_30_45   = ($idleList | Where-Object { $_ -ge 30 -and $_ -le 45 }).Count
    $b_46_60   = ($idleList | Where-Object { $_ -gt 45 -and $_ -le 60 }).Count
    $b_61_90   = ($idleList | Where-Object { $_ -gt 60 -and $_ -le 90 }).Count
    $b_over90  = ($idleList | Where-Object { $_ -gt 90 }).Count
    Write-Host ("`nIdle Days Buckets:")
    Write-Host ("  < 30 days (Rushed):           {0,4} ({1,4:N1}%)" -f $b_under30, ($b_under30/$count*100))
    Write-Host ("  30 - 45 days (Optimal Rest):   {0,4} ({1,4:N1}%)" -f $b_30_45, ($b_30_45/$count*100))
    Write-Host ("  46 - 60 days (Extended Rest):  {0,4} ({1,4:N1}%)" -f $b_46_60, ($b_46_60/$count*100))
    Write-Host ("  61 - 90 days (Long Idle):      {0,4} ({1,4:N1}%)" -f $b_61_90, ($b_61_90/$count*100))
    Write-Host ("  > 90 days (Excessive Idle):    {0,4} ({1,4:N1}%)" -f $b_over90, ($b_over90/$count*100))
}

$conn.Close()
