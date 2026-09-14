<#
.SYNOPSIS
    Archives a project folder into a timestamped ZIP under the Google Drive backup root.

.DESCRIPTION
    Creates  <BackupRoot>\<project-name>\<project-name>_YYYY-MM-DD_HHmmss.zip
    The project subfolder is created if missing. Nothing is ever deleted.

    IMPORTANT: this file must stay UTF-8 *with BOM*. Windows PowerShell 5.1 reads
    BOM-less scripts as ANSI, which mangles the Korean segment of $BackupRoot.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File backup.ps1 -ProjectPath "D:\workspace\yoon_skills"
#>
[CmdletBinding()]
param(
    [string]   $ProjectPath = (Get-Location).Path,
    [string]   $BackupRoot  = 'G:\내 드라이브\workspace',
    [string[]] $Exclude     = @(),
    [switch]   $IncludeAll
)

$ErrorActionPreference = 'Stop'

# ZipFile/ZipFileExtensions live in ...Compression.FileSystem; ZipArchiveMode lives
# in ...Compression. Both are needed, and both must load before the type literals run.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Expected failures should read as a message, not a PowerShell stack trace.
function Fail {
    param([string] $Message)
    Write-Host ''
    Write-Host "=== 백업 실패 ==="
    Write-Host $Message
    exit 1
}

# --- exclusion defaults -----------------------------------------------------

$ExcludeDirs = @(
    'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache',
    '.ruff_cache', 'dist', 'build', 'target', 'obj', '.next', '.nuxt', '.turbo',
    '.parcel-cache', '.svelte-kit', '.cache', 'coverage', '.tox', '.gradle',
    '.idea', '.vs', '.terraform'
)
$ExcludeFiles = @('*.log', '*.pyc', '*.pyo', '*.pyd', '*.tmp', '*.swp', '.DS_Store', 'Thumbs.db')

if ($IncludeAll) {
    $ExcludeDirs  = @()
    $ExcludeFiles = @()
}
if ($Exclude.Count -gt 0) {
    $ExcludeDirs  += $Exclude
    $ExcludeFiles += $Exclude
}

# --- resolve source and destination -----------------------------------------

