<#
.SYNOPSIS
  Builds a Craftland Studio .fab package with Unity 2018.4 (Built-in). Portable: needs only Unity 2018.4.x.

.DESCRIPTION
  1. Finds Unity 2018.4 (-UnityExe, env UNITY_2018_EXE, Unity Hub default install folder).
  2. Creates the exporter project in -WorkDir if it does not exist (default %LOCALAPPDATA%\CraftlandFabExporter).
  3. Copies the .NET compression DLLs from the Unity install, sets apiCompatibilityLevel 6, copies the scripts in this folder.
  4. Runs the batch export (from -SpecPath, or the Universe Aura when no spec is given).
  5. Checks the log and the .fab package, then copies the .fab to -OutDir if given.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File export_fab.ps1 -SpecPath C:\temp\effect_abc.json -OutDir "C:\MyCraftland\Assets"

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File export_fab.ps1
  (exports the Universe Aura, writes the .fab into the work folder only)
#>
param(
    [string]$SpecPath,
    [string]$OutDir,
    [string]$UnityExe,
    [string]$WorkDir
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step($msg) { Write-Host "[fab] $msg" }

function Find-Unity2018 {
    if ($UnityExe) { return $UnityExe }
    if ($env:UNITY_2018_EXE) { return $env:UNITY_2018_EXE }

    $roots = @()
    $roots += (Join-Path $env:ProgramFiles 'Unity\Hub\Editor')
    $sec = Join-Path $env:APPDATA 'UnityHub\secondaryInstallPath.json'
    if (Test-Path $sec) {
        $extra = Get-Content $sec -Raw | ConvertFrom-Json
        if ($extra) { $roots += [string]$extra }
    }
    foreach ($r in $roots) {
        if (-not $r -or -not (Test-Path $r)) { continue }
        $exe = Get-ChildItem -Path $r -Directory -Filter '2018.4*' |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName 'Editor\Unity.exe' } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
        if ($exe) { return $exe }
    }
    throw "Unity 2018.4 not found. Install 2018.4.x from Unity Hub, or pass -UnityExe 'C:\...\Editor\Unity.exe', or set UNITY_2018_EXE."
}

function Invoke-Unity($exe, [string[]]$arguments) {
    # Call operator waits for Unity to exit and sets $LASTEXITCODE
    & $exe @arguments | Out-Host
    return $LASTEXITCODE
}

# ---------------------------------------------------------------- resolve paths
$unity = Find-Unity2018
if (-not (Test-Path $unity)) { throw "Unity not found at $unity" }
$unityVersionDir = Split-Path -Parent (Split-Path -Parent $unity)   # ...\2018.4.x
Write-Step "Unity 2018.4: $unity"

if (-not $WorkDir) { $WorkDir = Join-Path $env:LOCALAPPDATA 'CraftlandFabExporter' }
$WorkDir = [IO.Path]::GetFullPath($WorkDir)
$logDir = Join-Path $WorkDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# ---------------------------------------------------------------- create exporter project
if (-not (Test-Path (Join-Path $WorkDir 'Assets'))) {
    Write-Step "Creating exporter project in $WorkDir"
    $code = Invoke-Unity $unity @('-batchmode', '-quit', '-createProject', $WorkDir, '-logFile', (Join-Path $logDir 'create.log'))
    if ($code -ne 0 -or -not (Test-Path (Join-Path $WorkDir 'Assets'))) {
        throw "Project creation failed (exit $code). See $logDir\create.log"
    }
}

# .NET compression DLLs (ZipFile is missing in the default 2018.4 API level)
$dllSrc = Join-Path $unityVersionDir 'Editor\Data\MonoBleedingEdge\lib\mono\4.5'
$dllDst = Join-Path $WorkDir 'Assets\Plugins\Editor'
New-Item -ItemType Directory -Force -Path $dllDst | Out-Null
foreach ($dll in @('System.IO.Compression.FileSystem.dll', 'System.IO.Compression.dll')) {
    $src = Join-Path $dllSrc $dll
    if (-not (Test-Path $src)) { throw "Missing $dll in $dllSrc" }
    Copy-Item $src $dllDst -Force
}

