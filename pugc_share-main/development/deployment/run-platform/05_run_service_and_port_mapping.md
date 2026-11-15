---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/05-run-service-and-port-mapping.md"
---

# 05 - Install, Run in Background, Expose with a Port Mapping

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

## 1. Work in the home directory
After login you are in `~` = the project root. Your uploaded code is here.

## 2. Install and start
Typical Node app:
```bash
cd ~/<app-dir>            # or ~ if the code is at the root
npm install --omit=dev
PORT=3000 nohup node server.js > server.log 2>&1 &
echo $! > server.pid
```
Rules:
- **Always run in the background** (`nohup ... &`, `screen`, `tmux`, or `pm2`) - otherwise the service dies when the SSH session closes.
- Bind to **`0.0.0.0`** (not only `127.0.0.1`) and read the port from an env var so the port mapping can reach it.
- Keep a pid file and a log file so later redeploys can stop the old process and read errors.
- The start command depends on the project: check `package.json`, `start.sh`, `README.md`, `requirements.txt`, ask the user if unclear.
- If Node is missing/too old: install a user-level copy (no sudo): choose a currently supported Node release compatible with `package.json`/the lockfile and download its archive from nodejs.org and extract into `~/.local/node`, then `export PATH=$HOME/.local/node/bin:$PATH`. The project user has passwordless `sudo` for apt installs if really needed (e.g. `sudo apt-get install -y rsync`).
- Use [templates/remote-setup.sh](templates/remote-setup.sh) - it does all of this idempotently.

## 3. Port mapping
Containers are not directly reachable. Map the app's container port:
```
POST /api/projects/{id}/docker/port-mapping     { "container_port": 3000 }
GET  /api/projects/{id}/docker/port-mappings    -> list incl. the assigned host_port
DELETE /api/projects/{id}/docker/port-mapping   { "container_port": 3000 }
```
The mapping response/list contains the external **host_port** (parse it from the JSON; the exact field name may be `host_port`).
Access URL: `https://run.ingarena.net:{host_port}` (or the project's default/custom domain).

> A port mapping (or a custom domain) is **not** "public deployment". Do not file publish requests; see [00](00_safety_and_rules.md).

## 4. Verify
```bash
curl -I https://run.ingarena.net:<host_port>
# inside the container:
curl -fs http://localhost:<port>/ | head
tail -50 ~/<app-dir>/server.log
```
Expect HTTP 200/normal status. Also check the app prints its own version/health endpoint if it has one (e.g. `/api/version`) to confirm the **new** code is the one running.

## 5. If you cannot reach the mapped port from where you are
If SSH is allowed and available in the operator's network, an SSH tunnel can provide a local preview.
This is not permission to bypass sandbox or network policy:
```bash
ssh -N -L 3000:localhost:3000 -p <ssh_port> <ssh_username>@<ssh_host>   # then open http://localhost:3000
```

## Security note
Apps with admin buttons (restart, edit data, sync) and no login should stay behind the internal network or the tunnel. Add authentication before widening access.
