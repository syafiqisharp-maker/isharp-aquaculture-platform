$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

Write-Host "=========================================================="
Write-Host "5. SHT BROODSTOCK BREAKDOWN IN 2026"
Write-Host "=========================================================="
$sql = @"
SELECT 
    f.[stock source] AS Hatchery,
    f.[BSLine] AS Broodstock,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.[final sr]), 1) AS AvgSR,
    ROUND(AVG(f.[final doc]), 1) AS AvgDOC,
    ROUND(SUM(IIF(f.[final status] LIKE '%FORCED%' OR f.[final status] LIKE '%CULL%' OR f.[final status] LIKE '%EARLY%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.[date close]) = 2026 AND f.[stock source] LIKE '%SHT%'
GROUP BY f.[stock source], f.[BSLine]
ORDER BY COUNT(*) DESC
"@
$cmd = New-Object System.Data.OleDb.OleDbCommand($sql, $conn)
$da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$da.Fill($dt) | Out-Null
$dt | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=========================================================="
Write-Host "6. 2026 SPECIES BREAKDOWN (VANNAMEI VS MONODON)"
Write-Host "=========================================================="
$sqlSpcs = @"
SELECT 
    f.[stock species] AS Species,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.[final sr]), 1) AS AvgSR,
    ROUND(AVG(f.[final doc]), 1) AS AvgDOC,
    ROUND(AVG(f.[final adg]), 3) AS AvgADG,
    ROUND(AVG(f.[final kg]), 0) AS AvgYieldKg,
    ROUND(SUM(IIF(f.[final status] LIKE '%FORCED%' OR f.[final status] LIKE '%CULL%' OR f.[final status] LIKE '%EARLY%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.[date close]) = 2026
GROUP BY f.[stock species]
ORDER BY COUNT(*) DESC
"@
$cmd2 = New-Object System.Data.OleDb.OleDbCommand($sqlSpcs, $conn)
$da2 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd2)
$dt2 = New-Object System.Data.DataTable
$da2.Fill($dt2) | Out-Null
$dt2 | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