# apiCompatibilityLevel 6 (.NET 4.x)
$ps = Join-Path $WorkDir 'ProjectSettings\ProjectSettings.asset'
if (Test-Path $ps) {
    $text = Get-Content $ps -Raw
    $new = [regex]::Replace($text, '(?m)^(\s*apiCompatibilityLevel:)\s*\d+', '${1} 6')
    if ($new -ne $text) { [IO.File]::WriteAllText($ps, $new, (New-Object Text.UTF8Encoding($false))) }
}

# ---------------------------------------------------------------- copy scripts
$fabDir = Join-Path $WorkDir 'Assets\FabPipeline\Editor'
$uDir = Join-Path $WorkDir 'Assets\Universe_Effect\Editor'
New-Item -ItemType Directory -Force -Path $fabDir, $uDir | Out-Null
Copy-Item (Join-Path $ScriptDir 'EffectSpecBuilder.cs') $fabDir -Force
foreach ($f in @('UniverseFabExporter.cs', 'UniverseAuraFFBuilder.cs', 'UniverseFFValidator.cs')) {
    Copy-Item (Join-Path $ScriptDir $f) $uDir -Force
}

# ---------------------------------------------------------------- export
$before = Get-Date
$logFile = Join-Path $logDir ('export_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.log')
$unityArgs = @('-batchmode', '-quit', '-projectPath', $WorkDir,
               '-executeMethod', 'UniverseFX.FF.UniverseFabExporter.ExportBatch', '-logFile', $logFile)
if ($SpecPath) {
    $spec = (Resolve-Path $SpecPath).Path
    $unityArgs += @('-fabSpec', $spec)
    Write-Step "Exporting spec: $spec"
} else {
    Write-Step "No spec given: exporting the Universe Aura"
}
$code = Invoke-Unity $unity $unityArgs
Write-Step "Unity exit code: $code (log: $logFile)"

$log = Get-Content $logFile -Raw
$errors = @($log -split "`n" | Where-Object { $_ -match 'error CS|\[Universe\] .*ERROR|ERROR:' })
if ($code -ne 0) { throw "Export failed (exit $code). Check $logFile" }
if ($errors.Count -gt 0) { throw "Errors in log:`n" + ($errors -join "`n") }

$fabOut = Join-Path $WorkDir 'Tools\fab_out'
$fab = Get-ChildItem -Path $fabOut -Filter '*.fab' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $before.AddSeconds(-2) } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $fab) { throw "No new .fab found in $fabOut. Check $logFile" }

# ---------------------------------------------------------------- check package
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($fab.FullName)
try { $entries = @($zip.Entries | ForEach-Object { $_.FullName }) } finally { $zip.Dispose() }
$platforms = @($entries | ForEach-Object { ($_ -split '/')[0] } | Where-Object { $_ -in @('IOS', 'Android', 'PC', 'WebGL') } | Select-Object -Unique)
$sizeKb = [math]::Round($fab.Length / 1KB, 1)
Write-Step ".fab: $($fab.FullName) ($sizeKb KB), platforms: $($platforms -join ', ')"
if ($platforms.Count -eq 0) { Write-Warning "No platform folders in the .fab. Check that Unity has the iOS/Android/WebGL modules, or that the PC build succeeded." }

# ---------------------------------------------------------------- copy to destination
if ($OutDir) {
    $OutDir = [IO.Path]::GetFullPath($OutDir)
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $dest = Join-Path $OutDir $fab.Name
    if (Test-Path $dest) {
        $backup = Join-Path $logDir ($fab.BaseName + '_backup_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.fab')
        Copy-Item $dest $backup
        Write-Step "Existing file backed up to $backup"
    }
    Copy-Item $fab.FullName $dest -Force
    Write-Step "Copied to $dest"
}

Write-Step "Done. Import the .fab in Craftland Studio and check that the effect appears."
