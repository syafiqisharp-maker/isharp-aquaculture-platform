$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

Write-Host "=========================================================="
Write-Host "1. 2026 PERFORMANCE BY MODULE (M01 - M09)"
Write-Host "=========================================================="
$sqlMod = @"
SELECT 
    f.[module] AS ModKey,
    COUNT(*) AS ClosedCycles,
    ROUND(AVG(f.[final doc]), 1) AS AvgDOC,
    ROUND(AVG(f.[final sr]), 1) AS AvgSR,
    ROUND(AVG(f.[final adg]), 3) AS AvgADG,
    ROUND(AVG(f.[final fcr]), 2) AS AvgFCR,
    ROUND(AVG(f.[final kg]), 0) AS AvgYieldKg,
    SUM(IIF(f.[final status] LIKE '%FORCED%' OR f.[final status] LIKE '%CULL%' OR f.[final status] LIKE '%EARLY%', 1, 0)) AS ForcedPonds,
    ROUND(SUM(IIF(f.[final status] LIKE '%FORCED%' OR f.[final status] LIKE '%CULL%' OR f.[final status] LIKE '%EARLY%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.[date close]) = 2026
GROUP BY f.[module]
ORDER BY f.[module]
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
    f.[module] AS ModKey,
    IIF(f.[stock species] LIKE '%MONODON%' OR f.[BSLine] LIKE '%MONODON%' OR f.[BSLine] LIKE '%CP THAI%' OR f.[BSLine] LIKE '%MOANA%' OR f.[BSLine] LIKE '%MADAGASCAR%' OR f.[BSLine] LIKE '%KSSB%', 'MONODON', 'VANNAMEI') AS Species,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.[final doc]), 1) AS AvgDOC,
    ROUND(AVG(f.[final sr]), 1) AS AvgSR,
    ROUND(AVG(f.[final adg]), 3) AS AvgADG,
    ROUND(AVG(f.[final fcr]), 2) AS AvgFCR,
    ROUND(AVG(f.[final kg]), 0) AS AvgYieldKg,
    ROUND(SUM(IIF(f.[final status] LIKE '%FORCED%' OR f.[final status] LIKE '%CULL%' OR f.[final status] LIKE '%EARLY%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.[date close]) = 2026
GROUP BY 
    f.[module],
    IIF(f.[stock species] LIKE '%MONODON%' OR f.[BSLine] LIKE '%MONODON%' OR f.[BSLine] LIKE '%CP THAI%' OR f.[BSLine] LIKE '%MOANA%' OR f.[BSLine] LIKE '%MADAGASCAR%' OR f.[BSLine] LIKE '%KSSB%', 'MONODON', 'VANNAMEI')
ORDER BY f.[module], Species
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
    f.[stock source] AS Hatchery,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.[final doc]), 1) AS AvgDOC,
    ROUND(AVG(f.[final sr]), 1) AS AvgSR,
    ROUND(AVG(f.[final adg]), 3) AS AvgADG,
    ROUND(AVG(f.[final fcr]), 2) AS AvgFCR,
    ROUND(AVG(f.[final kg]), 0) AS AvgYieldKg,
    ROUND(SUM(IIF(f.[final status] LIKE '%FORCED%' OR f.[final status] LIKE '%CULL%' OR f.[final status] LIKE '%EARLY%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.[date close]) = 2026
GROUP BY f.[stock source]
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC
"@
$cmd3 = New-Object System.Data.OleDb.OleDbCommand($sqlHatch, $conn)
$da3 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd3)
$dtHatch = New-Object System.Data.DataTable
$da3.Fill($dtHatch) | Out-Null
$dtHatch | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "=========================================================="
Write-Host "4. 2026 HATCHERY DISTRIBUTION ACROSS MODULES"
Write-Host "=========================================================="
$sqlCross = @"
SELECT 
    f.[module] AS ModKey,
    f.[stock source] AS Hatchery,
    COUNT(*) AS Cycles,
    ROUND(AVG(f.[final sr]), 1) AS AvgSR,
    ROUND(SUM(IIF(f.[final status] LIKE '%FORCED%' OR f.[final status] LIKE '%CULL%' OR f.[final status] LIKE '%EARLY%', 1, 0)) * 100.0 / COUNT(*), 1) AS ForcedPct
FROM GrowoutPondFinal f
WHERE YEAR(f.[date close]) = 2026
GROUP BY f.[module], f.[stock source]
ORDER BY f.[module], COUNT(*) DESC
"@
$cmd4 = New-Object System.Data.OleDb.OleDbCommand($sqlCross, $conn)
$da4 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd4)
$dtCross = New-Object System.Data.DataTable
$da4.Fill($dtCross) | Out-Null
$dtCross | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
