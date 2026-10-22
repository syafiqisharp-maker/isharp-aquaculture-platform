$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

# Check PondStockingBatches by Species and Year
$sqlBatches = @"
SELECT 
    YEAR([stck date]) AS StockYear,
    [stck species] AS StckSpecies,
    COUNT(*) AS BatchCount,
    SUM([stck pcs]) AS TotalPcs
FROM PondStockingBatches
WHERE [stck date] IS NOT NULL AND YEAR([stck date]) >= 2020
GROUP BY YEAR([stck date]), [stck species]
ORDER BY YEAR([stck date]), [stck species]
"@

$cmd = New-Object System.Data.OleDb.OleDbCommand($sqlBatches, $conn)
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null
Write-Host "=== POND STOCKING BATCHES (2020+) ==="
$dt | Format-Table -AutoSize | Out-String | Write-Host

# Check 2025 and 2026 batches by Module and Species
$sqlBatchesMod = @"
SELECT 
    YEAR(b.[stck date]) AS StockYear,
    m.[module] AS Modl,
    b.[stck species] AS StckSpecies,
    COUNT(DISTINCT b.[PondIndex]) AS UniquePonds,
    SUM(b.[stck pcs]) AS TotalPcs
FROM PondStockingBatches b
INNER JOIN GrowoutPondMaster m ON b.PondIndex = m.PondIndex
WHERE b.[stck date] IS NOT NULL AND YEAR(b.[stck date]) >= 2024
GROUP BY YEAR(b.[stck date]), m.[module], b.[stck species]
ORDER BY YEAR(b.[stck date]), m.[module], b.[stck species]
"@
$cmd2 = New-Object System.Data.OleDb.OleDbCommand($sqlBatchesMod, $conn)
$adapter2 = New-Object System.Data.OleDb.OleDbDataAdapter($cmd2)
$dt2 = New-Object System.Data.DataTable
$adapter2.Fill($dt2) | Out-Null
Write-Host "=== UNIQUE PONDS STOCKED BY MODULE & SPECIES (2024-2026) ==="
$dt2 | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
