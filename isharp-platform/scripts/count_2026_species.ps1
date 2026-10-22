$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

# 2026 Unique Ponds Stocked by Species
$sql = @"
SELECT 
    IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI') AS ResolvedSpecies,
    COUNT(DISTINCT s.PondIndex) AS UniquePonds,
    COUNT(*) AS BatchCount,
    SUM(s.stckpcs) AS TotalPLs
FROM GrowoutPondStocking s
WHERE YEAR(s.stckdate) = 2026
GROUP BY 
    IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI')
"@

# Note: Access SQL doesn't support COUNT(DISTINCT). Let's do it via subquery.
$sqlAccess = @"
SELECT 
    ResolvedSpecies,
    COUNT(*) AS UniquePonds,
    SUM(TotalPLs) AS SumPLs
FROM (
    SELECT 
        s.PondIndex,
        IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI') AS ResolvedSpecies,
        SUM(s.stckpcs) AS TotalPLs
    FROM GrowoutPondStocking s
    WHERE YEAR(s.stckdate) = 2026
    GROUP BY 
        s.PondIndex,
        IIF(s.stckspcs LIKE '%MONODON%' OR s.BSLine LIKE '%MONODON%' OR s.BSLine LIKE '%CP THAI%' OR s.BSLine LIKE '%MOANA%' OR s.BSLine LIKE '%MADAGASCAR%' OR s.BSLine LIKE '%KSSB%', 'MONODON', 'VANNAMEI')
) t
GROUP BY ResolvedSpecies
"@

$cmd = New-Object System.Data.OleDb.OleDbCommand($sqlAccess, $conn)
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$dt = New-Object System.Data.DataTable
$adapter.Fill($dt) | Out-Null
Write-Host "=== 2026 UNIQUE PONDS STOCKED BY SPECIES ==="
$dt | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
