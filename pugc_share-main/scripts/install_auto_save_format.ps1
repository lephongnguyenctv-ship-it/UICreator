<#
.SYNOPSIS
Installs the bundled Craftland FC auto-save formatter into a VS Code project.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,

    [string]$CodeCommand = "code"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ExtensionId = "gruntfuggly.triggertaskonsave"
$AssetDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) "assets\auto-save-format\.vscode"
$JsonFiles = @("extensions.json", "mcp.json", "settings.json", "tasks.json")
$AllFiles = @("extensions.json", "format-fc.ps1", "mcp.json", "settings.json", "tasks.json")
$Warnings = New-Object System.Collections.Generic.List[string]

function Copy-JsonValue {
    param([AllowNull()]$Value)

    if ($null -eq $Value) {
        return $null
    }
    if ($Value -is [string] -or $Value -is [ValueType]) {
        return $Value
    }
    return ($Value | ConvertTo-Json -Depth 100 | ConvertFrom-Json)
}

function Test-JsonValueEqual {
    param([AllowNull()]$Left, [AllowNull()]$Right)

    $leftJson = $Left | ConvertTo-Json -Depth 100 -Compress
    $rightJson = $Right | ConvertTo-Json -Depth 100 -Compress
    return $leftJson -ceq $rightJson
}

function Merge-MissingJson {
    param(
        [Parameter(Mandatory = $true)]$Target,
        [Parameter(Mandatory = $true)]$Source,
        [string]$Path = "",
        [switch]$PreserveExistingArrays
    )

    $changed = $false
    foreach ($sourceProperty in $Source.PSObject.Properties) {
        $propertyPath = if ($Path) { "$Path.$($sourceProperty.Name)" } else { $sourceProperty.Name }
        $targetProperty = $Target.PSObject.Properties[$sourceProperty.Name]

        if ($null -eq $targetProperty) {
            $Target | Add-Member -NotePropertyName $sourceProperty.Name -NotePropertyValue (Copy-JsonValue $sourceProperty.Value)
            $changed = $true
            continue
        }

        $sourceValue = $sourceProperty.Value
        $targetValue = $targetProperty.Value
        if ($sourceValue -is [System.Management.Automation.PSCustomObject] -and
            $targetValue -is [System.Management.Automation.PSCustomObject]) {
            if (Merge-MissingJson -Target $targetValue -Source $sourceValue -Path $propertyPath -PreserveExistingArrays:$PreserveExistingArrays) {
                $changed = $true
            }
            continue
        }

        if ($sourceValue -is [System.Array] -and $targetValue -is [System.Array]) {
            if ($PreserveExistingArrays) {
                if (-not (Test-JsonValueEqual $targetValue $sourceValue)) {
                    $Warnings.Add("Preserved existing ordered array at '$propertyPath'; bundled value differs.")
                }
                continue
            }

            $merged = New-Object System.Collections.ArrayList
            foreach ($item in $targetValue) {
                [void]$merged.Add($item)
            }
            foreach ($sourceItem in $sourceValue) {
                $exists = $false
                foreach ($targetItem in $merged) {
                    if (Test-JsonValueEqual $targetItem $sourceItem) {
                        $exists = $true
                        break
                    }
                }
                if (-not $exists) {
                    [void]$merged.Add((Copy-JsonValue $sourceItem))
                    $changed = $true
                }
            }
            if ($changed) {
                $targetProperty.Value = @($merged)
            }
            continue
        }

        if (-not (Test-JsonValueEqual $targetValue $sourceValue)) {
            $Warnings.Add("Preserved existing value at '$propertyPath'; bundled value differs.")
        }
    }
    return $changed
}

function Merge-TasksJson {
    param(
        [Parameter(Mandatory = $true)]$Target,
        [Parameter(Mandatory = $true)]$Source
    )

    $changed = $false
    $targetVersion = $Target.PSObject.Properties["version"]
    if ($null -eq $targetVersion) {
        $Target | Add-Member -NotePropertyName "version" -NotePropertyValue $Source.version
        $changed = $true
    } elseif ($Target.version -ne $Source.version) {
        $Warnings.Add("Preserved existing value at 'tasks.version'; bundled value is '$($Source.version)'.")
    }

    $targetTasksProperty = $Target.PSObject.Properties["tasks"]
    if ($null -eq $targetTasksProperty) {
        $Target | Add-Member -NotePropertyName "tasks" -NotePropertyValue (Copy-JsonValue $Source.tasks)
        return $true
    }

    $targetTasks = @($Target.tasks)
    foreach ($sourceTask in @($Source.tasks)) {
        $matchingTask = $targetTasks | Where-Object { $_.label -eq $sourceTask.label } | Select-Object -First 1
        if ($null -eq $matchingTask) {
            $targetTasks += Copy-JsonValue $sourceTask
            $changed = $true
            continue
        }
        if (Merge-MissingJson -Target $matchingTask -Source $sourceTask -Path "tasks[$($sourceTask.label)]" -PreserveExistingArrays) {
            $changed = $true
        }
    }
    if ($changed) {
        $Target.tasks = @($targetTasks)
    }
    return $changed
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        return (Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json)
    } catch {
        throw "Invalid JSON in '$Path': $($_.Exception.Message)"
    }
}

