---
doc_type: installation_guide
project: pugc_share
title: Installing the Craftland PUGC Skill
status: authoritative
version: 1.4.1
last_updated: 2026-11-03
---

# Installing the Craftland PUGC Skill

This repository is a **hybrid skill**: a flat Markdown knowledge base
(source of truth) plus a [`SKILL.md`](SKILL.md) packaging layer that makes it
installable into AI agents. Installing means making `SKILL.md` (and the
knowledge files it links to) discoverable by your agent.

> **Concept:** `SKILL.md` is the entry point. It *routes* the agent to the right
> knowledge file. Always install the **whole repository** so the relative links
> resolve.

---

## Recommended: Provision Codex and Claude Code Together

From the canonical `pugc_share` repository, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\provision_craftland_pugc.ps1" -Target Both
```

This installs the same umbrella payload into:

- Codex: `$HOME/.agents/skills/craftland-pugc/`
- Claude Code: `$HOME/.claude/skills/craftland-pugc/`

Verify without changing anything:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\provision_craftland_pugc.ps1" -Target Both -Check
```

Exit `0` means both copies are byte-for-byte current. Exit `2` means one or
both copies need provisioning. The installer stages and verifies a complete
copy before replacing an old target and rolls back if that replacement fails.

The root [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) run this check
when Codex or Claude Code first works inside the canonical repository. This is
the only unavoidable bootstrap boundary: an agent cannot trigger a skill that
has not yet been installed or otherwise discovered. Once bootstrapped, the
umbrella skill is available from every project.

---

## 1. Claude Code (CLI)

Claude Code discovers the provisioned `SKILL.md` at
`$HOME/.claude/skills/craftland-pugc/`. Use `-Target Claude` when installing
only Claude Code; the team default remains `-Target Both`.

After provisioning, start a fresh Claude Code session and ask: “What skills do
you have for Craftland?” The agent should load `SKILL.md` and follow its routing
table.

---

## 2. Claude Desktop / claude.ai

Skills are managed through the app UI (no CLI):

