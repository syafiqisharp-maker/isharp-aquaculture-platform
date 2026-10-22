$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

Write-Host "=== MODULE 2 PONDS MASTER & CYCLES IN 2026 ==="
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT 
    m.pond, 
    m.modl, 
    m.row,
    c.pond_status, 
    c.stck_date, 
    c.date_close, 
    c.stck_species,
    c.final_status
FROM GrowoutPondMaster m
LEFT JOIN (
    SELECT * FROM view_growout_pond_cycles 
    WHERE (YEAR(stck_date) = 2026 OR YEAR(date_close) = 2026 OR pond_status = 'PRODUCTION')
) c ON m.pond = c.pond
WHERE m.modl = '02'
ORDER BY m.row, m.pond
"@
$r = $cmd.ExecuteReader()
while ($r.Read()) {
    Write-Host ("Pond: {0,-10} Row: {1,2} Status: {2,-12} StckDate: {3,-12} DateClose: {4,-12} Species: {5}" -f `
        $r["pond"], $r["row"], $r["pond_status"], $r["stck_date"], $r["date_close"], $r["stck_species"])
}
$r.Close()
$conn.Close()
