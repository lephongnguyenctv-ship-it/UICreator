[CmdletBinding()]
param(
    [string]$RootPath
)

$ErrorActionPreference = "Stop"

function Fail-Validation {
    param([string]$Message)

    Write-Error "Code Review pack validation failed: $Message"
    exit 1
}

try {
    if ([string]::IsNullOrWhiteSpace($RootPath)) {
        $RootPath = Split-Path -Parent $PSScriptRoot
    }
    $root = [System.IO.Path]::GetFullPath($RootPath)
    $registryRoot = [System.IO.Path]::GetFullPath((Join-Path $root "development\code-review"))
    $manifestPath = Join-Path $registryRoot "packs.json"

    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        Fail-Validation "manifest not found: $manifestPath"
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    }
    catch {
        Fail-Validation "malformed JSON in ${manifestPath}: $($_.Exception.Message)"
    }

    if ($manifest.schema_version -ne 1) {
        Fail-Validation "schema_version must be 1"
    }
    if ($null -eq $manifest.packs) {
        Fail-Validation "manifest must contain a packs array"
    }

    $packs = @($manifest.packs)
    $idPattern = '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    $prefixPattern = '^[A-Z][A-Z0-9]*$'
    $requiredFiles = @("workflow.md", "api.md", "rule.md", "standard.md")
    $packRecords = New-Object System.Collections.Generic.List[object]
    $allRuleIds = @{}
    $allPrefixes = @{}

    foreach ($pack in $packs) {
        foreach ($field in @("id", "path", "rule_prefix")) {
            if ([string]::IsNullOrWhiteSpace([string]$pack.$field)) {
                Fail-Validation "pack is missing required field: $field"
            }
        }

        $id = [string]$pack.id
        $packPathValue = [string]$pack.path
        $prefix = [string]$pack.rule_prefix

        if ($id -notmatch $idPattern) {
            Fail-Validation "pack id is not kebab-case: $id"
        }
        if ($packPathValue -notmatch $idPattern) {
            Fail-Validation "pack path is not a single kebab-case directory name: $packPathValue"
        }
        if ($prefix -notmatch $prefixPattern) {
            Fail-Validation "rule prefix is not uppercase: $prefix"
        }
        if ($allPrefixes.ContainsKey($prefix)) {
            Fail-Validation "duplicate rule prefix: $prefix"
        }
        $allPrefixes[$prefix] = $id

        $packDirectory = [System.IO.Path]::GetFullPath((Join-Path $registryRoot $packPathValue))
        $registryPrefix = $registryRoot.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
        if (-not $packDirectory.StartsWith($registryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            Fail-Validation "pack path escapes the registry root: $packPathValue"
        }
        if (-not (Test-Path -LiteralPath $packDirectory -PathType Container)) {
            Fail-Validation "registered pack directory is missing: $packPathValue"
        }

        $actualFiles = @(Get-ChildItem -LiteralPath $packDirectory -File | Select-Object -ExpandProperty Name | Sort-Object)
        $fileDifference = Compare-Object -ReferenceObject $requiredFiles -DifferenceObject $actualFiles
        if ($null -ne $fileDifference) {
            Fail-Validation "pack '$id' must contain exactly workflow.md, api.md, rule.md, and standard.md"
        }
        if (@(Get-ChildItem -LiteralPath $packDirectory -Recurse -Filter "SKILL.md" -File).Count -gt 0) {
            Fail-Validation "nested SKILL.md found in pack '$id'"
        }

        $ruleFile = Join-Path $packDirectory "rule.md"
        $ruleText = Get-Content -LiteralPath $ruleFile -Raw
        $ruleIds = @([regex]::Matches($ruleText, '(?m)^##\s+([A-Z][A-Z0-9]*-\d{3})\b') | ForEach-Object { $_.Groups[1].Value })
        if ($ruleIds.Count -eq 0) {
            Fail-Validation "no rule IDs found in $id/rule.md"
        }
        foreach ($ruleId in $ruleIds) {
            if (-not $ruleId.StartsWith("$prefix-", [System.StringComparison]::Ordinal)) {
                Fail-Validation "rule ID '$ruleId' does not match prefix '$prefix' in pack '$id'"
            }
            if ($allRuleIds.ContainsKey($ruleId)) {
                Fail-Validation "duplicate rule ID '$ruleId' in '$id' and '$($allRuleIds[$ruleId])'"
            }
            $allRuleIds[$ruleId] = $id
        }

        $packRecords.Add([PSCustomObject]@{ Id = $id; Path = $packPathValue })
    }

    if (-not (Test-Path -LiteralPath $registryRoot -PathType Container)) {
        Fail-Validation "pack registry directory is missing: $registryRoot"
    }

    $registeredPaths = @($packRecords | ForEach-Object { $_.Path })
    foreach ($directory in @(Get-ChildItem -LiteralPath $registryRoot -Directory)) {
        if ($directory.Name -eq ".git") { continue }
        if ($registeredPaths -notcontains $directory.Name) {
            Fail-Validation "orphan pack directory is not registered: $($directory.Name)"
        }
    }

    $ids = @($packRecords | ForEach-Object { $_.Id })
    if (($ids | Sort-Object -Unique).Count -ne $ids.Count) {
        Fail-Validation "duplicate pack ID detected"
    }

    Write-Output "Code Review pack validation passed: $($packRecords.Count) pack(s), $($allRuleIds.Count) rule(s)."
    exit 0
}
catch {
    if ($_.Exception.Message -like "Code Review pack validation failed:*") {
        Write-Error $_.Exception.Message
    }
    else {
        Write-Error "Code Review pack validation failed: $($_.Exception.Message)"
    }
    exit 1
}
