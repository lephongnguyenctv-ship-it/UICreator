# One-click deploy to RUN Platform (https://run.ingarena.net). Run via deploy.bat on Windows 10/11.
# Imported/adapted 2026-10-14 from plant-vs-zombie/run-platform-deploy-skills/templates/.
# First run: SSH key -> port mapping (asks API key) -> deploy.  Later runs: menu, Enter = deploy.
# NEVER store the SSH password or API key here. They are typed at prompts.
param([string]$Action = "")

# ===== CONFIG (edit) =====
$HostName   = "REPLACE_WITH_ssh_host"
$SshPort    = 22
$User       = "REPLACE_WITH_ssh_username"
$AppPort    = 3000
$RemoteDir  = "my-app"
$StartCmd   = "node server.js"
$InstallCmd = "npm install --omit=dev --no-audit --no-fund"
$HealthPath = "/"
$Api        = "https://run.ingarena.net/api"
$Exclude    = @("node_modules", "deploy", ".git", ".agents", ".claude", ".codex", "__pycache__")
$ExcludeFiles = @("*.log", ".env", ".env.*", "*.pem", "*.key", "id_rsa*", "id_ed25519*")
# =========================

$ErrorActionPreference = "Stop"
# Copy these templates into <app>/deploy/ before use; never deploy the knowledge base itself.
if ((Split-Path -Leaf $PSScriptRoot) -ne "deploy") { throw "Copy templates into your application's deploy folder before running." }
if ($HostName -like "REPLACE_*" -or $User -like "REPLACE_*" -or $HostName -notmatch '^[A-Za-z0-9.-]+$' -or $User -notmatch '^[A-Za-z_][A-Za-z0-9_-]*$') { throw "Configure HostName and User from project details first." }
if ($SshPort -lt 1 -or $SshPort -gt 65535 -or $AppPort -lt 1 -or $AppPort -gt 65535) { throw "Ports must be between 1 and 65535." }
if ($RemoteDir -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]*$') { throw "RemoteDir must be a simple folder name under the SSH user's home." }
if ($HealthPath -notmatch '^/' -or $HealthPath -match '[\r\n]') { throw "HealthPath must start with / and contain no line breaks." }
$App = Split-Path -Parent $PSScriptRoot                # app root = parent of the deploy folder; adjust if deploy.ps1 lives elsewhere
$Target = "${User}@${HostName}"
$SshOpt = @("-p", $SshPort, "-o", "StrictHostKeyChecking=accept-new")
$StateDir = Join-Path $env:LOCALAPPDATA "run-deploy-${HostName}-${SshPort}-${User}-${RemoteDir}-${AppPort}"; $StateFile = Join-Path $StateDir "state.json"
New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
$State = @{ keyDone = $false; portDone = $false; hostPort = $null }
if (Test-Path $StateFile) { try { $o = Get-Content $StateFile -Raw | ConvertFrom-Json; foreach ($k in @($State.Keys)) { if ($null -ne $o.$k) { $State[$k] = $o.$k } } } catch {} }
function Save-State { $State | ConvertTo-Json | Set-Content $StateFile -Encoding UTF8 }
function Step($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Fail($m) { throw $m }

# 1) SSH key: create if missing and install on the server (type the server password once)
function Invoke-Key {
  Step "SSH key (type the server password once)"
  $key = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
  if (-not (Test-Path -LiteralPath $key)) {
    if (Test-Path -LiteralPath "$key.pub") { Fail "Public key exists without its private key; select a valid existing key before deploying." }
    New-Item -ItemType Directory -Path (Split-Path $key) -Force | Out-Null
    ssh-keygen -t ed25519 -N '""' -f $key -q
    if ($LASTEXITCODE) { Fail "ssh-keygen failed" }
  } elseif (-not (Test-Path -LiteralPath "$key.pub")) {
    $publicKey = ssh-keygen -y -f $key
    if ($LASTEXITCODE) { Fail "Could not derive public key; existing private key was preserved." }
    $publicKey | Set-Content -LiteralPath "$key.pub" -Encoding ASCII
  }
  (Get-Content "$key.pub" -Raw).Trim() | ssh @SshOpt $Target "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo >> ~/.ssh/authorized_keys && tr -d '\r' >> ~/.ssh/authorized_keys && echo >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
  if ($LASTEXITCODE) { Fail "Could not install the key (wrong password / cannot connect)" }
  $ErrorActionPreference = "Continue"; ssh @SshOpt -o BatchMode=yes $Target "true" 2>$null; $ok = ($LASTEXITCODE -eq 0); $ErrorActionPreference = "Stop"
  if ($ok) { Write-Host "OK: no more password prompts." -ForegroundColor Green } else { Write-Host "Key login not working yet: later steps will still ask for the password." -ForegroundColor Yellow }
  $State.keyDone = $ok; Save-State
  if (-not $ok) { Fail "Key authentication was not verified; fix it before continuing." }
}

# 2) Port mapping through the platform API (API key typed at prompt, never stored)
function Find-Mapping($o, [int]$port) {
  if ($null -eq $o) { return $null }
  if ($o -is [System.Management.Automation.PSCustomObject]) {
    foreach ($name in @("container_port", "containerPort")) {
      $property = $o.PSObject.Properties[$name]
      if ($null -ne $property -and $property.Value -eq $port) { return $o }
    }
    foreach ($p in $o.PSObject.Properties) { $r = Find-Mapping $p.Value $port; if ($null -ne $r) { return $r } }
  } elseif ($o -is [System.Collections.IEnumerable] -and $o -isnot [string]) { foreach ($i in $o) { $r = Find-Mapping $i $port; if ($null -ne $r) { return $r } } }
  return $null
}
function Invoke-PortMap {
  Step "Port mapping for container port $AppPort"
  $sec = Read-Host "Paste API key (pk_..., Settings page of the platform)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try {
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $H = @{ Authorization = "Bearer $key" }
  $me = Invoke-RestMethod "$Api/auth/me" -Headers $H; Write-Host "API key OK: $($me.username)"
  $proj = $null
  $projectMatches = @()
  foreach ($p in (Invoke-RestMethod "$Api/projects/" -Headers $H).projects) { $d = Invoke-RestMethod "$Api/projects/$($p.id)" -Headers $H; if ($d.ssh_port -eq $SshPort -and $d.ssh_host -eq $HostName -and $d.ssh_username -eq $User) { $projectMatches += $d } }
  if ($projectMatches.Count -ne 1) { Fail "Expected one project matching configured SSH host, port and user; found $($projectMatches.Count)." }
  $proj = $projectMatches[0]
  Write-Host "Project: $($proj.name) (id $($proj.id))"; $id = $proj.id
  $st = Invoke-RestMethod "$Api/projects/$id/docker/status" -Headers $H
  if (-not $st.isRunning) {
    Write-Host "Container stopped -> starting..."
    Invoke-RestMethod "$Api/projects/$id/docker/start" -Method Post -Headers $H | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      Start-Sleep -Seconds 2
      $st = Invoke-RestMethod "$Api/projects/$id/docker/status" -Headers $H
      if ($st.isRunning) { break }
    }
    if (-not $st.isRunning) { Fail "Container did not reach running state." }
  }
  $maps = Invoke-RestMethod "$Api/projects/$id/docker/port-mappings" -Headers $H
  $mapping = Find-Mapping $maps $AppPort
  if ($null -eq $mapping) {
    Invoke-RestMethod "$Api/projects/$id/docker/port-mapping" -Method Post -Headers $H -ContentType "application/json" -Body (@{ container_port = $AppPort } | ConvertTo-Json) | Out-Null
    $maps = Invoke-RestMethod "$Api/projects/$id/docker/port-mappings" -Headers $H
    $mapping = Find-Mapping $maps $AppPort
  }
  if ($null -eq $mapping) { Fail "No mapping found for container port $AppPort; inspect the current API schema." }
  $hp = $null
  foreach ($name in @("host_port", "hostPort", "external_port")) { $property = $mapping.PSObject.Properties[$name]; if ($null -ne $property) { $hp = $property.Value; break } }
  if (-not $hp) { Fail "No host port on the selected mapping; inspect the current API schema." }
  $State.hostPort = $hp
  Write-Host "host_port = $hp  ->  https://run.ingarena.net:$hp" -ForegroundColor Green
  $State.portDone = $true; Save-State
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if ($H) { $H.Clear() }
    $key = $null; $sec = $null; $proj = $null; $projectMatches = $null
  }
}

