[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet("Both", "Codex", "Claude")]
    [string]$Target = "Both",

    [string]$SourcePath,

    [string]$UserProfilePath = [Environment]::GetFolderPath("UserProfile"),

    [switch]$Check
)

$ErrorActionPreference = "Stop"
$script:ExcludedDirectories = @(
    ".git",
    ".agents",
    ".claude",
    ".codex",
    "__pycache__"
)
$script:ExcludedFiles = @(
    ".DS_Store",
    "test_delete_check.txt"
)

function Get-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [switch]$MustExist
    )

    if ($MustExist) {
        # Get-Item expands Windows 8.3 path segments (for example
        # GIABAO~1.TRA) so later relative-path calculations cannot escape the
        # staging root because one side uses a short name and the other a long
        # name.
        return (Get-Item -LiteralPath $Path -Force -ErrorAction Stop).FullName
    }

    return [System.IO.Path]::GetFullPath($Path)
}

function Get-RelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $rootWithSeparator = $Root.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
    $rootUri = [System.Uri]::new($rootWithSeparator)
    $pathUri = [System.Uri]::new($Path)
    return [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString()).Replace("/", "\")
}

function Test-IsIncludedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    $normalized = $RelativePath.Replace("/", "\")
    $segments = $normalized.Split("\", [System.StringSplitOptions]::RemoveEmptyEntries)

    foreach ($segment in $segments) {
        if ($script:ExcludedDirectories -contains $segment) {
            return $false
        }
    }

    if ($script:ExcludedFiles -contains $normalized) {
        return $false
    }

    return $true
}

function Get-PayloadFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $files = New-Object System.Collections.Generic.List[object]
    foreach ($file in Get-ChildItem -LiteralPath $Root -Recurse -File -Force) {
        $relativePath = Get-RelativePath -Root $Root -Path $file.FullName
        if (Test-IsIncludedPath -RelativePath $relativePath) {
            $files.Add([PSCustomObject]@{
                RelativePath = $relativePath
                FullName = $file.FullName
            })
        }
    }

    return $files | Sort-Object RelativePath
}

function Get-PayloadIndex {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    # Hashing is read-only. Avoid PowerShell forwarding the script-level
    # -WhatIf preference into provider metadata lookups for every file.
    $WhatIfPreference = $false
    $index = @{}
    foreach ($file in Get-PayloadFiles -Root $Root) {
        $stream = [System.IO.File]::OpenRead($file.FullName)
        try {
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            try {
                $hashBytes = $sha256.ComputeHash($stream)
                $index[$file.RelativePath] = [System.BitConverter]::ToString($hashBytes).Replace("-", "")
            }
            finally {
                $sha256.Dispose()
            }
        }
        finally {
            $stream.Dispose()
        }
    }
    return $index
}

function Test-PayloadCurrent {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$SourceIndex,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    if (-not (Test-Path -LiteralPath $DestinationPath -PathType Container)) {
        return $false
    }

    $destinationItem = Get-Item -LiteralPath $DestinationPath -Force
    if (($destinationItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        return $false
    }

    $destinationIndex = Get-PayloadIndex -Root $DestinationPath
    if ($SourceIndex.Count -ne $destinationIndex.Count) {
        return $false
    }

    foreach ($relativePath in $SourceIndex.Keys) {
        if (-not $destinationIndex.ContainsKey($relativePath)) {
            return $false
        }
        if ($SourceIndex[$relativePath] -ne $destinationIndex[$relativePath]) {
            return $false
        }
    }

    return $true
}

function Copy-Payload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [string]$DestinationRoot
    )

    New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
    foreach ($file in Get-PayloadFiles -Root $SourceRoot) {
        $destinationFile = Join-Path $DestinationRoot $file.RelativePath
        $destinationDirectory = Split-Path -Parent $destinationFile
        if (-not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) {
            New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        }
        [System.IO.File]::Copy($file.FullName, $destinationFile, $true)
    }
}

function Assert-SkillPayload {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $requiredPaths = @(
        "SKILL.md",
        "development\auto_save_format.md",
        "development\craftland_skill_provisioning.md",
        "scripts\install_auto_save_format.ps1",
        "scripts\package_skill.py",
        "scripts\provision_craftland_pugc.ps1",
        "assets\auto-save-format\.vscode\extensions.json",
        "assets\auto-save-format\.vscode\format-fc.ps1",
        "assets\auto-save-format\.vscode\mcp.json",
        "assets\auto-save-format\.vscode\settings.json",
        "assets\auto-save-format\.vscode\tasks.json"
    )

    foreach ($relativePath in $requiredPaths) {
        $candidate = Join-Path $Root $relativePath
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            throw "Skill payload is incomplete. Missing: $relativePath"
        }
    }
}

