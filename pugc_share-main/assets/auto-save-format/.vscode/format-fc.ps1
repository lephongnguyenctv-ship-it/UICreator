param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

Write-Host "FC Code Formatter"
Write-Host "File: $FilePath"

if (-not (Test-Path $FilePath)) {
    Write-Host "ERROR: File not found"
    exit 1
}

try {
    $content = Get-Content $FilePath -Encoding UTF8

    # Rule 6: Sort imports at the beginning of file
    $imports = @()
    $importsEnd = -1

    for ($i = 0; $i -lt $content.Count; $i++) {
        if ($content[$i] -match '^\s*import\s') {
            $imports += $content[$i]
            $importsEnd = $i
        } elseif ($content[$i] -match '^\s*$' -and $imports.Count -gt 0 -and $importsEnd -eq ($i - 1)) {
            # Blank line right after imports
            $importsEnd = $i
        } elseif ($imports.Count -gt 0) {
            # End of import section
            break
        }
    }

    # Sort imports if found
    if ($imports.Count -gt 0) {
        # Sort .fcc imports by file name length, then alphabetically for same length
        $fccImports = @($imports | Where-Object { $_ -match '\.fcc"' } | Sort-Object {
            if ($_ -match 'import\s+"([^"]+)"') {
                $fileName = $matches[1]
                # Return formatted string: length padded to 5 digits + filename
                "{0:D5}{1}" -f $fileName.Length, $fileName
            } else {
                "99999zzz"
            }
        })

        # Sort .fcg imports by priority, then by file name length and alphabet within each group
        $fcgImports = @($imports | Where-Object { $_ -match '\.fcg"' })

        # Sort by file name length (shortest first), then alphabetically for same length
        $sortByLengthThenAlpha = {
            if ($_ -match '([^/]+)\.fcg"') {
                $fileName = $matches[1]
                # Return formatted string: length padded to 5 digits + filename
                "{0:D5}{1}" -f $fileName.Length, $fileName
            } else {
                "99999zzz"
            }
        }

        $fcgCurrent = @($fcgImports | Where-Object { $_ -match '"\./[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgConfig = @($fcgImports | Where-Object { $_ -match '"\.\./Configs/[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgManager = @($fcgImports | Where-Object { $_ -match '"\.\./Manager/[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgPlayer = @($fcgImports | Where-Object { $_ -match '"\.\./Player/[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgBase = @($fcgImports | Where-Object { $_ -match '"\.\./Base/[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgMobs = @($fcgImports | Where-Object { $_ -match '"\.\./Mobs/[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgHUDs = @($fcgImports | Where-Object { $_ -match '"\.\./HUDs/[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgUtils = @($fcgImports | Where-Object { $_ -match '"\.\./Utils/[^"]+\.fcg"' } | Sort-Object $sortByLengthThenAlpha)
        $fcgOthers = @($fcgImports | Where-Object {
            $_ -notmatch '"\./[^"]+\.fcg"' -and
            $_ -notmatch '"\.\./Configs/[^"]+\.fcg"' -and
            $_ -notmatch '"\.\./Manager/[^"]+\.fcg"' -and
            $_ -notmatch '"\.\./Player/[^"]+\.fcg"' -and
            $_ -notmatch '"\.\./Base/[^"]+\.fcg"' -and
            $_ -notmatch '"\.\./Mobs/[^"]+\.fcg"' -and
            $_ -notmatch '"\.\./HUDs/[^"]+\.fcg"' -and
            $_ -notmatch '"\.\./Utils/[^"]+\.fcg"'
        } | Sort-Object $sortByLengthThenAlpha)

        # Combine fcg imports in priority order
        $sortedFcgImports = @()
        $sortedFcgImports += $fcgCurrent
        $sortedFcgImports += $fcgConfig
        $sortedFcgImports += $fcgManager
        $sortedFcgImports += $fcgPlayer
        $sortedFcgImports += $fcgBase
        $sortedFcgImports += $fcgMobs
        $sortedFcgImports += $fcgHUDs
        $sortedFcgImports += $fcgUtils
        $sortedFcgImports += $fcgOthers

        # Replace original imports with sorted ones
        $sortedImports = @()
        $sortedImports += $fccImports
        if ($fccImports.Count -gt 0 -and $sortedFcgImports.Count -gt 0) {
            $sortedImports += ""  # Blank line between .fcc and .fcg
        }
        $sortedImports += $sortedFcgImports

        # Rebuild content with sorted imports
        $newContent = @()
        $newContent += $sortedImports

        # Rule 7: Ensure exactly one blank line after imports before graph/code
        $afterImports = $content[($importsEnd + 1)..($content.Count - 1)]

        # Skip all blank lines after imports
        $firstNonBlankIndex = 0
        for ($j = 0; $j -lt $afterImports.Count; $j++) {
            if ($afterImports[$j] -notmatch '^\s*$') {
                $firstNonBlankIndex = $j
                break
            }
        }

        # Add exactly one blank line, then the rest
        $newContent += ""
        $newContent += $afterImports[$firstNonBlankIndex..($afterImports.Count - 1)]

        $content = $newContent
    }

    $formatted = @()
    $prevLine = ""
    $braceDepth = 0
    $inFunctionOrEvent = $false
    $needBlankLineAfterClosing = $false

    for ($i = 0; $i -lt $content.Count; $i++) {
        $line = $content[$i]

        # Rule 5: Ensure blank line after event/func/async block
        # If previous line closed a function/event, ensure current line has blank line before it
        # But if current line is already blank, don't add another one
        if ($needBlankLineAfterClosing) {
            if ($line -notmatch '^\s*$' -and $line -notmatch '^\s*\}') {
                # Current line is not blank and not closing brace, add blank line
                $formatted += ""
            }
            # Either way, clear the flag
            $needBlankLineAfterClosing = $false
        }

        # Preserve comments FIRST: Extract comments and replace with placeholders
        # This prevents string processing from affecting strings inside comments
        $comments = @()
        $commentIndex = 0

        # Single-line comment: // ...
        if ($line -match '//.*$') {
            $commentContent = $matches[0]
            $placeholder = "___COMMENT_PLACEHOLDER_${commentIndex}___"
            $comments += $commentContent
            $line = $line -replace [regex]::Escape($commentContent), $placeholder
            $commentIndex++
        }

        # Multi-line comment: /* ... */ (on same line)
        while ($line -match '/\*.*?\*/') {
            $commentContent = $matches[0]
            $placeholder = "___COMMENT_PLACEHOLDER_${commentIndex}___"
            $comments += $commentContent
            $line = $line -replace [regex]::Escape($commentContent), $placeholder
            $commentIndex++
        }

        # Preserve strings AFTER comments: Extract strings and replace with placeholders
        # This ensures strings in comments are not processed
        $strings = @()
        $stringIndex = 0

        # Match strings (including escaped quotes)
        while ($line -match '"([^"\\]*(\\.[^"\\]*)*)"') {
            $stringContent = $matches[0]
            $placeholder = "___STRING_PLACEHOLDER_${stringIndex}___"
            $strings += $stringContent
            $line = $line -replace [regex]::Escape($stringContent), $placeholder
            $stringIndex++
        }

        # Rule 1: Remove semicolons at end of line
        $line = $line -replace ';\s*$', ''

        # Rule 2: Format space around { and }
        # Add space before { if preceded by: letter/digit/comma/close-paren
        # Add space after { if followed by: letter/digit
        # Add space after } if followed by: letter/digit

        # Step 1: Remove all spaces around { and } (but preserve indent before })
        $line = $line -replace '\s+\{', '{'
        $line = $line -replace '\{\s+', '{'
        # Don't remove space before } here - will handle in Step 4
        $line = $line -replace '\}\s+', '}'

        # Step 2: Add space before { if preceded by letter/digit/comma/close-paren
        $line = $line -replace '([a-zA-Z0-9,)])\{', '$1 {'

        # Step 2.5: Remove space before { for type initializers (ALWAYS)
        # This applies to: LocString{}, List<T>{}, Map<K,V>{}, Vector3{}, etc.
        $line = $line -replace 'LocString\s+\{', 'LocString{'
        $line = $line -replace '>\s+\{', '>{'

        # Step 2.6: Add space for >{ ONLY at end of line (control flow block opening)
        # This handles: if/else/for/while/func/event/async ... >{
        if ($line -match '^\s*(if|else|for|while|func|event|async)\s') {
            # Only add space if { is at the end (control flow), not in the middle (type initializer)
            $line = $line -replace '>\{\s*$', '> {'
        }

        # Step 2.7: Ensure space before { for control flow and function/event declarations
        # This catches any case where { doesn't have a space before it in these statements
        if ($line -match '^\s*(if|else|for|while|func|event|async)\s') {
            # Only add space for { at the END of line (control flow block)
            $line = $line -replace '(\S)\{\s*$', '$1 {'
        }

        # Step 3: Add space after } if followed by letter/digit
        $line = $line -replace '\}([a-zA-Z0-9])', '} $1'

        # Step 4: Remove space after { and before } (final cleanup)
        $line = $line -replace '\{\s+', '{'
        # Only remove space before } if there's non-whitespace content before it on the same line
        if ($line -match '\S.*\s+\}') {
            $line = $line -replace '(\S)\s+\}', '$1}'
        }

        # Rule 2.1: Format space around comma
        # No space before comma, exactly one space after comma (if followed by non-whitespace)

        # Step 1: Remove all spaces before comma
        $line = $line -replace '\s+,', ','

        # Step 2: Remove all spaces after comma
        $line = $line -replace ',\s+', ','

        # Step 3: Add exactly one space after comma if followed by non-whitespace
        $line = $line -replace ',(\S)', ', $1'

        # Rule 2.2: Format space around operators
        # Comparison operators: ==, !=, <=, >=
        # Logical operators: &&, ||
        # Assignment operators: =, +=, -=, *=, /=, %=
        # Note: < and > are NOT formatted because they're used in generic types

        # Step 1: Remove all spaces around multi-char operators
        # Process double-char operators (==, !=) BEFORE single+equal (<=, >=, +=, etc.) to avoid overlap
        $line = $line -replace '\s*(==|!=)\s*', '$1'
        $line = $line -replace '\s*(<=|>=|&&|\|\||[+\-*/%]=)\s*', '$1'

        # Step 2: Add exactly one space before and after multi-char operators
        # Process in same order to avoid overlap
        $line = $line -replace '(==|!=)', ' $1 '
        $line = $line -replace '(<=|>=|&&|\|\||[+\-*/%]=)', ' $1 '

        # Step 3: Handle single = operator (assignment, not comparison/compound)
        # Only format when = is preceded by word chars, ), or ]
        # NOTE: Do NOT include > or < to avoid breaking <=, >=
        $line = $line -replace '([\w\)\]])\s*=\s*([^\s=])', '$1 = $2'

        # Step 4: Handle = after generic type closing bracket >
        # Only format when there are 2+ spaces (1 space is correct format)
        $line = $line -replace '(>)\s{2,}=\s*([^\s=])', '$1 = $2'

        # Rule 2.3: Format space after control flow keywords (if, for, while)
        # Ensure exactly one space between keyword and opening parenthesis
        # Examples: if( -> if (, for( -> for (, while( -> while (
        $line = $line -replace '\b(if|for|while|switch)\s*\(', '$1 ('

        # Rule 3: Ensure blank line before event/func declarations
        # Always add blank line before event/func/async (unless previous line is blank, comment, or it's the first line)
        if ($line -match '^\s*(event|func|async)\s' -and $formatted.Count -gt 0) {
            # Check if there's already a blank line OR if previous line is a comment
            $prevLine = $formatted[-1]
            if ($prevLine -notmatch '^\s*$' -and $prevLine -notmatch '^\s*(//|/\*|\*)') {
                $formatted += ""
            }
        }

        # Rule 4: Remove blank lines before closing brace
        # If current line is closing brace, remove preceding blank lines
        if ($line -match '^\s*\}\s*$') {
            while ($formatted.Count -gt 0 -and $formatted[-1] -match '^\s*$') {
                $formatted = $formatted[0..($formatted.Count - 2)]
            }
        }

        # Track function/event blocks for Rule 5 (BEFORE restoring strings/comments)
        # Detect event/func/async declaration
        if ($line -match '^\s*(event|func|async)\s') {
            $inFunctionOrEvent = $true
            $braceDepth = 0
        }

        # Track brace depth (count braces in processed line, excluding placeholders)
        if ($inFunctionOrEvent) {
            # Count opening and closing braces
            $openBraces = ($line | Select-String -Pattern '\{' -AllMatches).Matches.Count
            $closeBraces = ($line | Select-String -Pattern '\}' -AllMatches).Matches.Count

            $braceDepth += $openBraces
            $braceDepth -= $closeBraces

            # If we're back to depth 0 after seeing braces, we've closed the function/event
            if ($braceDepth -eq 0 -and $closeBraces -gt 0) {
                $needBlankLineAfterClosing = $true
                $inFunctionOrEvent = $false
            }
        }

        # Restore strings FIRST: Replace placeholders back with original strings
        for ($j = 0; $j -lt $strings.Count; $j++) {
            $placeholder = "___STRING_PLACEHOLDER_${j}___"
            $line = $line -replace [regex]::Escape($placeholder), $strings[$j]
        }

        # Restore comments LAST: Replace placeholders back with original comments
        # This ensures strings inside comments remain unchanged
        for ($j = 0; $j -lt $comments.Count; $j++) {
            $placeholder = "___COMMENT_PLACEHOLDER_${j}___"
            $line = $line -replace [regex]::Escape($placeholder), $comments[$j]
        }

        $formatted += $line
        $prevLine = $line
    }

    # Write file with UTF8 NO BOM (important for FC compiler)
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllLines($FilePath, $formatted, $utf8NoBom)

    Write-Host "Format complete"
    exit 0
}
catch {
    Write-Host "ERROR: Failed to format"
    exit 1
}