function ConvertTo-ShLiteral([string]$Value) {
  $escapedQuote = "'" + '"' + "'" + '"' + "'"
  return "'" + $Value.Replace("'", $escapedQuote) + "'"
}

# 3) Deploy: stage -> tar -> scp -> remote-setup.sh (stop old, install, start, health check)
function Invoke-Deploy {
  Step "Deploy"
  $operation = [Guid]::NewGuid().ToString("N")
  $Tgz = Join-Path $env:TEMP "run-app-$operation.tgz"; $Stage = Join-Path $env:TEMP "run-stage-$operation"
  Write-Host "1/3 Packaging..."
  robocopy $App $Stage /E /XD @Exclude /XF @ExcludeFiles /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { Fail "robocopy failed; package was not uploaded." }
  # If the app reads files from OUTSIDE its folder, copy them into $Stage here (and make the app fall back to them).
  tar -czf $Tgz -C $Stage .
  if ($LASTEXITCODE) { Fail "tar failed; package was not uploaded." }
  Write-Host ("    {0:N1} MB" -f ((Get-Item $Tgz).Length / 1MB))
  Write-Host "2/3 Uploading to ${Target}:$SshPort ..."
  scp -P $SshPort -o StrictHostKeyChecking=accept-new $Tgz "${Target}:~/app.tgz"
  if ($LASTEXITCODE) { Fail "scp archive failed (connection / password)" }
  scp -P $SshPort -o StrictHostKeyChecking=accept-new (Join-Path $PSScriptRoot "remote-setup.sh") "${Target}:~/remote-setup.sh"
  if ($LASTEXITCODE) { Fail "scp failed (connection / password)" }
  Write-Host "3/3 Installing and starting on the server..."
  $remoteArgs = @($RemoteDir, [string]$AppPort, $StartCmd, $InstallCmd, $HealthPath) | ForEach-Object { ConvertTo-ShLiteral $_ }
  $remote = "bash ~/remote-setup.sh " + ($remoteArgs -join " ")
  ssh @SshOpt $Target $remote
  if ($LASTEXITCODE) { Fail "Server did not start - see the log above (menu: view server log)" }
  Write-Host ""
  if ($State.hostPort) { Write-Host "DONE. Open: https://run.ingarena.net:$($State.hostPort)" -ForegroundColor Green }
  else { Write-Host "DONE. Run the port-mapping step to get the URL, or use the tunnel and open http://localhost:$AppPort" -ForegroundColor Green }
}
function Invoke-Tunnel { Step "Tunnel: keep this window open, browse http://localhost:$AppPort (Ctrl+C to stop)"; ssh @SshOpt -N -L "${AppPort}:localhost:$AppPort" $Target }
function Invoke-Log { Step "Last 40 log lines"; ssh @SshOpt $Target "tail -40 ~/$RemoteDir/server.log" }

