$dbPath = "D:\DB\Bab SGo (r41) 26.10.16.accdb"
if (-not (Test-Path $dbPath)) {
    $dbPath = "c:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Legacy Access DB\Bab SGo (r41) 26.10.02.accdb"
}
$connStr = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$dbPath;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()

$schema = $conn.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Columns, @($null, $null, "GrowoutPondFinal", $null))
$schema | Select-Object COLUMN_NAME, DATA_TYPE | Format-Table -AutoSize | Out-String | Write-Host

$conn.Close()
