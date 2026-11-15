---
doc_type: deployment_template_index
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/templates/"
---

# RUN Deployment Templates

Example files for the [RUN Platform workflow](../README.md), retained inside the existing umbrella.
Copy the four files into your application's `deploy/` folder and configure them there;
do not execute the templates from this knowledge repository. The example config is a reference
for editing the PowerShell config block, not an automatically loaded configuration file.

## Contents

| File | Purpose |
|---|---|
| [deploy.bat](deploy.bat) | Windows launcher; keeps errors visible and preserves the exit code. |
| [deploy.ps1](deploy.ps1) | Operator-run SSH key setup, API port mapping, staging/upload, service restart, log and tunnel actions. |
| [remote-setup.sh](remote-setup.sh) | Runs inside the configured project's container: unpack, install, restart and local health check. |
| [deploy-config.example](deploy-config.example) | Non-secret values to put in `deploy.ps1`; host/user/ports must come from current project details. |

## Before adapting

Read [Windows Deploy](../07_windows_deploy_scripts.md),
[Safety & Rules](../00_safety_and_rules.md), and
[Prerequisites](../01_prerequisites_and_auth.md).
Confirm the runtime against the app's package manifest/lockfile and current upstream support;
the Bash example no longer auto-downloads the source template's old Node pin.
For non-Node apps, adapt `StartCmd`, `InstallCmd`, runtime checks and health path.
Add any out-of-tree runtime inputs to the staging step; the app directory is the parent of `deploy/`.
Review the staging contents before using these examples for a real app.
Generic exclusions reduce accidental uploads of `.env`, keys and metadata, but project-specific
credentials/config can have other names and must be excluded explicitly.

## Import adaptations

- Require an app `deploy/` folder, configured SSH identity, valid ports and a simple remote folder name.
- Preserve existing SSH private keys; only record key setup success after verification.
- Match API project details by SSH host, port and username; select the mapping for the exact container port.
- Wait for container start, keep secrets only in memory, free the BSTR and clear the header afterward.
- Use unique temporary staging/archive paths, exclude common secret files and check packaging/upload failures.
- Quote remote arguments and validate the remote folder/PID before restarting the example service.
- Preserve failure exit codes in both launchers.

## Verification limits

These are adaptable examples, not a deployment engine or a verified live RUN installation.
Checks in this repository cover syntax and isolated helper behavior without credentials/network calls.
The upstream API was unavailable during import; recheck its response schema when deploying.
The script restarts only this app's example PID, but a stale/reused PID still requires inspection;
use the application's service manager for production process ownership, rollback and child processes.
Local health success does not verify the externally mapped URL, access control or the expected new
version; check those separately before reporting a deployment complete.
Temporary staging/archive files remain in the operator's temp directory for inspection/cleanup.
Runtime data and secret files already on the server require app-specific persistence/backup handling.
