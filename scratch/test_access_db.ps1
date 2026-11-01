$dbPath = "D:\DB\Bab SGo (r42) 26.10.23.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$ponds = @('2040701', '2071405', '2071406', '2091804', '2091808', '2091707', '2051001', '2040702')
foreach ($p in $ponds) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT TOP 3 PondIndex, pond, [pond status], [pond active], [date culture] FROM GrowoutPondMaster WHERE PondIndex LIKE '$p%' ORDER BY PondIndex DESC"
    $reader = $cmd.ExecuteReader()
    Write-Output "--- Prefix $p ---"
    while ($reader.Read()) {
        Write-Output "$($reader['PondIndex']) | $($reader['pond']) | $($reader['pond status']) | $($reader['pond active']) | $($reader['date culture'])"
    }
    $reader.Close()
}
$conn.Close()