function Install-SkillTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,

        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,

        [Parameter(Mandatory = $true)]
        [hashtable]$SourceIndex
    )

    if (Test-PayloadCurrent -SourceIndex $SourceIndex -DestinationPath $DestinationPath) {
        Write-Host "[$Name] current: $DestinationPath"
        return $true
    }

    $state = if (Test-Path -LiteralPath $DestinationPath) { "outdated" } else { "missing" }
    Write-Host "[$Name] $state`: $DestinationPath"

    if ($Check) {
        return $false
    }

    if (-not $PSCmdlet.ShouldProcess($DestinationPath, "Provision Craftland PUGC umbrella skill")) {
        return $false
    }

    if (Test-Path -LiteralPath $DestinationPath) {
        $destinationItem = Get-Item -LiteralPath $DestinationPath -Force
        if (($destinationItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Refusing to replace reparse-point target: $DestinationPath"
        }
    }

    $parentPath = Split-Path -Parent $DestinationPath
    New-Item -ItemType Directory -Path $parentPath -Force | Out-Null

    $operationId = [Guid]::NewGuid().ToString("N")
    $stagingPath = Join-Path $parentPath ".craftland-pugc.staging-$operationId"
    $backupPath = Join-Path $parentPath ".craftland-pugc.backup-$operationId"
    $backupCreated = $false

    try {
        Copy-Payload -SourceRoot $SourceRoot -DestinationRoot $stagingPath
        Assert-SkillPayload -Root $stagingPath
        if (-not (Test-PayloadCurrent -SourceIndex $SourceIndex -DestinationPath $stagingPath)) {
            throw "Staged payload verification failed for $Name."
        }

        if (Test-Path -LiteralPath $DestinationPath) {
            Move-Item -LiteralPath $DestinationPath -Destination $backupPath
            $backupCreated = $true
        }

        Move-Item -LiteralPath $stagingPath -Destination $DestinationPath
        if (-not (Test-PayloadCurrent -SourceIndex $SourceIndex -DestinationPath $DestinationPath)) {
            throw "Installed payload verification failed for $Name."
        }

        if ($backupCreated) {
            Remove-Item -LiteralPath $backupPath -Recurse -Force
            $backupCreated = $false
        }

        Write-Host "[$Name] provisioned: $DestinationPath"
        return $true
    }
    catch {
        if (Test-Path -LiteralPath $DestinationPath) {
            Remove-Item -LiteralPath $DestinationPath -Recurse -Force
        }
        if ($backupCreated -and (Test-Path -LiteralPath $backupPath)) {
            Move-Item -LiteralPath $backupPath -Destination $DestinationPath
            $backupCreated = $false
        }
        throw
    }
    finally {
        if (Test-Path -LiteralPath $stagingPath) {
            Remove-Item -LiteralPath $stagingPath -Recurse -Force
        }
    }
}

try {
    if ([string]::IsNullOrWhiteSpace($SourcePath)) {
        $SourcePath = Split-Path -Parent $PSScriptRoot
    }
    $sourceRoot = Get-AbsolutePath -Path $SourcePath -MustExist
    $userRoot = Get-AbsolutePath -Path $UserProfilePath -MustExist

    Assert-SkillPayload -Root $sourceRoot
    $sourceIndex = Get-PayloadIndex -Root $sourceRoot

    $targets = @()
    if ($Target -in @("Both", "Codex")) {
        $targets += [PSCustomObject]@{
            Name = "Codex"
            Path = Join-Path $userRoot ".agents\skills\craftland-pugc"
        }
    }
    if ($Target -in @("Both", "Claude")) {
        $targets += [PSCustomObject]@{
            Name = "Claude Code"
            Path = Join-Path $userRoot ".claude\skills\craftland-pugc"
        }
    }

    $allCurrent = $true
    foreach ($targetItem in $targets) {
        $destinationPath = Get-AbsolutePath -Path $targetItem.Path
        if ($destinationPath.TrimEnd("\") -ieq $sourceRoot.TrimEnd("\")) {
            Write-Host "[$($targetItem.Name)] source is already the target: $destinationPath"
            continue
        }

        $targetCurrent = Install-SkillTarget `
            -Name $targetItem.Name `
            -DestinationPath $destinationPath `
            -SourceRoot $sourceRoot `
            -SourceIndex $sourceIndex
        if (-not $targetCurrent) {
            $allCurrent = $false
        }
    }

    if ($Check -and -not $allCurrent) {
        exit 2
    }
    if ($WhatIfPreference -and -not $allCurrent) {
        Write-Host "WhatIf: one or more targets require provisioning."
    }
    exit 0
}
catch {
    Write-Error $_
    exit 1
}
