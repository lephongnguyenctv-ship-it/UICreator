---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/09-troubleshooting-and-recovery.md"
---

# 09 - Troubleshooting and Recovery

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

## Container stopped (maintenance, reclaim, manual stop) - restore service
1. `GET /api/projects/{id}` -> confirm `docker_initialized: true`, `status != running`; note ssh details, DB info, domain.
2. `GET .../docker/status`; if `isRunning` false -> `POST .../docker/start`; poll until true.
3. SSH in, `cd ~/<app-dir>`, start the app in the background (`nohup ... &`). Processes started by hand do **not** survive a stop.
4. `GET .../docker/port-mappings` - mappings normally persist; re-add with `POST .../docker/port-mapping` if lost.
5. `curl -I https://{custom_domain}.run.ingarena.net` or `https://run.ingarena.net:{host_port}` -> 200.
6. Still failing: check the process (`ps`), mapped port equals the app port, container logs `GET .../docker/logs?tail=100`.

## SSH hangs at key exchange / times out
Symptoms (all the same phenomenon: TCP connects, server banner received, key exchange never completes):
`SSHException: No existing session`, `Authentication timeout`, `ssh_dispatch_run_fatal: Connection ... timed out`, `WinError 10054`.
This does **not** mean wrong password or dead container. Diagnose read-only, in order:
1. `ssh -vvv ...` - stuck at `expecting SSH2_MSG_KEX_ECDH_REPLY` = server reply never received.
2. Try HTTP against the same host (the app port). HTTP fine + SSH stuck = network path problem (bulk transfers survive packet loss via TCP retransmit; the SSH handshake is strict request/response).
3. `ping` for packet loss. "It worked after a few retries" is luck, not a fix.
4. If it points at the network: **do not restart the container or SSH** - it will not help and kills your manually started processes (Gunicorn, supervisor, workers), turning a connectivity problem into an outage.
After a failed connection do not assume the operation did not happen: verify what the remote actually did (file API, logs, app state) before retrying.

## "Permission denied" with the right password
Special characters may have been eaten by a shell (`& ! % ^ $`). Prefer key auth or let the operator type at the SSH prompt; never embed passwords in command arguments, files or `.bat` text. Diagnose quoting/credential handling before requesting a reset.

## "Connection refused" on the SSH port
You used the wrong host. For data-node projects `ssh_host` is the node IP, not `run.ingarena.net`. Re-read `GET /api/projects/{id}`.

## Network blocked from the agent's environment
Proxy `403 after CONNECT`, "Network is unreachable": the sandbox cannot reach the platform or node. Do not work around it; give the user a local script ([07](07_windows_deploy_scripts.md)).

## Web page loads but content missing ("no .md files found", empty tables)
The app reads paths outside its folder that were not shipped ([06](06_update_code_redeploy.md)). Ship those inputs or fall back to a bundled copy.

## App starts, port mapped, still unreachable
- App bound to `127.0.0.1` only -> bind `0.0.0.0`.
- Mapped `container_port` differs from the actual listening port.
- Old process still holds the port (`ss -ltnp`) -> kill pid from `server.pid`, restart.
- App crashed: `tail -50 server.log`.

## Server runs old code after redeploy
The old process was not stopped. `kill $(cat ~/<dir>/server.pid)`, redeploy; confirm via version endpoint.

## HTTP errors from the API
409 -> another operation running, wait; 429 -> slow down uploads/downloads; 403 -> not owner/collaborator, or writing to a public project you do not own; 404 -> wrong id or no access.
