<#
.SYNOPSIS
    iSHARP Centralized Credential & Environment Loader for PowerShell Sync/Backup Scripts.
    Reads .env.sync from the workspace root and exports standard variables without breaking
    existing scripts or scheduled tasks.
#>

function Import-IsharpEnv {
    $candidates = @(
        (Join-Path $PSScriptRoot "..\..\.env.sync"),
        (Join-Path $PSScriptRoot "..\.env.sync"),
        (Join-Path (Get-Location).Path ".env.sync")
    )

    foreach ($path in $candidates) {
        if (Test-Path $path) {
            Get-Content $path | ForEach-Object {
                $line = $_.Trim()
                if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                    $parts = $line -split "=", 2
                    $k = $parts[0].Trim()
                    $v = $parts[1].Trim().Trim('"').Trim("'")
                    if ($k -and $v) {
                        [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
                    }
                }
            }
            break
        }
    }

    $script:IsharpSupabaseUrl     = if ($env:SUPABASE_URL)           { $env:SUPABASE_URL }           else { "https://keappoukeagyzpoxkrru.supabase.co" }
    $script:IsharpSupabaseKey     = if ($env:SUPABASE_KEY)           { $env:SUPABASE_KEY }           else { "sb_publishable_kObmQ9Ha4NLrl9vQXy5k5w_Ie9-EQ4s" }
    $script:IsharpEditorPasscode  = if ($env:ISHARP_EDITOR_PASSCODE)  { $env:ISHARP_EDITOR_PASSCODE }  else { "mantaray" }
    $script:IsharpManagerPasscode = if ($env:ISHARP_MANAGER_PASSCODE) { $env:ISHARP_MANAGER_PASSCODE } else { "todak" }
    $script:IsharpViewerPasscode  = if ($env:ISHARP_VIEWER_PASSCODE)  { $env:ISHARP_VIEWER_PASSCODE }  else { "monodon" }

    return @{
        SupabaseUrl     = $script:IsharpSupabaseUrl
        SupabaseKey     = $script:IsharpSupabaseKey
        EditorPasscode  = $script:IsharpEditorPasscode
        ManagerPasscode = $script:IsharpManagerPasscode
        ViewerPasscode  = $script:IsharpViewerPasscode
    }
}

$IsharpEnv = Import-IsharpEnv
