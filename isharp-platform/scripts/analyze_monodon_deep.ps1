$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
if (-not (Test-Path $dbPath)) {
    $dbPath = "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Legacy Access DB\Bab SGo (r41) 26.10.02.accdb"
}

$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

# 1. Total PLs and Stockings by Species & Year from GrowoutPondStocking
$sql1 = @"
SELECT 
    YEAR(s.stckdate) AS StockYear,
    IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI') AS ResolvedSpecies,
    COUNT(*) AS TotalBatches,
    SUM(s.stckpcs) AS TotalPLs,
    AVG(s.stckpcs) AS AvgPLsPerBatch
FROM GrowoutPondStocking s
WHERE s.stckdate IS NOT NULL AND YEAR(s.stckdate) >= 2021
GROUP BY 
    YEAR(s.stckdate),
    IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI')
ORDER BY YEAR(s.stckdate), ResolvedSpecies
"@
$cmd1 = New-Object System.Data.OleDb.OleDbCommand($sql1, $conn)
$adapter1 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd1)
$dt1 = New-Object System.Data.DataTable
$adapter1.Fill($dt1) | Out-Null
Write-Host "=== 1. ANNUAL PL PCS & BATCHES BY SPECIES (2021-2026) ==="
$dt1 | Format-Table -AutoSize | Out-String | Write-Host

# 2. Module breakdown of Monodon batches and PLs (2023 - 2026)
$sql2 = @"
SELECT 
    m.modl AS Modl,
    IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI') AS ResolvedSpecies,
    COUNT(*) AS BatchCount,
    SUM(s.stckpcs) AS TotalPLs
FROM GrowoutPondStocking s
INNER JOIN GrowoutPondMaster m ON s.PondIndex = m.PondIndex
WHERE s.stckdate IS NOT NULL AND YEAR(s.stckdate) >= 2023
GROUP BY 
    m.modl,
    IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI')
ORDER BY m.modl, ResolvedSpecies
"@
$cmd2 = New-Object System.Data.OleDb.OleDbCommand($sql2, $conn)
$adapter2 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd2)
$dt2 = New-Object System.Data.DataTable
$adapter2.Fill($dt2) | Out-Null
Write-Host "=== 2. MODULE BY SPECIES BATCHES & PLs (2023-2026) ==="
$dt2 | Format-Table -AutoSize | Out-String | Write-Host

# 4. Check 2025 Monodon Waves: which ponds and modules stocked Monodon together?
$sql4 = @"
SELECT 
    m.modl AS Modl,
    m.row AS RowNo,
    YEAR(s.stckdate) AS Yr,
    MONTH(s.stckdate) AS Mth,
    COUNT(*) AS PondsStocked,
    s.stckspcs,
    s.BSLine,
    MIN(s.stckdate) AS MinDate,
    MAX(s.stckdate) AS MaxDate
FROM GrowoutPondStocking s
INNER JOIN GrowoutPondMaster m ON s.PondIndex = m.PondIndex
WHERE YEAR(s.stckdate) = 2025
  AND (s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%')
GROUP BY m.modl, m.row, YEAR(s.stckdate), MONTH(s.stckdate), s.stckspcs, s.BSLine
ORDER BY MIN(s.stckdate)
"@
$cmd4 = New-Object System.Data.OleDb.OleDbCommand($sql4, $conn)
$adapter4 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd4)
$dt4 = New-Object System.Data.DataTable
$adapter4.Fill($dt4) | Out-Null
Write-Host "=== 4. 2025 MONODON STOCKING EVENTS BY ROW & MODULE ==="
$dt4 | Format-Table -AutoSize | Out-String | Write-Host

# 5. Check 2026 Monodon Waves: which ponds and modules stocked Monodon together?
$sql5 = @"
SELECT 
    m.modl AS Modl,
    m.row AS RowNo,
    YEAR(s.stckdate) AS Yr,
    MONTH(s.stckdate) AS Mth,
    COUNT(*) AS PondsStocked,
    s.stckspcs,
    s.BSLine,
    MIN(s.stckdate) AS MinDate,
    MAX(s.stckdate) AS MaxDate
FROM GrowoutPondStocking s
INNER JOIN GrowoutPondMaster m ON s.PondIndex = m.PondIndex
WHERE YEAR(s.stckdate) = 2026
  AND (s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%')
GROUP BY m.modl, m.row, YEAR(s.stckdate), MONTH(s.stckdate), s.stckspcs, s.BSLine
ORDER BY MIN(s.stckdate)
"@
$cmd5 = New-Object System.Data.OleDb.OleDbCommand($sql5, $conn)
$adapter5 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd5)
$dt5 = New-Object System.Data.DataTable
$adapter5.Fill($dt5) | Out-Null
Write-Host "=== 5. 2026 MONODON STOCKING EVENTS BY ROW & MODULE ==="
$dt5 | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
