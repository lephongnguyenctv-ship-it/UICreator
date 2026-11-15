---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/04-init-container-and-ssh.md"
---

# 04 - Initialize the Container, Get SSH Access, Log In

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

## 1. Check state
```
GET /api/projects/{id}/docker/status
-> { "hasContainer": true, "isInitialized": true, "isRunning": true, "containerStatus": "running" }
```
- `isInitialized: true` -> skip initialization.
- `isRunning: false` -> start it (step 3).

## 2. Initialize (async)
```
POST /api/projects/{id}/docker/initialize     { "force_reinitialize": false }
GET  /api/projects/{id}/docker/initialization -> { "status": "completed", "progress": 100, ... }
```
Poll until `status == "completed"`. Only then do SSH credentials exist. Do not set `force_reinitialize: true` on a project with running work without asking (it recreates the environment).

## 3. Start
```
POST /api/projects/{id}/docker/start
```
Poll `docker/status` until `isRunning` is true.

## 4. Get SSH details
`GET /api/projects/{id}` -> `ssh_host`, `ssh_port`, `ssh_username`, `ssh_password`.

> **`ssh_host` must come from this response.** Projects live on different nodes: main-disk projects return `run.ingarena.net`, data-node projects return the node IP. Connecting a node project's port to `run.ingarena.net` gives `Connection refused`.

```bash
ssh -p <ssh_port> <ssh_username>@<ssh_host>
```
The password is `ssh_password`. Typing it at the interactive prompt is safe with any characters.

## 5. Special characters in the password (read this)
Generated passwords may contain `! @ # % ^ & *`. If you splice the password into a command line the shell may truncate it; the symptom is `Permission denied` even though the password is right. **Do not ask the user to reset it** (there is no reset UI for project users).

| Environment | How to pass a password non-interactively |
|---|---|
| macOS / Linux / Git Bash / WSL / PowerShell | Prefer key authentication or let the operator type the password at the SSH prompt. |
| Windows cmd / `.bat` / `.cmd` | Do not carry passwords through command text; `& % ^ !` are cmd metacharacters. |
| Automated workflows | Use the environment's approved credential mechanism; never embed passwords in command-line arguments, repository files or generated logs. |
Self-check: compare the length of the password actually sent with `ssh_password`'s length. Repeated failed logins may get the IP banned, so check before retrying.

## 6. One-time key authentication (recommended)
After one successful password login, install your public key so every later `ssh`/`scp`/`rsync` needs no password:
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519      # skip if the key exists
cat ~/.ssh/id_ed25519.pub | ssh -p <port> <user>@<host> \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo >> ~/.ssh/authorized_keys && tr -d '\r' >> ~/.ssh/authorized_keys && echo >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh -p <port> -o BatchMode=yes <user>@<host> true && echo KEY-AUTH-OK
```
Permissions must be `~/.ssh` = 700, `authorized_keys` = 600. (`tr -d '\r'` protects against Windows CRLF in the key file.)

## 7. Useful checks
- `GET /api/projects/{id}/ssh/status` - sshd running/listening only. It does **not** prove your network can complete the SSH handshake.
- `POST /api/projects/{id}/ssh/restart` - restarts sshd only; rarely the right fix.
- First connection prints a host-key prompt; use `-o StrictHostKeyChecking=accept-new` in scripts.

Next: [05_run_service_and_port_mapping.md](05_run_service_and_port_mapping.md).
