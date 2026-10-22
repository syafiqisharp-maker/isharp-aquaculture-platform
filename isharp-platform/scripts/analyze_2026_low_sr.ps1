$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

Write-Host "=========================================================="
Write-Host "1. 2026 PERFORMANCE BY MODULE (M01 - M09)"
Write-Host "=========================================================="
$sqlMod = @"
SELECT 
    MID(f.PondIndex, 2, 2) AS ModKey,
    COUNT(*) AS ClosedCycles,
    ROUND(AVG(f.doc), 1) AS AvgDOC,
    ROUND(AVG(f.sr), 1) AS AvgSR,
    ROUND(AVG(f.adg), 3) AS AvgADG,
    ROUND(AVG(f.fcr), 2) AS AvgFCR,
    ROUND(AVG(f.yield), 0) AS AvgYieldKg,
    ROUND(AVG(f.Ebitda), 0) AS AvgEBITDA,
    SUM(IIF(f.FinalStatus LIKE '%FORCED%' OR f.FinalStatus LIKE '%CULL%' OR f.Action LIKE '%FORCED%' OR f.Action LIKE '%CULL%', 1, 0)) AS ForcedOrCulledPonds
FROM GrowoutPondFinal f
WHERE YEAR(f.date_close) = 2026
GROUP BY MID(f.PondIndex, 2, 2)
ORDER BY MID(f.PondIndex, 2, 2)
"@
$cmd = New-Object System.Data.OleDb.OleDbCommand($sqlMod, $conn)
$da = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dtMod = New-Object System.Data.DataTable
$da.Fill($dtMod) | Out-Null
$dtMod | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=========================================================="
Write-Host "2. 2026 PERFORMANCE BY MODULE AND SPECIES"
Write-Host "=========================================================="
$sqlModSpcs = @"
SELECT 
    MID(f.PondIndex, 2, 2) AS ModKey,
    IIF(f.Spcs LIKE '%MONODON%' OR f.BSLine LIKE '%MONODON%' OR f.BSLine LIKE '%CP THAI%' OR f.BSLine LIKE '%MOANA%' OR f.BSLine LIKE '%MADAGASCAR%' OR f.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI') AS Species,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.sr), 1) AS AvgSR,
    ROUND(AVG(f.adg), 3) AS AvgADG,
    ROUND(AVG(f.fcr), 2) AS AvgFCR,
    ROUND(AVG(f.yield), 0) AS AvgYieldKg,
    ROUND(AVG(f.Ebitda), 0) AS AvgEBITDA,
    ROUND(SUM(IIF(f.FinalStatus LIKE '%FORCED%' OR f.FinalStatus LIKE '%CULL%' OR f.Action LIKE '%FORCED%' OR f.Action LIKE '%CULL%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.date_close) = 2026
GROUP BY 
    MID(f.PondIndex, 2, 2),
    IIF(f.Spcs LIKE '%MONODON%' OR f.BSLine LIKE '%MONODON%' OR f.BSLine LIKE '%CP THAI%' OR f.BSLine LIKE '%MOANA%' OR f.BSLine LIKE '%MADAGASCAR%' OR f.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI')
ORDER BY MID(f.PondIndex, 2, 2), Species
"@
$cmd2 = New-Object System.Data.OleDb.OleDbCommand($sqlModSpcs, $conn)
$da2 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd2)
$dtModSpcs = New-Object System.Data.DataTable
$da2.Fill($dtModSpcs) | Out-Null
$dtModSpcs | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=========================================================="
Write-Host "3. 2026 PERFORMANCE BY HATCHERY SOURCE & TANK MIXING"
Write-Host "=========================================================="
$sqlHatch = @"
SELECT 
    f.StckSource,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.sr), 1) AS AvgSR,
    ROUND(AVG(f.adg), 3) AS AvgADG,
    ROUND(AVG(f.fcr), 2) AS AvgFCR,
    ROUND(AVG(f.Ebitda), 0) AS AvgEBITDA,
    ROUND(SUM(IIF(f.FinalStatus LIKE '%FORCED%' OR f.FinalStatus LIKE '%CULL%' OR f.Action LIKE '%FORCED%' OR f.Action LIKE '%CULL%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.date_close) = 2026
GROUP BY f.StckSource
HAVING COUNT(*) >= 3
ORDER BY COUNT(*) DESC
"@
$cmd3 = New-Object System.Data.OleDb.OleDbCommand($sqlHatch, $conn)
$da3 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd3)
$dtHatch = New-Object System.Data.DataTable
$da3.Fill($dtHatch) | Out-Null
$dtHatch | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=========================================================="
Write-Host "4. 2026 BROODSTOCK LINE (GENETICS) PERFORMANCE"
Write-Host "=========================================================="
$sqlBS = @"
SELECT 
    f.BSLine,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.sr), 1) AS AvgSR,
    ROUND(AVG(f.adg), 3) AS AvgADG,
    ROUND(AVG(f.Ebitda), 0) AS AvgEBITDA,
    ROUND(SUM(IIF(f.FinalStatus LIKE '%FORCED%' OR f.FinalStatus LIKE '%CULL%' OR f.Action LIKE '%FORCED%' OR f.Action LIKE '%CULL%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.date_close) = 2026
GROUP BY f.BSLine
HAVING COUNT(*) >= 3
ORDER BY COUNT(*) DESC
"@
$cmd4 = New-Object System.Data.OleDb.OleDbCommand($sqlBS, $conn)
$da4 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd4)
$dtBS = New-Object System.Data.DataTable
$da4.Fill($dtBS) | Out-Null
$dtBS | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
