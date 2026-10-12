$accessPath = "C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\Pond Operations Management System\Legacy Access DB\Bab SGo (r41) 26.10.02.accdb"
$conn = New-Object -ComObject ADODB.Connection
$conn.Open("Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$accessPath;")

$rs = New-Object -ComObject ADODB.Recordset
$sql = "SELECT [PondIndex], [pond], [stock species], [final date], [final doc], [final abw], [final kg], [final pieces], [final adg], [final sr], [final fcr], [final status], [quarantine status], [stock total fry], [stock density] FROM [GrowoutPondFinal] WHERE [final date] >= #2024-01-01# ORDER BY [final date] ASC"
$rs.Open($sql, $conn)

$rows = @()
while (-not $rs.EOF) {
    $row = [ordered]@{
        pond_index = [string]$rs.Fields['PondIndex'].Value
        pond = [string]$rs.Fields['pond'].Value
        species = [string]$rs.Fields['stock species'].Value
        final_date = if ($rs.Fields['final date'].Value) { ([datetime]$rs.Fields['final date'].Value).ToString("yyyy-MM-dd") } else { $null }
        final_doc = if ($rs.Fields['final doc'].Value) { [double]$rs.Fields['final doc'].Value } else { $null }
        final_abw = if ($rs.Fields['final abw'].Value) { [double]$rs.Fields['final abw'].Value } else { $null }
        final_kg = if ($rs.Fields['final kg'].Value) { [double]$rs.Fields['final kg'].Value } else { $null }
        final_pieces = if ($rs.Fields['final pieces'].Value) { [double]$rs.Fields['final pieces'].Value } else { $null }
        final_adg = if ($rs.Fields['final adg'].Value) { [double]$rs.Fields['final adg'].Value } else { $null }
        final_sr = if ($rs.Fields['final sr'].Value) { [double]$rs.Fields['final sr'].Value } else { $null }
        final_fcr = if ($rs.Fields['final fcr'].Value) { [double]$rs.Fields['final fcr'].Value } else { $null }
        final_status = [string]$rs.Fields['final status'].Value
        quarantine_status = [string]$rs.Fields['quarantine status'].Value
        stock_total = if ($rs.Fields['stock total fry'].Value) { [double]$rs.Fields['stock total fry'].Value } else { $null }
        stock_density = if ($rs.Fields['stock density'].Value) { [double]$rs.Fields['stock density'].Value } else { $null }
    }
    $rows += $row
    $rs.MoveNext()
}

$rs.Close()
$conn.Close()

$outPath = "C:\Users\syafiq\My Drive\Syafiq Water Quality Station Project\scratch\harvest_final_2024_2026.json"
$rows | ConvertTo-Json -Depth 2 | Set-Content -Path $outPath -Encoding UTF8
Write-Output "Successfully exported $($rows.Count) closed harvest cycles to $outPath"
