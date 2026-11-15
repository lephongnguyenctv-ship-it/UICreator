---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/01-prerequisites-and-auth.md"
---

# 01 - Prerequisites, Authentication and the Deployment Model

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

## Deployment model
- Every project gets **one dedicated Docker container** with Node.js, Python, Java etc. preinstalled.
- You deploy exactly like on a plain Linux server: **SSH into the container, install dependencies, start the process.**
- **Do not** write a Dockerfile or run `docker` inside the container (no nested Docker).
- The SSH user's **home directory `~` (`/home/<ssh_username>`) is the project root.** Uploaded files and rsync targets land there.
- A container-internal port is only reachable from outside after a **port mapping**.

## Base info
| Item | Value |
|---|---|
| API base | `https://run.ingarena.net/api` |
| Auth header | `Authorization: Bearer pk_xxx` |
| Where the user finds the key | Login -> avatar (top right) -> Settings -> API Key |

The key is long-lived (no refresh). If leaked it can be reset in Settings.

## Step 0 - get and verify the key (mandatory)
1. For an authorized deployment, obtain the key through a secure runtime prompt or approved
   environment variable; explain where the user can find it if needed. Documentation import/read
   tasks do not need a key or a call to the authenticated API.
2. Verify:
   ```bash
   curl -H "Authorization: Bearer pk_xxx" https://run.ingarena.net/api/auth/me
   ```
   - `200` -> OK (returns id, email, username, user_type)
   - `401` -> ask the user for a valid key
3. Do not call any other platform endpoint before this succeeds.

## Permission boundaries and error codes
- The key only acts on projects the user owns or collaborates on with edit/admin rights.
- Public projects are read-only for non-owners.
- All write operations check permissions.

| Code | Meaning |
|---|---|
| 401 | missing/invalid API key |
| 403 | no permission (not owner/collaborator, or write on someone else's public project) |
| 404 | project not found or no access |
| 409 | another operation is running on the project (retry later) |
| 429 | too many concurrent uploads/downloads (wait, retry) |

## Quick PowerShell equivalent (Windows)
```powershell
$H = @{ Authorization = "Bearer $key" }
Invoke-RestMethod "https://run.ingarena.net/api/auth/me" -Headers $H
```
Read `$key` with `Read-Host -AsSecureString` (see [07](07_windows_deploy_scripts.md)), never hardcode it.
