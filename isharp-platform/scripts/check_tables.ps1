$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$tables = $conn.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Tables, @($null, $null, $null, "TABLE"))
$tables | Where-Object { $_.TABLE_NAME -like "*stock*" -or $_.TABLE_NAME -like "*stck*" -or $_.TABLE_NAME -like "*batch*" } | Select-Object TABLE_NAME | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
