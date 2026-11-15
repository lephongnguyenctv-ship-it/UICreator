---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/06-update-code-redeploy.md"
---

# 06 - Update Code (Incremental Redeploy)

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

For day-to-day changes **prefer SSH-based sync over the upload API**: rsync/scp keep the directory structure, so nothing lands in the wrong folder.

## Key fact
The container's project directory is the SSH user's home, so paths map 1:1: local `public/app.js` <-> remote `~/public/app.js`; local `./` <-> remote `~/`.

## Option 1 - rsync (macOS/Linux/Git Bash/WSL)
Prefer key auth (see [04](04_init_container_and_ssh.md)); otherwise let the operator type the password at the SSH prompt; do not put it in command arguments.
```bash
# whole project
rsync -avz --exclude '.git' --exclude 'node_modules' \
  -e "ssh -p <ssh_port> -o StrictHostKeyChecking=accept-new" ./ <user>@<ssh_host>:~/
# one directory
rsync -avz -e "ssh -p <ssh_port>" ./public/ <user>@<ssh_host>:~/public/
# one file
rsync -avz -e "ssh -p <ssh_port>" ./public/app.js <user>@<ssh_host>:~/public/app.js
```
- Do **not** add `--delete` casually: it removes remote-only files (installed `node_modules`, runtime data, uploads). If you must mirror, `--exclude` those paths.
- No `rsync` in an old container: `sudo apt-get install -y rsync`, or use scp.

## Option 2 - scp
```bash
scp -P <ssh_port> ./public/app.js <user>@<ssh_host>:~/public/app.js
```

## Option 3 - tarball (works on plain Windows: no rsync/sshpass)
Used by [templates/deploy.ps1](templates/deploy.ps1): `tar -czf` a staging folder, `scp` the tarball + `remote-setup.sh`, then `ssh ... bash ~/remote-setup.sh`. It overwrites the app folder with the local copy, so the **local copy is the source of truth**.

## After syncing: restart
Files change on disk but the running process does not reload. Restart it (`pm2 reload <this-app-name>`, or kill the pid from `server.pid` and `nohup` again - `remote-setup.sh` does this) and then **verify** the new version is live (version endpoint / page badge / `curl`).

## Include everything the app reads at runtime
A frequent bug: the app reads files from **outside its own folder** (e.g. `../../docs`). Those exist on the dev machine but not in the container, so pages show "no files found". Either ship those folders inside the package (e.g. a `docs/` copy in staging) and make the app fall back to it, or change the path. Run the app from a copy where the parent folders are absent to test this.