1. Open **Settings → Capabilities/Skills** (or your workspace's Skills section).
2. **Upload** the skill: build the ZIP with [the canonical packager](#packaging-the-skill-into-a-zip-for-ai-agents),
   then upload it, or add it as **Project Knowledge** by uploading the `.md` files.
3. Ensure `SKILL.md` is included so the agent gets the routing + triggers.

If only flat knowledge is supported (no SKILL.md packaging), upload `README.md`
first (it is the index) plus the folder `.md` files you need.

---

## 3. Codex

Codex discovers user-level skills under `$HOME/.agents/skills`. The provisioner
places this umbrella at `$HOME/.agents/skills/craftland-pugc/`; no pointer needs
to be added to every project's `AGENTS.md`. Use `-Target Codex` only when the
user explicitly does not want the Claude Code copy.

Start a fresh Codex task after the first installation so its skill discovery
snapshot includes the new umbrella skill.

---

## 4. Generic / Any AI Agent

Any agent that can read local Markdown can use this skill:

1. Make the repository available to the agent (local path or repo).
2. Point the agent at **[`SKILL.md`](SKILL.md)** as the entry file.
3. Instruct: *"Use the routing table in SKILL.md to open the relevant knowledge
   file for the task; treat `general-knowledge/` as the single source of truth."*

Minimal system-prompt snippet:
```text
You have a Craftland PUGC skill at <path>/SKILL.md. For any Craftland/UGC task
(research, analysis, coding, game design documents, balancing, release
decisions), read SKILL.md, follow its routing table to the right knowledge file,
and apply that file's rules. Do not re-derive tier rules — cite
general-knowledge/tier_list_definition.md.
```

---

## Automatic FC Auto-Save Format Installation

Codex and Claude Code can install the standard Craftland FC formatter into a
local Windows project without the developer copying `.vscode` files or
installing the extension manually. The umbrella skill must already be
available to the agent through one of the installation methods above.

Ask the agent:

```text
Install Craftland auto-save-format into this project.
```

For a different project, include its absolute path. The agent follows
[`development/auto_save_format.md`](development/auto_save_format.md) and runs
the bundled installer. A successful run must verify all JSON files, the
formatter hash, the `.fcg` save trigger, the VS Code task, and the installed
`gruntfuggly.triggertaskonsave` extension.

This workflow requires Windows, a local filesystem/shell, and the VS Code
`code` CLI. Claude Desktop and claude.ai cannot modify a local project without
a filesystem connector.

---

## Code Review

The umbrella skill supports read-only Code Review through registered reference
packs. Use the shared workflow and provide the reviewed project path explicitly:

```text
Use the Craftland PUGC skill to review the database of project D:\Craftland\DigAPet.
```

The workflow selects an explicitly requested pack first, or selects every pack
whose registered source signal is present when no pack is named. Database and
network packs are combined into one report when both apply. Every review must
create exactly one Vietnamese report at the reviewed project's root:

```text
code_review_{yyyyMMdd_HHmmss}_vi.md
```

The report is read-only evidence and recommendations; it does not modify the
reviewed project. Start a fresh Codex or Claude Code task after provisioning so
the new routing and review packs are included in skill discovery.

---

## Packaging the Skill into a ZIP (for AI agents)

Some targets (Claude Desktop / claude.ai **Settings → Capabilities**) require an
**uploaded ZIP** rather than a local folder. Follow these rules to produce a
valid skill ZIP.

### Requirements for a valid skill ZIP
1. **One top-level folder** named after the skill: `craftland-pugc/`.
   All files must live **inside** it (not at the zip root).
2. **`SKILL.md` at the root of that folder** (`craftland-pugc/SKILL.md`).
3. **No spaces or special characters in any path.** All folder/file names must be
   lowercase with `-` or `_` only. (This repo is already compliant — do **not**
   reintroduce spaces.)
4. Use the [canonical packager](scripts/package_skill.py) so metadata, credential files and
   symlinks are excluded according to the policy below. Keep both PowerShell installers
   and `assets/auto-save-format/` in the package.
5. Keep relative links intact — since folder names match the repo, links resolve
   as-is (no rewriting needed).

### Recommended: use the script
```bash
python scripts/package_skill.py
# → ~/Downloads/craftland-pugc-skill.zip   (contents under craftland-pugc/)
```
Optionally pass a custom output path:
```bash
python scripts/package_skill.py /path/to/output.zip
```

### Packaging exclusions

The canonical policy is implemented in [scripts/package_skill.py](scripts/package_skill.py).
It applies case-insensitively at every directory depth:

| Category | Excluded examples |
|---|---|
| Repository/agent metadata and helper artifacts | `.git/`, `.agents/`, `.claude/`, `.codex/`, `__pycache__/`, packaged `.skill` archives, packaging/test helpers and the temporary check file. |
| Environment files | `.env`, `.env.*`, `.envrc`, `*.env`, `*.env.*` (including environment example files). |
| Key/certificate and credential containers | `.pem`, `.key`, `.p8`, `.ppk`, `.p12`, `.pfx`, `.jks`, `.keystore`, `.kdbx`; standard `id_rsa`, `id_dsa`, `id_ecdsa`, `id_ed25519` names and suffix variants. |
| Credential config files | `credential`/`credentials`/`secret`/`secrets` with extensions; `service-account*.json`, `service_account*.json`, `serviceaccount*.json`; `.netrc`, `_netrc`, `.npmrc`, `.pypirc`, `.git-credentials`. |
| Credential directories | `.ssh/`, `.aws/`, `.azure/`, `.gcloud/`, `.gnupg/`, `.kube/`, `secrets/`, `.secrets/`, `credentials/`, `.credentials/`, `private_keys/`, `private-keys/`. |
| Links and current output | File/directory symlinks and Windows reparse points; the output ZIP itself if it is inside the repository. |

The non-secret RUN `deploy-config.example` and required `.vscode` assets remain included.
These are filename/path filters, not a content-based secret detector: credentials embedded in
ordinary Markdown, source code or arbitrarily named config files still require review before sharing.
The filters govern the ZIP packager; they do not change Git tracking or the separate global provisioner.

### PowerShell invocation

Use the same filtered packager on Windows:

```powershell
python .\scripts\package_skill.py "$env:USERPROFILE\Downloads\craftland-pugc-skill.zip"
```

### Bash invocation

```bash
python scripts/package_skill.py "$HOME/Downloads/craftland-pugc-skill.zip"
```

### Regression check

```bash
python scripts/test_package_skill.py
```

The checks create temporary fixtures with dummy credentials, verify excluded files are absent,
confirm required knowledge/assets/templates remain intact, and test output ZIP and symlink handling.
Symlink checks are skipped explicitly if the host does not allow creating links.

### Verify before uploading
- Open the zip; confirm the first entry is `craftland-pugc/SKILL.md`.
- Confirm no path contains a space or `%20`.
- Confirm both PowerShell installers under `craftland-pugc/scripts/` and all five
  files under `craftland-pugc/assets/auto-save-format/.vscode/` are present.

---

## Updating

After pulling new versions into the canonical repository, run
`scripts/provision_craftland_pugc.ps1 -Target Both` again. It updates only
outdated targets and is a no-op when both copies are current.
For Claude Desktop chat, **re-run the packaging step** and re-upload the ZIP.
When **editing** skills, follow the **Update Protocol for AI Agents** in
[`CONTRIBUTING.md`](CONTRIBUTING.md).
