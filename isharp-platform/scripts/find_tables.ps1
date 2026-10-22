$conn = New-Object System.Data.OleDb.OleDbConnection("Provider=Microsoft.ACE.OLEDB.16.0;Data Source=D:\DB\Bab SGo (r41) 26.10.16.accdb;")
$conn.Open()
$tables = $conn.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Tables, @($null, $null, $null, "TABLE"))
$tables | Where-Object { $_.TABLE_NAME -match "Growout|Profit|Cost|Ebitda|Final|Pond" } | Select-Object TABLE_NAME | Format-Table -AutoSize | Out-String | Write-Host
$conn.Close()