function Write-Utf8NoBomAtomic {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $temporaryPath = Join-Path (Split-Path -Parent $Path) (".{0}.{1}.tmp" -f (Split-Path -Leaf $Path), [guid]::NewGuid().ToString("N"))
    $encoding = New-Object System.Text.UTF8Encoding $false
    try {
        [System.IO.File]::WriteAllText($temporaryPath, $Content, $encoding)
        Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

function Copy-FileAtomic {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $temporaryPath = Join-Path (Split-Path -Parent $Destination) (".{0}.{1}.tmp" -f (Split-Path -Leaf $Destination), [guid]::NewGuid().ToString("N"))
    try {
        [System.IO.File]::WriteAllBytes($temporaryPath, [System.IO.File]::ReadAllBytes($Source))
        Move-Item -LiteralPath $temporaryPath -Destination $Destination -Force
    } finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

function Test-ExtensionInstalled {
    param([Parameter(Mandatory = $true)][string]$CommandPath)

    $output = & $CommandPath --list-extensions 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "VS Code CLI failed to list extensions: $($output -join [Environment]::NewLine)"
    }
    return @($output | ForEach-Object { $_.ToString().Trim() }) -contains $ExtensionId
}

function Assert-InstalledConfiguration {
    param(
        [Parameter(Mandatory = $true)][string]$TargetDirectory,
        [Parameter(Mandatory = $true)][string]$CommandPath
    )

    $settings = Read-JsonFile (Join-Path $TargetDirectory "settings.json")
    $tasks = Read-JsonFile (Join-Path $TargetDirectory "tasks.json")
    [void](Read-JsonFile (Join-Path $TargetDirectory "extensions.json"))
    [void](Read-JsonFile (Join-Path $TargetDirectory "mcp.json"))

    $triggerTasksProperty = $settings.PSObject.Properties["triggerTaskOnSave.tasks"]
    if ($null -eq $triggerTasksProperty) {
        throw "Verification failed: settings.json has no 'triggerTaskOnSave.tasks'."
    }
    $formatTaskProperty = $triggerTasksProperty.Value.PSObject.Properties["Format FC Code"]
    if ($null -eq $formatTaskProperty -or @($formatTaskProperty.Value) -notcontains "**/*.fcg") {
        throw "Verification failed: Format FC Code is not triggered for '**/*.fcg'."
    }
    if ($settings.PSObject.Properties["triggerTaskOnSave.on"].Value -ne $true) {
        throw "Verification failed: 'triggerTaskOnSave.on' is not true. Existing conflicting values were preserved."
    }

    $formatTask = @($tasks.tasks | Where-Object { $_.label -eq "Format FC Code" }) | Select-Object -First 1
    if ($null -eq $formatTask) {
        throw "Verification failed: tasks.json has no 'Format FC Code' task."
    }
    if (@($formatTask.args) -notcontains '${workspaceFolder}/.vscode/format-fc.ps1' -or
        @($formatTask.args) -notcontains '${file}') {
        throw "Verification failed: Format FC Code does not reference the bundled formatter and current file."
    }

    $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $AssetDirectory "format-fc.ps1")).Hash
    $targetHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $TargetDirectory "format-fc.ps1")).Hash
    if ($sourceHash -ne $targetHash) {
        throw "Verification failed: format-fc.ps1 hash differs from the bundled formatter."
    }
    if (-not (Test-ExtensionInstalled -CommandPath $CommandPath)) {
        throw "Verification failed: extension '$ExtensionId' is not installed."
    }
}

if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
    throw "ProjectPath must be an existing directory: '$ProjectPath'."
}
$ResolvedProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
if (-not [System.IO.Path]::IsPathRooted($ResolvedProjectPath)) {
    throw "ProjectPath must resolve to an absolute path."
}
if (-not (Test-Path -LiteralPath $AssetDirectory -PathType Container)) {
    throw "Bundled asset directory is missing: '$AssetDirectory'."
}
foreach ($fileName in $AllFiles) {
    $assetPath = Join-Path $AssetDirectory $fileName
    if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
        throw "Bundled asset is missing: '$assetPath'."
    }
}

$TargetDirectory = Join-Path $ResolvedProjectPath ".vscode"
$CodeCommandInfo = Get-Command $CodeCommand -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $CodeCommandInfo) {
    throw "VS Code CLI '$CodeCommand' was not found. Install VS Code and expose its 'code' command before retrying."
}
$CodeCommandPath = if ($CodeCommandInfo.Source) { $CodeCommandInfo.Source } else { $CodeCommandInfo.Definition }

# Preflight every bundled and existing JSON file before installing the extension or writing files.
$SourceJson = @{}
foreach ($fileName in $JsonFiles) {
    $SourceJson[$fileName] = Read-JsonFile (Join-Path $AssetDirectory $fileName)
    $targetPath = Join-Path $TargetDirectory $fileName
    if (Test-Path -LiteralPath $targetPath -PathType Leaf) {
        [void](Read-JsonFile $targetPath)
    }
}

