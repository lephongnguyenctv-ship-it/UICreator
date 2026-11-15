---
doc_type: deployment_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "plant-vs-zombie/run-platform-deploy-skills/11-lessons-learned.md"
---

# 11 - Lessons Learned (from a real deployment of a Node/Express web tool)

> RUN Platform reference imported on 2026-10-14; live API details were not revalidated.
> Apply only within an authorized deployment task; see [scope and verification](README.md#integration-and-scope).

Context: a Node/Express app (~40 MB) deployed to a data-node project; the user is on Windows; the agent ran in a sandbox.

| # | What happened | Rule |
|---|---|---|
| 1 | Agent tried to SSH/curl from its sandbox: "Network is unreachable" / proxy `403 after CONNECT` for `run.ingarena.net` | Sandboxes may be firewalled. Do not circumvent. Hand the user a local script and say plainly it is untested against the real server. |
| 2 | The user pasted the SSH password in chat and asked the agent to log in | Do not type passwords for the user. Scripts prompt; use key auth after the first login. Recommend rotating anything pasted in chat. |
| 3 | First instructions told the user to open `http://<node-ip>:<app-port>` | Wrong: the container port is not exposed. A **port mapping** is required; the URL is `https://run.ingarena.net:<host_port>`. Read the platform skill before giving URLs. |
| 4 | The app needed an API key; the SSH password was offered instead | They are different credentials. SSH password = container login. API key (`pk_...`) = platform API (port mapping, project info). |
| 5 | Several `.bat` files (setup-key, portmap, deploy, tunnel) confused the user | Merge into **one** `deploy.bat` + `deploy.ps1` with a first-run flow and a menu. |
| 6 | `deploy.ps1` failed to parse: `"... $Target:$SshPort ..."` -> "Variable reference is not valid. ':' was not followed by a valid variable name character" | Use `"${Target}:$SshPort"`. |
| 7 | After deploy the "Docs" page said "no .md files found" | The app read `../../design` (outside its folder) which was not packaged. Ship those files in the tarball (`design-docs/`) and have the app fall back to them. Test by running a copy with parent folders absent. |
| 8 | Wanted to delete obsolete `.bat` files on a mounted folder: "Operation not permitted" | Some mounts forbid deletion. Replace obsolete files with tiny stubs that call the new entry point and tell the user they can delete them. |
| 9 | New HTTP endpoint (zip export) needed a ZIP library | A tiny pure-Node ZIP writer (zlib deflateRaw + CRC32) avoided adding a dependency; verified with `unzip -l`/`zipfile.testzip()` and a byte-compare of one entry. |
| 10 | Pushing to git | Follow current task authorization and repository rules for commits/pushes; this imported workflow does not authorize either. |
| 11 | Server restart | A redeploy must stop the old pid first, else the new process fails with EADDRINUSE or the old code keeps serving. Verify via a version endpoint. |
| 12 | No Node in container / old Node | Install a user-level Node into `~/.local/node` (no sudo). |

## Checklist before telling the user "deployed"
- [ ] Container running, project private (`is_public` false).
- [ ] App listening on `0.0.0.0:<port>` in the background, pid + log files present.
- [ ] Port mapping exists; URL printed from `host_port`.
- [ ] Version/health endpoint returns the new version.
- [ ] No secrets in any file you created or committed.
- [ ] You told the user what was **not** verified (e.g. could not reach the server from the sandbox).