try {
  if (-not $Action) { $Action = if ($State.keyDone -and $State.portDone) { "menu" } else { "first" } }
  if ($Action -eq "menu") {
    Write-Host ""; Write-Host "Deploy to $Target (app port $AppPort)" -ForegroundColor Cyan
    Write-Host "  1. Deploy new version (default - press Enter)"; Write-Host "  2. Tunnel (http://localhost:$AppPort)"; Write-Host "  3. View server log"
    Write-Host "  4. Redo port mapping (asks API key)"; Write-Host "  5. Reinstall SSH key"; Write-Host "  6. Run everything from the start"; Write-Host "  0. Exit"
    $c = Read-Host "Choose"; $Action = switch ($c) { "" { "deploy" } "1" { "deploy" } "2" { "tunnel" } "3" { "log" } "4" { "portmap" } "5" { "key" } "6" { "first" } default { "" } }
  }
  switch ($Action) {
    "first"   { Invoke-Key; Invoke-PortMap; Invoke-Deploy }
    "deploy"  { Invoke-Deploy }
    "portmap" { Invoke-PortMap }
    "key"     { Invoke-Key }
    "tunnel"  { Invoke-Tunnel }
    "log"     { Invoke-Log }
  }
} catch { Write-Host ""; Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red; Write-Host "Take a screenshot of this window and send it to the AI agent / maintainer (redact credentials first)."; exit 1 }
