$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

Write-Host "=== 1. MONODON PONDS STOCKED BY MONTH (ALL YEARS 2018-2026) ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT 
    MONTH([date cycle]) AS StckMonth, 
    COUNT(*) AS MonodonPonds, 
    AVG([stock density]) AS AvgDensity, 
    AVG([final kg]) AS AvgKg,
    AVG([final sr]) AS AvgSR
FROM GrowoutPondFinal 
WHERE [stock species] LIKE '%MONODON%' AND YEAR([date cycle]) >= 2018 AND [date cycle] IS NOT NULL
GROUP BY MONTH([date cycle]) 
ORDER BY MONTH([date cycle])
"@
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Host ("Month {0,2}: Ponds={1,4}, AvgDensity={2,5:N1}, AvgSR={3,5:N1}%, AvgKg={4,7:N0}" -f $r["StckMonth"], $r["MonodonPonds"], $r["AvgDensity"], $r["AvgSR"], $r["AvgKg"])
}
$r.Close()

Write-Host "`n=== 2. MONODON PONDS STOCKED BY YEAR AND MONTH (2021-2026) ==="
$cmd.CommandText = @"
SELECT 
    YEAR([date cycle]) AS StckYear, 
    MONTH([date cycle]) AS StckMonth, 
    COUNT(*) AS MonodonPonds
FROM GrowoutPondFinal 
WHERE [stock species] LIKE '%MONODON%' AND YEAR([date cycle]) >= 2021 AND [date cycle] IS NOT NULL
GROUP BY YEAR([date cycle]), MONTH([date cycle]) 
ORDER BY YEAR([date cycle]), MONTH([date cycle])
"@
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Host ("Year {0}, Month {1,2}: {2,3} ponds" -f $r["StckYear"], $r["StckMonth"], $r["MonodonPonds"])
}
$r.Close()

Write-Host "`n=== 3. MONODON SUCCESS RATE / KG BY MONTH ==="
$cmd.CommandText = @"
SELECT 
    MONTH([date cycle]) AS StckMonth, 
    COUNT(*) AS TotalMonodon,
    SUM(IIF([final status] = 'NORMAL HARVEST', 1, 0)) AS NormalCount,
    SUM(IIF([final status] = 'FORCED HARVEST' OR [final status] = 'CULLED POND', 1, 0)) AS FailCount,
    AVG([final sr]) AS AvgSR,
    AVG([final abw]) AS AvgABW,
    AVG([final kg]) AS AvgKg
FROM GrowoutPondFinal 
WHERE [stock species] LIKE '%MONODON%' AND YEAR([date cycle]) >= 2018 AND [date cycle] IS NOT NULL
GROUP BY MONTH([date cycle]) 
ORDER BY MONTH([date cycle])
"@
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    $pct = 0
    if ($r["TotalMonodon"] -gt 0) { $pct = ($r["NormalCount"] / $r["TotalMonodon"]) * 100 }
    Write-Host ("Month {0,2}: Total={1,3}, Normal={2,3}, Fail={3,3}, SuccessRate={4,5:N1}%, AvgSR={5,5:N1}%, AvgKg={6,6:N0}" -f $r["StckMonth"], $r["TotalMonodon"], $r["NormalCount"], $r["FailCount"], $pct, $r["AvgSR"], $r["AvgKg"])
}
$r.Close()

Write-Host "`n=== 4. MODULE 2 STATUS IN 2026 (ACTIVE & RECENT PONDS) ==="
$cmd.CommandText = @"
SELECT 
    [pond], 
    [date cycle] AS StckDate, 
    [final harvest date] AS HarvDate, 
    [stock species] AS Species,
    [final doc] AS DOC,
    [final status] AS FStatus
FROM GrowoutPondFinal 
WHERE MID([pond], 4, 2) = '02' AND YEAR([date cycle]) >= 2025
ORDER BY [pond], [date cycle]
"@
$r = $cmd.ExecuteReader()
$count = 0
while ($r.Read() -and $count -lt 30) {
    Write-Host ("Pond {0}: Stck={1:yyyy-MM-dd}, Harv={2:yyyy-MM-dd}, {3}, DOC={4}, Status={5}" -f $r["pond"], $r["StckDate"], $r["HarvDate"], $r["Species"], $r["DOC"], $r["FStatus"])
    $count++
}
$r.Close()

$conn.Close()