if (-not (Test-Path -LiteralPath $ProjectPath)) {
    Fail "프로젝트 폴더를 찾을 수 없습니다: $ProjectPath"
}
$project = (Resolve-Path -LiteralPath $ProjectPath).Path.TrimEnd('\')
if (-not (Get-Item -LiteralPath $project).PSIsContainer) {
    Fail "폴더가 아닙니다 (파일 하나는 백업할 수 없습니다): $project"
}
$projectName = Split-Path -Leaf $project

# Fail loudly if the Drive is not mounted, rather than creating a stray local folder.
$rootParent = Split-Path -Parent $BackupRoot
if (-not (Test-Path -LiteralPath $rootParent)) {
    Fail "백업 루트에 접근할 수 없습니다: $rootParent`n구글 드라이브가 실행 중인지, G: 드라이브가 연결되어 있는지 확인하세요."
}

# Mirror the local folder structure under the backup root, rather than dumping
# everything into one flat level. The backup root's own leaf name is the anchor:
# whatever follows the matching segment in the project path is reproduced.
#
#   root = G:\내 드라이브\workspace   (anchor = 'workspace')
#   D:\workspace\aaaaa\bbbb  ->  G:\내 드라이브\workspace\aaaaa\bbbb
#   D:\workspace\yoon_skills ->  G:\내 드라이브\workspace\yoon_skills
#
# A project outside any folder named 'workspace' falls back to its leaf name.
$anchor      = Split-Path -Leaf $BackupRoot
$segments    = @($project.Split('\') | Where-Object { $_ -ne '' })
$anchorIndex = -1
for ($i = 0; $i -lt $segments.Count; $i++) {
    if ($segments[$i] -ieq $anchor) { $anchorIndex = $i; break }
}

if ($anchorIndex -ge 0 -and $anchorIndex -lt ($segments.Count - 1)) {
    $relativePath = ($segments[($anchorIndex + 1)..($segments.Count - 1)]) -join '\'
    $mirrored     = $true
} else {
    $relativePath = $projectName
    $mirrored     = $false
}

$targetDir = Join-Path $BackupRoot $relativePath
if (-not (Test-Path -LiteralPath $targetDir)) {
    # -Force creates every missing level, however deep the relative path is.
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    $createdDir = $true
} else {
    $createdDir = $false
}

$stamp    = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$zipName  = "${projectName}_${stamp}.zip"
$zipFinal = Join-Path $targetDir $zipName
# Build on local disk first: keeps a partial archive out of the synced folder.
$zipTemp  = Join-Path ([System.IO.Path]::GetTempPath()) "backup_$([guid]::NewGuid().ToString('N')).zip"

# --- collect files ----------------------------------------------------------

$sw           = [System.Diagnostics.Stopwatch]::StartNew()
$files        = New-Object System.Collections.Generic.List[System.IO.FileInfo]
$skippedDirs  = New-Object System.Collections.Generic.List[string]
$unreadable   = New-Object System.Collections.Generic.List[string]
$prefixLen    = $project.Length + 1

function Collect-Files {
    param([string] $Dir)

    try {
        $entries = @(Get-ChildItem -LiteralPath $Dir -Force -ErrorAction Stop)
    } catch {
        $unreadable.Add("$Dir  ($($_.Exception.Message))")
        return
    }

    foreach ($entry in $entries) {
        if ($entry.PSIsContainer) {
            if ($ExcludeDirs -contains $entry.Name) {
                $skippedDirs.Add($entry.FullName.Substring($prefixLen))
                continue
            }
            # Do not follow symlinks or junctions - they can loop or escape the project.
            if ($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                $skippedDirs.Add("$($entry.FullName.Substring($prefixLen))  (링크)")
                continue
            }
            Collect-Files -Dir $entry.FullName
        } else {
            $skip = $false
            foreach ($pattern in $ExcludeFiles) {
                if ($entry.Name -like $pattern) { $skip = $true; break }
            }
            if (-not $skip) { $files.Add($entry) }
        }
    }
}

Collect-Files -Dir $project

if ($files.Count -eq 0) {
    Fail "백업할 파일이 없습니다: $project"
}

# --- write the archive ------------------------------------------------------

$added  = 0
$failed = New-Object System.Collections.Generic.List[string]

$archive = [System.IO.Compression.ZipFile]::Open($zipTemp, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($prefixLen).Replace('\', '/')
        try {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $file.FullName, $relative,
                [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            $added++
        } catch {
            $failed.Add("$relative  ($($_.Exception.Message))")
        }
    }
} finally {
    $archive.Dispose()
}

# The timestamp is second-resolution, so two backups in the same second would
# collide. Never overwrite an existing archive - pick the next free name.
$suffix = 1
while (Test-Path -LiteralPath $zipFinal) {
    $suffix++
    $zipFinal = Join-Path $targetDir "${projectName}_${stamp}_$suffix.zip"
}

try {
    Move-Item -LiteralPath $zipTemp -Destination $zipFinal
} catch {
    Remove-Item -LiteralPath $zipTemp -Force -ErrorAction SilentlyContinue
    Fail "백업 파일을 옮기지 못했습니다: $zipFinal`n$($_.Exception.Message)"
}
$sw.Stop()

# --- report -----------------------------------------------------------------

$zipInfo   = Get-Item -LiteralPath $zipFinal
$zipMB     = [math]::Round($zipInfo.Length / 1MB, 2)
$sourceMB  = [math]::Round((($files | Measure-Object -Property Length -Sum).Sum) / 1MB, 2)
$totalZips = @(Get-ChildItem -LiteralPath $targetDir -Filter '*.zip' -File).Count

Write-Host ''
Write-Host '=== 백업 완료 ==='
Write-Host "프로젝트   : $projectName"
Write-Host "원본       : $project"
Write-Host "백업 파일  : $zipFinal"
Write-Host "크기       : $zipMB MB  (원본 $sourceMB MB)"
Write-Host "파일 수    : $added 개"
Write-Host "소요 시간  : $([math]::Round($sw.Elapsed.TotalSeconds, 1)) 초"
Write-Host "누적 백업  : $totalZips 개"
if ($createdDir) { Write-Host "폴더 생성  : $targetDir (새로 만듦)" }
if (-not $mirrored) {
    Write-Host "참고       : '$anchor' 폴더 밑이 아니라서 폴더명만 사용했습니다 ($relativePath)"
}

if ($skippedDirs.Count -gt 0) {
    Write-Host ''
    Write-Host "제외된 폴더 ($($skippedDirs.Count)개):"
    $skippedDirs | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }
    if ($skippedDirs.Count -gt 20) { Write-Host "  ... 외 $($skippedDirs.Count - 20)개" }
}

if ($unreadable.Count -gt 0) {
    Write-Host ''
    Write-Host "읽지 못한 폴더 ($($unreadable.Count)개):"
    $unreadable | ForEach-Object { Write-Host "  ! $_" }
}

if ($failed.Count -gt 0) {
    Write-Host ''
    Write-Host "읽지 못한 파일 ($($failed.Count)개) - ZIP에 포함되지 않았습니다:"
    $failed | ForEach-Object { Write-Host "  ! $_" }
    exit 2
}

exit 0
