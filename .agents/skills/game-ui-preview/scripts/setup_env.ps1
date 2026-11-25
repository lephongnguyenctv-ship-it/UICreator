param(
    [switch]$Check,
    [switch]$NoPause,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

foreach ($a in $ExtraArgs) {
    if ($a -ieq '--check' -or $a -ieq '-check') { $Check = $true }
    if ($a -ieq '--no-pause' -or $a -ieq '-nopause') { $NoPause = $true }
}

$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$UiCreatorDir = (Resolve-Path (Join-Path $ScriptDir '..\..\..\..')).Path
$SliceScript = Join-Path $ScriptDir 'slice_sprites.py'
$GalleryScript = Join-Path $ScriptDir 'build_gallery.py'
$ExtraInput = Join-Path $UiCreatorDir 'assets\WorkshopIconLibrary'

# 1. Detect host Craftland or generic submodule project (1 to 3 levels up)
$ProjectRoot = $null
$IsCraftland = $false
$IsSubmodule = $false

$cur = $UiCreatorDir
for ($i = 1; $i -le 3; $i++) {
    $parent = Split-Path -Parent $cur
    if (-not $parent -or $parent -eq $cur) { break }
    $cur = $parent
    $hasGproj = Test-Path (Join-Path $cur 'main.gproj')
    $hasAssetsAndSettings = (Test-Path (Join-Path $cur 'Assets')) -and (Test-Path (Join-Path $cur 'ProjectSettings'))
    if ($hasGproj -or $hasAssetsAndSettings) {
        $ProjectRoot = $cur
        $IsCraftland = $true
        $IsSubmodule = $true
        break
    }
}

if (-not $ProjectRoot) {
    $cur = $UiCreatorDir
    for ($i = 1; $i -le 3; $i++) {
        $parent = Split-Path -Parent $cur
        if (-not $parent -or $parent -eq $cur) { break }
        $cur = $parent
        if (Test-Path (Join-Path $cur '.gitmodules')) {
            $ProjectRoot = $cur
            $IsSubmodule = $true
            break
        }
    }
}

if ($IsCraftland) {
    $ModeLabel = "Craftland Submodule - $ProjectRoot"
    $PreviewsDir = Join-Path $ProjectRoot 'Tools\ui-previews'
    $CatalogDir = Join-Path $PreviewsDir '_catalog'
    if (Test-Path (Join-Path $ProjectRoot 'Assets\Sprites')) {
        $SpriteInput = Join-Path $ProjectRoot 'Assets\Sprites'
    } elseif (Test-Path (Join-Path $ProjectRoot 'Assets')) {
        $SpriteInput = Join-Path $ProjectRoot 'Assets'
    } else {
        $SpriteInput = $ExtraInput
    }
} elseif ($IsSubmodule) {
    $ModeLabel = "Host Project Submodule - $ProjectRoot"
    if (Test-Path (Join-Path $ProjectRoot 'Tools\ui-previews')) {
        $PreviewsDir = Join-Path $ProjectRoot 'Tools\ui-previews'
    } else {
        $PreviewsDir = Join-Path $ProjectRoot 'previews'
    }
    $CatalogDir = Join-Path $PreviewsDir '_catalog'
    $SpriteInput = Join-Path $ProjectRoot 'Sprite sheets'
} else {
    $ProjectRoot = $UiCreatorDir
    $ModeLabel = 'Standalone UICreator'
    $PreviewsDir = Join-Path $UiCreatorDir 'previews'
    $CatalogDir = Join-Path $PreviewsDir '_catalog'
    $SpriteInput = Join-Path $UiCreatorDir 'Sprite sheets'
}

function Find-GitExe {
    $cmd = Get-Command git -ErrorAction SilentlyContinue
    if ($cmd) { return @{ Path = $cmd.Source; OnPath = $true } }
    $fixed = @(
        'C:\Program Files\Git\cmd\git.exe',
        'C:\Program Files (x86)\Git\cmd\git.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe')
    )
    foreach ($p in $fixed) {
        if ($p -and (Test-Path $p)) { return @{ Path = $p; OnPath = $false } }
    }
    $ghd = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'GitHubDesktop\app-*\resources\app\git\cmd\git.exe') -ErrorAction SilentlyContinue | Sort-Object FullName | Select-Object -Last 1
    if ($ghd) { return @{ Path = $ghd.FullName; OnPath = $false } }
    return $null
}

