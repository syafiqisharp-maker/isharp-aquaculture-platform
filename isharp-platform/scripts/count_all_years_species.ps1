$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$sqlAccess = @"
SELECT 
    StockYear,
    ResolvedSpecies,
    COUNT(*) AS UniquePonds,
    SUM(TotalPLs) AS SumPLs
FROM (
    SELECT 
        YEAR(s.stckdate) AS StockYear,
        s.PondIndex,
        IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI') AS ResolvedSpecies,
        SUM(s.stckpcs) AS TotalPLs
    FROM GrowoutPondStocking s
    WHERE YEAR(s.stckdate) >= 2021
    GROUP BY 
        YEAR(s.stckdate),
        s.PondIndex,
        IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI')
) t
GROUP BY StockYear, ResolvedSpecies
ORDER BY StockYear, ResolvedSpecies
"@

$cmd = New-Object System.Data.OleDb.OleDbCommand($sqlAccess, $conn)
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null
Write-Host "=== ANNUAL UNIQUE PONDS BY SPECIES (2021-2026) ==="
$dt | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
