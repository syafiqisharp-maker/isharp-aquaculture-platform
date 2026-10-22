$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
if (-not (Test-Path $dbPath)) {
    $dbPath = "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Legacy Access DB\Bab SGo (r41) 26.10.02.accdb"
}

$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

# 1. Total Cycles by Stock Species and Year
$sqlYearSpecies = @"
SELECT 
    YEAR([date cycle]) AS CycleYear,
    [stock species] AS StockSpecies,
    COUNT(*) AS CycleCount,
    AVG([final doc]) AS AvgDOC,
    AVG([stock density]) AS AvgDensity,
    AVG([final abw]) AS AvgABW,
    AVG([final sr]) AS AvgSR,
    AVG([final kg]) AS AvgKg
FROM GrowoutPondFinal
WHERE [date cycle] IS NOT NULL AND YEAR([date cycle]) >= 2018
GROUP BY 
    YEAR([date cycle]),
    [stock species]
ORDER BY YEAR([date cycle]), [stock species]
"@

$cmd = New-Object System.Data.OleDb.OleDbCommand($sqlYearSpecies, $conn)
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null

Write-Host "=== 1. YEAR BY YEAR STOCK SPECIES BREAKDOWN ==="
$dt | Format-Table -AutoSize | Out-String | Write-Host

# 2. Distinct Stock Species across all records
$sqlSpecies = @"
SELECT DISTINCT [stock species], COUNT(*) AS Cnt
FROM GrowoutPondFinal
GROUP BY [stock species]
ORDER BY COUNT(*) DESC
"@
$cmd2 = New-Object System.Data.OleDb.OleDbCommand($sqlSpecies, $conn)
$adapter2 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd2)
$dt2 = New-Object System.Data.DataTable
$adapter2.Fill($dt2) | Out-Null
Write-Host "=== 2. ALL DISTINCT STOCK SPECIES IN DATABASE ==="
$dt2 | Format-Table -AutoSize | Out-String | Write-Host

# 3. Monodon Breakdown by Module (2020-2026)
$sqlModSpecies = @"
SELECT 
    [module] AS Modl,
    [stock species] AS StockSpecies,
    COUNT(*) AS CycleCount
FROM GrowoutPondFinal
WHERE [date cycle] IS NOT NULL AND YEAR([date cycle]) >= 2020
GROUP BY 
    [module],
    [stock species]
ORDER BY [module], [stock species]
"@
$cmd3 = New-Object System.Data.OleDb.OleDbCommand($sqlModSpecies, $conn)
$adapter3 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd3)
$dt3 = New-Object System.Data.DataTable
$adapter3.Fill($dt3) | Out-Null
Write-Host "=== 3. MODULE BY STOCK SPECIES (2020-2026) ==="
$dt3 | Format-Table -AutoSize | Out-String | Write-Host

# 4. Monodon Stocking Month Distribution
$sqlMonth = @"
SELECT 
    MONTH([date cycle]) AS StockMonth,
    COUNT(*) AS MonodonCycles,
    AVG([final doc]) AS AvgDOC,
    AVG([final sr]) AS AvgSR,
    AVG([final kg]) AS AvgKg
FROM GrowoutPondFinal
WHERE ([stock species] LIKE '%MONODON%' OR [BSLine] LIKE '%MONODON%' OR [BSLine] LIKE '%CP THAI%' OR [BSLine] LIKE '%MOANA%')
  AND YEAR([date cycle]) >= 2020
GROUP BY MONTH([date cycle])
ORDER BY MONTH([date cycle])
"@
$cmd4 = New-Object System.Data.OleDb.OleDbCommand($sqlMonth, $conn)
$adapter4 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd4)
$dt4 = New-Object System.Data.DataTable
$adapter4.Fill($dt4) | Out-Null
Write-Host "=== 4. MONODON STOCKING MONTH DISTRIBUTION (2020+) ==="
$dt4 | Format-Table -AutoSize | Out-String | Write-Host

# 5. Monodon by Module and Year (2022 to 2026)
$sqlYearMod = @"
SELECT 
    YEAR([date cycle]) AS CycleYear,
    [module] AS Modl,
    COUNT(*) AS MonodonCycles
FROM GrowoutPondFinal
WHERE ([stock species] LIKE '%MONODON%' OR [BSLine] LIKE '%MONODON%' OR [BSLine] LIKE '%CP THAI%' OR [BSLine] LIKE '%MOANA%')
  AND YEAR([date cycle]) >= 2022
GROUP BY YEAR([date cycle]), [module]
ORDER BY YEAR([date cycle]), [module]
"@
$cmd5 = New-Object System.Data.OleDb.OleDbCommand($sqlYearMod, $conn)
$adapter5 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd5)
$dt5 = New-Object System.Data.DataTable
$adapter5.Fill($dt5) | Out-Null
Write-Host "=== 5. MONODON BY MODULE AND YEAR (2022-2026) ==="
$dt5 | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