function Find-PyRunner {
    $uvCmd = Get-Command uv -ErrorAction SilentlyContinue
    if ($uvCmd) { return @{ Kind = 'uv'; Bin = $uvCmd.Source; Label = "uv ($($uvCmd.Source))" } }
    $uvLocal = Join-Path $env:USERPROFILE '.local\bin\uv.exe'
    if (Test-Path $uvLocal) { return @{ Kind = 'uv'; Bin = $uvLocal; Label = "uv ($uvLocal)" } }

    $pyCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pyCmd) {
        & $pyCmd.Source -c "import PIL" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return @{ Kind = 'python'; Bin = $pyCmd.Source; Label = "python + Pillow ($($pyCmd.Source))" }
        }
    }
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        & $pyLauncher.Source -3 -c "import PIL" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return @{ Kind = 'py3'; Bin = $pyLauncher.Source; Label = 'py -3 + Pillow' }
        }
    }
    return $null
}

function Invoke-PyWithPillow {
    param([hashtable]$Runner, [string[]]$ScriptArgs)
    if ($Runner.Kind -eq 'uv') {
        & $Runner.Bin run --with pillow @ScriptArgs
    } elseif ($Runner.Kind -eq 'py3') {
        & $Runner.Bin -3 @ScriptArgs
    } else {
        & $Runner.Bin @ScriptArgs
    }
    return $LASTEXITCODE
}

function Invoke-PyStdlib {
    param([hashtable]$Runner, [string[]]$PyArgs)
    if ($Runner.Kind -eq 'uv') {
        & $Runner.Bin run python @PyArgs
    } elseif ($Runner.Kind -eq 'py3') {
        & $Runner.Bin -3 @PyArgs
    } else {
        & $Runner.Bin @PyArgs
    }
}

