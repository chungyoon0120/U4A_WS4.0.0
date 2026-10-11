# Read-only dump of U4A WS registry (TCProxy and parents).
# Created 2026-10-12 on the user's request to verify the values locally.
# Writes nothing to the registry.

$ErrorActionPreference = "Continue"

function Dump-Key {
    param([string]$Label, [string]$Path, [string]$View)

    Write-Host ""
    Write-Host "=== $Label ($View view) ===" -ForegroundColor Cyan

    if ($View -eq "32") {
        & reg.exe query $Path /s /reg:32
    } else {
        & reg.exe query $Path /s /reg:64
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "NOT FOUND: $Path" -ForegroundColor Yellow
    }
}

Write-Host "whoami : $(whoami)"
Write-Host "time   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

Dump-Key -Label "HKCU TCProxy"      -Path "HKCU\SOFTWARE\U4A\WS\TCProxy" -View "64"
Dump-Key -Label "HKCU TCProxy"      -Path "HKCU\SOFTWARE\U4A\WS\TCProxy" -View "32"
Dump-Key -Label "HKLM TCProxy"      -Path "HKLM\SOFTWARE\U4A\WS\TCProxy" -View "64"
Dump-Key -Label "HKLM TCProxy"      -Path "HKLM\SOFTWARE\U4A\WS\TCProxy" -View "32"
Dump-Key -Label "HKCU U4A\WS (all)" -Path "HKCU\SOFTWARE\U4A\WS"         -View "64"

Write-Host ""
Write-Host "=== ActionParam decode ===" -ForegroundColor Cyan

$key = "HKCU:\SOFTWARE\U4A\WS\TCProxy"

if (-not (Test-Path $key)) {
    Write-Host "GUARD_EXIT: key not found -> nothing to decode: $key" -ForegroundColor Yellow
    return
}

$raw = (Get-ItemProperty -Path $key -Name "ActionParam" -ErrorAction SilentlyContinue).ActionParam

if ([string]::IsNullOrEmpty($raw)) {
    Write-Host "GUARD_EXIT: ActionParam empty or missing -> nothing to decode" -ForegroundColor Yellow
    return
}

Write-Host "raw     : $raw"

try {
    $decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($raw))
    Write-Host "decoded : $decoded"

    $parts = $decoded -split '\|'
    Write-Host "fields  : $($parts.Count)"

    for ($i = 0; $i -lt $parts.Count; $i++) {
        Write-Host ("  [{0}] = '{1}'" -f $i, $parts[$i])
    }
} catch {
    Write-Host "ERROR: base64 decode failed -> value is not base64" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