$Changes = New-Object System.Collections.Generic.List[object]
foreach ($fileName in $JsonFiles) {
    $sourcePath = Join-Path $AssetDirectory $fileName
    $targetPath = Join-Path $TargetDirectory $fileName
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
        $Changes.Add([pscustomobject]@{ Name = $fileName; Mode = "Copy"; Source = $sourcePath; Target = $targetPath; Content = $null })
        continue
    }

    $targetJson = Read-JsonFile $targetPath
    $changed = if ($fileName -eq "tasks.json") {
        Merge-TasksJson -Target $targetJson -Source $SourceJson[$fileName]
    } else {
        Merge-MissingJson -Target $targetJson -Source $SourceJson[$fileName] -Path ([System.IO.Path]::GetFileNameWithoutExtension($fileName))
    }
    if ($changed) {
        $jsonText = ($targetJson | ConvertTo-Json -Depth 100) + [Environment]::NewLine
        $Changes.Add([pscustomobject]@{ Name = $fileName; Mode = "Json"; Source = $sourcePath; Target = $targetPath; Content = $jsonText })
    }
}

$formatterSource = Join-Path $AssetDirectory "format-fc.ps1"
$formatterTarget = Join-Path $TargetDirectory "format-fc.ps1"
if (-not (Test-Path -LiteralPath $formatterTarget -PathType Leaf)) {
    $Changes.Add([pscustomobject]@{ Name = "format-fc.ps1"; Mode = "Copy"; Source = $formatterSource; Target = $formatterTarget; Content = $null })
} elseif ((Get-FileHash -Algorithm SHA256 -LiteralPath $formatterSource).Hash -ne (Get-FileHash -Algorithm SHA256 -LiteralPath $formatterTarget).Hash) {
    $Changes.Add([pscustomobject]@{ Name = "format-fc.ps1"; Mode = "Copy"; Source = $formatterSource; Target = $formatterTarget; Content = $null })
}

$ExtensionInstalled = Test-ExtensionInstalled -CommandPath $CodeCommandPath
Write-Host "Project: $ResolvedProjectPath"
foreach ($change in $Changes) {
    Write-Host "Will update: .vscode/$($change.Name)"
}
foreach ($warning in $Warnings) {
    Write-Warning $warning
}
if (-not $ExtensionInstalled) {
    Write-Host "Will install extension: $ExtensionId"
}

if ($WhatIfPreference) {
    Write-Host "WhatIf complete. No files or extensions were changed."
    exit 0
}

if (-not $ExtensionInstalled) {
    if ($PSCmdlet.ShouldProcess($ExtensionId, "Install VS Code extension")) {
        $installOutput = & $CodeCommandPath --install-extension $ExtensionId --force 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install extension '$ExtensionId': $($installOutput -join [Environment]::NewLine)"
        }
        if (-not (Test-ExtensionInstalled -CommandPath $CodeCommandPath)) {
            throw "Extension installation returned success but '$ExtensionId' is still missing."
        }
    }
}

$BackupDirectory = $null
$ExistingChangedFiles = @($Changes | Where-Object { Test-Path -LiteralPath $_.Target -PathType Leaf })
$WrittenFiles = New-Object System.Collections.Generic.List[string]

try {
    if ($Changes.Count -gt 0 -and -not (Test-Path -LiteralPath $TargetDirectory)) {
        New-Item -ItemType Directory -Path $TargetDirectory | Out-Null
    }
    if ($ExistingChangedFiles.Count -gt 0) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
        $BackupDirectory = Join-Path $TargetDirectory ".auto-save-format-backup\$timestamp"
        New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
        foreach ($change in $ExistingChangedFiles) {
            Copy-Item -LiteralPath $change.Target -Destination (Join-Path $BackupDirectory $change.Name) -Force
        }
        Write-Host "Backup: $BackupDirectory"
    }

    foreach ($change in $Changes) {
        if ($change.Mode -eq "Json") {
            Write-Utf8NoBomAtomic -Path $change.Target -Content $change.Content
        } else {
            Copy-FileAtomic -Source $change.Source -Destination $change.Target
        }
        $WrittenFiles.Add($change.Target)
    }

    Assert-InstalledConfiguration -TargetDirectory $TargetDirectory -CommandPath $CodeCommandPath
} catch {
    foreach ($writtenPath in $WrittenFiles) {
        $backupPath = if ($BackupDirectory) { Join-Path $BackupDirectory (Split-Path -Leaf $writtenPath) } else { $null }
        if ($backupPath -and (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
            Copy-Item -LiteralPath $backupPath -Destination $writtenPath -Force
        } elseif (Test-Path -LiteralPath $writtenPath -PathType Leaf) {
            Remove-Item -LiteralPath $writtenPath -Force
        }
    }
    throw "Installation failed and project files were rolled back: $($_.Exception.Message)"
}

if ($Changes.Count -eq 0) {
    Write-Host "No file changes were needed."
}
Write-Host "Craftland auto-save format installed and verified successfully."
exit 0