function Find-NodeExe {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($p in @('C:\Program Files\nodejs\node.exe', (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'))) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

Write-Host '============================================================================' -ForegroundColor Cyan
Write-Host '  UICreator Environment & Submodule Setup' -ForegroundColor Cyan
Write-Host "  Mode        : $ModeLabel"
Write-Host "  Project Root: $ProjectRoot"
Write-Host "  Previews Dir: $PreviewsDir"
Write-Host '============================================================================' -ForegroundColor Cyan
Write-Host ''

$StatusGit = 'MISSING'
$StatusPy = 'MISSING'
$StatusNode = 'OPTIONAL_MISSING'
$StatusCatalog = 'SKIPPED'
$StatusMcp = 'NOT_CHECKED'

# [1/5] Git
Write-Host '[1/5] Checking Git...' -ForegroundColor Yellow
$gitInfo = Find-GitExe
if ($gitInfo) {
    $StatusGit = 'OK'
    Write-Host "      [OK] Found Git: $($gitInfo.Path)" -ForegroundColor Green
    if (-not $gitInfo.OnPath) {
        Write-Host '      [NOTE] Git is not on system PATH; update_uicreator.bat will use this copy automatically.' -ForegroundColor DarkGray
    }
} else {
    Write-Host '      [MISSING] Git was not found on PATH, in Git for Windows, or in GitHub Desktop.' -ForegroundColor Red
    if (-not $Check) {
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if ($winget) {
            $ans = Read-Host '      Install Git for Windows via winget now? [y/N]'
            if ($ans -match '^(y|yes)$') {
                & $winget.Source install --id Git.Git -e --source winget
                $gitInfo = Find-GitExe
                if ($gitInfo) { $StatusGit = 'OK' }
            }
        } else {
            Write-Host '      Download Git for Windows: https://git-scm.com/download/win'
        }
    }
}
Write-Host ''

# [2/5] Python 3 + Pillow / uv
Write-Host '[2/5] Checking Python 3 + Pillow / uv...' -ForegroundColor Yellow
$pyRunner = Find-PyRunner
if ($pyRunner) {
    $StatusPy = 'OK'
    Write-Host "      [OK] Ready via $($pyRunner.Label)" -ForegroundColor Green
} else {
    Write-Host '      [MISSING] No working uv or Python 3 + Pillow environment found.' -ForegroundColor Red
    if (-not $Check) {
        $rawPy = Get-Command python -ErrorAction SilentlyContinue
        $rawPy3 = Get-Command py -ErrorAction SilentlyContinue
        if ($rawPy) {
            $ans = Read-Host "      Python found without Pillow. Run 'python -m pip install --user pillow'? [Y/n]"
            if ($ans -notmatch '^(n|no)$') {
                & $rawPy.Source -m pip install --user pillow
                $pyRunner = Find-PyRunner
                if ($pyRunner) { $StatusPy = 'OK' }
            }
        } elseif ($rawPy3) {
            $ans = Read-Host "      Python 3 found without Pillow. Run 'py -3 -m pip install --user pillow'? [Y/n]"
            if ($ans -notmatch '^(n|no)$') {
                & $rawPy3.Source -3 -m pip install --user pillow
                $pyRunner = Find-PyRunner
                if ($pyRunner) { $StatusPy = 'OK' }
            }
        } else {
            $ans = Read-Host "      Install lightweight 'uv' Python runner now (no admin required)? [Y/n]"
            if ($ans -notmatch '^(n|no)$') {
                irm https://astral.sh/uv/install.ps1 | iex
                $pyRunner = Find-PyRunner
                if ($pyRunner) { $StatusPy = 'OK' }
            } else {
                Write-Host '      Download Python 3: https://www.python.org/downloads/ (then run: pip install pillow)'
            }
        }
    }
}
Write-Host ''

# [3/5] Node.js & Playwright (Optional)
Write-Host '[3/5] Checking Node.js & Playwright (optional: for verify_ui.mjs & Export .ui)...' -ForegroundColor Yellow
$nodeExe = Find-NodeExe
if ($nodeExe) {
    $StatusNode = 'OK'
    Write-Host "      [OK] Found Node.js: $nodeExe" -ForegroundColor Green
} else {
    Write-Host '      [WARN] Node.js not found. Preview Hub works without it, but Playwright QA and Export .ui require Node.js.' -ForegroundColor Yellow
    if (-not $Check) {
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if ($winget) {
            $ans = Read-Host '      Install Node.js LTS via winget now (optional)? [y/N]'
            if ($ans -match '^(y|yes)$') {
                & $winget.Source install --id OpenJS.NodeJS.LTS -e --source winget
                $nodeExe = Find-NodeExe
                if ($nodeExe) { $StatusNode = 'OK' }
            }
        } else {
            Write-Host '      Download Node.js LTS: https://nodejs.org/'
        }
    }
}
Write-Host ''

# [4/5] Sprite Catalog & Starter Wireframe Templates
Write-Host '[4/5] Checking Sprite Catalog & Starter Wireframe Templates...' -ForegroundColor Yellow
if ($Check) {
    if (Test-Path (Join-Path $CatalogDir 'manifest.json')) {
        $StatusCatalog = 'OK'
        Write-Host "      [OK] Catalog exists at $CatalogDir" -ForegroundColor Green
    } else {
        $StatusCatalog = 'NOT_INITIALIZED'
        Write-Host '      [INFO] Catalog not initialized yet (run setup_uicreator.bat or launch_ui_hub.bat).' -ForegroundColor DarkGray
    }
} elseif ($pyRunner) {
    Push-Location $ProjectRoot
    try {
        if ($IsCraftland) {
            Write-Host '      Indexing Craftland sprites & seeding starter wireframes...'
            $rc = Invoke-PyWithPillow -Runner $pyRunner -ScriptArgs @(
                $SliceScript, '--craftland-assets',
                '--project-root', $ProjectRoot,
                '--input', $SpriteInput,
                '--extra-input', $ExtraInput,
                '--output', $CatalogDir
            )
            if ($rc -eq 0) {
                $StatusCatalog = 'OK'
                Write-Host '      [OK] Craftland sprite catalog & Preview Hub ready.' -ForegroundColor Green
            } else {
                $StatusCatalog = 'WARN'
                Write-Host '      [WARN] Sprite indexing reported an issue; building gallery hub...' -ForegroundColor Yellow
                Invoke-PyWithPillow -Runner $pyRunner -ScriptArgs @(
                    $GalleryScript, '--previews-root', $PreviewsDir, '--catalog', $CatalogDir, '--project-root', $ProjectRoot
                ) | Out-Null
            }
        } else {
            Write-Host '      Syncing Preview Hub & starter wireframes...'
            $rc = Invoke-PyWithPillow -Runner $pyRunner -ScriptArgs @(
                $GalleryScript, '--previews-root', $PreviewsDir, '--catalog', $CatalogDir, '--project-root', $ProjectRoot
            )
            if ($rc -eq 0) {
                $StatusCatalog = 'OK'
                Write-Host '      [OK] Preview Hub & starter wireframes ready.' -ForegroundColor Green
            } else {
                $StatusCatalog = 'WARN'
            }
        }
    } finally {
        Pop-Location
    }
} else {
    $StatusCatalog = 'SKIPPED_NO_PYTHON'
    Write-Host '      [SKIP] Skipped catalog sync because Python/uv is not ready yet.' -ForegroundColor DarkGray
}
Write-Host ''

# [5/5] Craftland Studio MCP Configuration
Write-Host '[5/5] Checking Craftland Studio MCP configuration...' -ForegroundColor Yellow
if ($pyRunner) {
    $mcpCode = "import sys; from pathlib import Path; sys.path.insert(0, sys.argv[1]); import export_craftland_ui as e; u, s = e.discover_mcp_info(Path(sys.argv[2])); print(f'OK|{u}|{s}' if u else 'NONE')"
    $mcpOut = (Invoke-PyStdlib -Runner $pyRunner -PyArgs @('-c', $mcpCode, $ScriptDir, $ProjectRoot) 2>$null | Select-Object -Last 1)
    if ($mcpOut -and $mcpOut.StartsWith('OK|')) {
        $parts = $mcpOut.Split('|')
        $StatusMcp = 'OK'
        Write-Host "      [OK] Craftland MCP detected ($($parts[2])): $($parts[1])" -ForegroundColor Green
    } else {
        $StatusMcp = 'NOT_CONFIGURED'
        Write-Host "      [INFO] No Craftland Studio MCP configuration detected in $ProjectRoot." -ForegroundColor DarkGray
        if ($Check) {
            Write-Host '             Export .ui will prompt for MCP URL & output directory when you export.' -ForegroundColor DarkGray
        } elseif ($IsCraftland) {
            $newUrl = (Read-Host '      Enter Craftland MCP URL to save to .mcp.json (or press Enter to skip)').Trim()
            if ($newUrl) {
                $saveCode = "import sys; from pathlib import Path; sys.path.insert(0, sys.argv[1]); import export_craftland_ui as e; p = e.save_mcp_url_to_project(Path(sys.argv[2]), sys.argv[3]); print(p)"
                $savedPath = Invoke-PyStdlib -Runner $pyRunner -PyArgs @('-c', $saveCode, $ScriptDir, $ProjectRoot, $newUrl)
                if ($LASTEXITCODE -eq 0) {
                    $StatusMcp = 'OK'
                    Write-Host "      [OK] Saved Craftland MCP URL to $savedPath" -ForegroundColor Green
                }
            } else {
                Write-Host '      [INFO] Skipped. Export .ui will prompt for MCP URL & output directory later.' -ForegroundColor DarkGray
            }
        }
    }
} else {
    $StatusMcp = 'SKIPPED'
    Write-Host '      [SKIP] Python/uv required to inspect MCP config.' -ForegroundColor DarkGray
}
Write-Host ''

Write-Host '============================================================================' -ForegroundColor Cyan
Write-Host '  Setup Summary' -ForegroundColor Cyan
Write-Host '  --------------------------------------------------------------------------'
Write-Host "  Git               : $StatusGit"
Write-Host "  Python/Pillow/uv  : $StatusPy"
Write-Host "  Node.js           : $StatusNode"
Write-Host "  Catalog & Hub     : $StatusCatalog"
Write-Host "  Craftland MCP     : $StatusMcp"
Write-Host '  --------------------------------------------------------------------------'
Write-Host '  Next Step: Double-click launch_ui_hub.bat to open the Game UI Preview Hub!' -ForegroundColor Green
Write-Host '============================================================================' -ForegroundColor Cyan

if (-not $Check -and -not $NoPause) {
    Write-Host ''
    Read-Host 'Press Enter to close' | Out-Null
}
exit 0
