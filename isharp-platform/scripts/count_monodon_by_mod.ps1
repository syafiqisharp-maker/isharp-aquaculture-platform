$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$sql = @"
SELECT 
    m.modl AS Modl,
    COUNT(*) AS TotalMonodonPonds,
    SUM(t.TotalPLs) AS SumPLs
FROM (
    SELECT 
        s.PondIndex,
        SUM(s.stckpcs) AS TotalPLs
    FROM GrowoutPondStocking s
    WHERE YEAR(s.stckdate) >= 2021
      AND (s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%')
    GROUP BY s.PondIndex
) t
INNER JOIN GrowoutPondMaster m ON t.PondIndex = m.PondIndex
GROUP BY m.modl
ORDER BY m.modl
"@

$cmd = New-Object System.Data.OleDb.OleDbCommand($sql, $conn)
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null
Write-Host "=== TOTAL MONODON PONDS BY MODULE (2021-2026) ==="
$dt | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
