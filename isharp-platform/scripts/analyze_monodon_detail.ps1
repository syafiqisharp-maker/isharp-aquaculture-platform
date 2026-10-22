$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

# Monodon by Module and Month (2020+)
$sqlModMonth = @"
SELECT 
    [module] AS Modl,
    MONTH([date cycle]) AS StockMonth,
    COUNT(*) AS MonodonCycles
FROM GrowoutPondFinal
WHERE ([stock species] LIKE '%MONODON%' OR [BSLine] LIKE '%MONODON%' OR [BSLine] LIKE '%CP THAI%' OR [BSLine] LIKE '%MOANA%')
  AND YEAR([date cycle]) >= 2020
GROUP BY [module], MONTH([date cycle])
ORDER BY [module], MONTH([date cycle])
"@

$cmd = New-Object System.Data.OleDb.OleDbCommand($sqlModMonth, $conn)
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null

Write-Host "=== MONODON BY MODULE AND MONTH (2020+) ==="
$dt | Format-Table -AutoSize | Out-String | Write-Host

# Also check Monodon stocking by Year in GrowoutPondMaster for all records (including active)
$sqlMasterSpecies = @"
SELECT 
    YEAR([date cycle]) AS CycleYear,
    [stock species] AS StockSpecies,
    COUNT(*) AS TotalCycles
FROM GrowoutPondMaster
WHERE [date cycle] IS NOT NULL AND YEAR([date cycle]) >= 2020
GROUP BY YEAR([date cycle]), [stock species]
ORDER BY YEAR([date cycle]), [stock species]
"@
$cmd2 = New-Object System.Data.OleDb.OleDbCommand($sqlMasterSpecies, $conn)
$adapter2 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd2)
$dt2 = New-Object System.Data.DataTable
$adapter2.Fill($dt2) | Out-Null
Write-Host "=== MASTER CYCLES (INCLUDING ACTIVE) BY YEAR ==="
$dt2 | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
