---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/07-windows-deploy-scripts.md"
---

# 07 - One-Click Windows Deploy (`deploy.bat` + `deploy.ps1`)

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

Goal: the user double-clicks **one** `deploy.bat`; first run does everything step by step (SSH key -> port mapping -> deploy), later runs show a menu where **Enter = deploy**.
Ready-made files: [templates/deploy.bat](templates/deploy.bat), [templates/deploy.ps1](templates/deploy.ps1), [templates/remote-setup.sh](templates/remote-setup.sh), [templates/deploy-config.example](templates/deploy-config.example).

## Architecture
```
deploy.bat            -> thin launcher (no logic, no secrets)
deploy.ps1            -> all logic: key setup, port mapping via API, package, scp, ssh, tunnel, log
remote-setup.sh       -> runs ON the server: extract, install, stop old pid, start, health-check
```
`%LOCALAPPDATA%\<name>\state.json` stores non-secret progress flags (`keyDone`, `portDone`, `hostPort`) so the script knows if it is the first run.

## Why PowerShell, not a pure .bat
- cmd treats `& % ^ !` specially, so a password with such characters is truncated even in quotes. **Never pass passwords through `.bat`/cmd.** Let `ssh`/`scp` prompt interactively, or use key auth.
- PowerShell can call the REST API (`Invoke-RestMethod`), read secrets with `Read-Host -AsSecureString`, build staging folders, and handle errors.
- Windows 10/11 already include `ssh`, `scp`, `tar` and `robocopy`; no `rsync`/`sshpass` needed.

## The launcher
```bat
@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
pause
```
`pause` keeps the window open so the user can screenshot errors.

## Script rules (each one was a real bug)
1. **`$Var:` in strings is parsed as a drive/scope** ("Variable reference is not valid. ':' was not followed by a valid variable name character"). Write `"${Target}:$Port"`, never `"$Target:$Port"`. Fine: `$env:TEMP`, `localhost:$Port`.
2. If the file contains non-ASCII text (e.g. Vietnamese), save it as **UTF-8 with BOM** and CRLF, or Windows PowerShell 5.1 garbles it / fails to parse. Safest: keep script messages ASCII.
3. Splat arrays to native commands: `$SshOpt = @("-p", $Port, "-o", "StrictHostKeyChecking=accept-new"); ssh @SshOpt $Target "cmd"`. Check `$LASTEXITCODE` after every native call and `throw` on non-zero. With `$ErrorActionPreference = "Stop"`, wrap deliberate probes (`ssh -o BatchMode=yes ... 2>$null`) in a temporary `Continue`.
4. `scp` uses `-P` (capital), `ssh` uses `-p`.
5. Staging: use a unique temporary directory and exclude source-control metadata, agent-local files and secrets. Example: `robocopy $App $Stage /E /XD node_modules deploy .git .agents .claude .codex /XF *.log .env .env.* *.pem *.key` (robocopy exit codes 1-7 are success; do not treat as errors), then `tar -czf $Tgz -C $Stage .` - never ship `node_modules` (reinstalled on the server) or the `deploy` folder.
6. Copy any out-of-tree runtime inputs (docs, data) into the staging folder ([06](06_update_code_redeploy.md)).
7. Authorized-keys install over a pipe: `(Get-Content $pub -Raw).Trim() | ssh @SshOpt $Target "... tr -d '\r' >> ~/.ssh/authorized_keys ..."` - PowerShell appends CRLF; `tr -d '\r'` removes it. Verify with `ssh -o BatchMode=yes $Target true`.
8. Port mapping: prompt for the API key with `Read-Host -AsSecureString`, convert via `Marshal.SecureStringToBSTR` and free it in `finally`. Call `/auth/me`, then `/projects/` + `/projects/{id}` to find exactly one project matching the configured `ssh_host`, `ssh_port` and `ssh_username`. Check `docker/status` (start if stopped and poll until running), select the mapping whose `container_port` equals the app port, add it only if absent, and parse that mapping's `host_port`.
9. Final message: print the URL (`https://run.ingarena.net:<host_port>`) and the tunnel fallback.
10. Print a friendly `ERROR:` + "send a screenshot of this window" in a global `try/catch`.

## What the user does
1. Copy the templates into the application's `deploy/` folder, then edit the config block at the top of `deploy.ps1` (host, ssh port, user, app port, remote dir). `deploy-config.example` lists the fields; the script does not load it automatically.
2. Double-click `deploy.bat`. First run: type the SSH password once (key install), paste the API key (port mapping), wait for deploy.
3. Later: double-click, press Enter.

## If the agent cannot run it
An AI sandbox often cannot reach the platform/node (proxy 403, "Network is unreachable") and must not type the user's password. Write/adjust these scripts, test what you can locally (`bash -n remote-setup.sh`, unit-run the Node server), commit only if authorized by the task, and tell the user exactly: double-click `deploy.bat`, what prompts to expect, and to send a screenshot on error. Be honest that it was not run against the real server.


See [template notes](templates/README.md) for the imported examples' project matching,
port-mapping selection, failure handling and runtime-version requirements.
