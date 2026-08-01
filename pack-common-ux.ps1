# Common UX bundle packer: read manifest -> collect current files -> stamp VERSION -> UTF-8 zip.
# NOTE: keep this script ASCII-only. Korean text lives in VERSION.template.md (read as UTF-8),
#       because Windows PowerShell 5.1 reads .ps1 as ANSI and would corrupt embedded Korean.
$ErrorActionPreference = "Stop"
$Root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$Manifest = Join-Path $Root "_common-ux-bundle/manifest.txt"
$VerFile  = Join-Path $Root "_common-ux-bundle/VERSION.md"
$VerTpl   = Join-Path $Root "_common-ux-bundle/VERSION.template.md"
$Stage    = Join-Path $env:TEMP ("cuxb_" + (Get-Date -Format yyyyMMdd_HHmmss))
$DistDir  = Join-Path $Root "_common-ux-bundle/dist"
$utf8     = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force -Path $Stage, $DistDir | Out-Null

# --- VERSION stamp (git SHA + diff vs previous) ---
$sha     = (git -C $Root rev-parse HEAD).Trim()
$prevSha = ""
if (Test-Path $VerFile) {
  $m = Select-String -Path $VerFile -Pattern 'PREV_SHA:\s*([0-9a-fA-F]{7,40})' | Select-Object -First 1
  if ($m) { $prevSha = $m.Matches.Groups[1].Value }
}
$now = Get-Date -Format "yyyy-MM-dd HH:mm"
if ($prevSha) { $changed = (git -C $Root diff --stat "$prevSha" "$sha") -join "`n" } else { $changed = "(first pack)" }
if (-not $changed) { $changed = "(no committed changes vs previous)" }

$tpl = [System.IO.File]::ReadAllText($VerTpl, $utf8)
$tpl = $tpl.Replace("@SHA@", $sha).Replace("@NOW@", $now).Replace("@PREV@", $prevSha).Replace("@CHANGED@", $changed)
[System.IO.File]::WriteAllText($VerFile, $tpl, $utf8)

# --- walk manifest -> build [sourceFullPath, entryName] pairs (entry uses '/'; SRC => DEST; ** glob) ---
$pairs = New-Object System.Collections.ArrayList
Get-Content $Manifest -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $parts = $line -split '\s*=>\s*', 2
  $src   = $parts[0].Trim()
  $dest  = if ($parts.Count -eq 2) { $parts[1].Trim() } else { $src }

  if ($src.EndsWith("/**")) {
    $srcBase  = $src.Substring(0, $src.Length - 3)
    if ($dest.EndsWith("/**")) { $destBase = $dest.Substring(0, $dest.Length - 3) } else { $destBase = $dest }
    $destBase = $destBase.TrimEnd('/', '\')
    $absBase  = Join-Path $Root $srcBase
    Get-ChildItem -Recurse -File $absBase | ForEach-Object {
      $rel   = ($_.FullName.Substring($absBase.Length).TrimStart('\', '/')) -replace '\\', '/'
      $entry = "$destBase/$rel"
      [void]$pairs.Add(@($_.FullName, $entry))
    }
  }
  else {
    $entry = $dest -replace '\\', '/'
    [void]$pairs.Add(@((Join-Path $Root $src), $entry))
  }
}

# --- zip: add entries directly (forward-slash names; .NET sets UTF-8 flag for non-ASCII => Korean OK) ---
$zip = Join-Path $DistDir ("common-ux-bundle_" + (Get-Date -Format yyyyMMdd) + ".zip")
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$arch = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
$lvl  = [System.IO.Compression.CompressionLevel]::Optimal
foreach ($p in $pairs) {
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($arch, $p[0], $p[1], $lvl)
}
$arch.Dispose()
Remove-Item -Recurse -Force $Stage -ErrorAction SilentlyContinue
Write-Host ("PACKED: {0}  ({1} entries)" -f $zip, $pairs.Count)
