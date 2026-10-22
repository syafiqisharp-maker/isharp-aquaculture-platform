$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$schema = $conn.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Columns, @($null, $null, "GrowoutPondMaster", $null))
$schema | Where-Object { $_.COLUMN_NAME -like "*spec*" -or $_.COLUMN_NAME -like "*date*" -or $_.COLUMN_NAME -like "*bs*" } | Select-Object COLUMN_NAME | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
