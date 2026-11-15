---
name: craftland-skill-provisioning
description: Provision, repair, or update the Craftland PUGC umbrella skill for Codex and Claude Code without maintaining separate skill copies by hand.
type: development-skill
status: authoritative
version: 1.0.0
last_updated: 2026-08-30
---

# Craftland PUGC Skill Provisioning

Use this workflow when the user asks to install, update, sync, repair, or check
the `craftland-pugc` skill for Codex or Claude Code.

## Canonical Targets

- Codex: `$HOME/.agents/skills/craftland-pugc/`
- Claude Code: `$HOME/.claude/skills/craftland-pugc/`

Both targets receive the same umbrella skill payload. Do not create a separate
skill for auto-save-format or any other capability in this repository.

## Agent Workflow

1. Resolve the directory containing this file, then resolve the umbrella root
   one directory above it.
2. Check whether the requested targets are current:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "<umbrella-root>\scripts\provision_craftland_pugc.ps1" -Target Both -Check
   ```

3. Interpret exit codes:
   - `0`: all requested targets are installed and byte-for-byte current.
   - `2`: at least one target is missing or outdated; run the same command
     without `-Check`.
   - any other non-zero code: stop and report the error.
4. After provisioning, run `-Check` again and report both resolved target
   paths. Do not claim success unless the second check exits `0`.

Use `-Target Codex` or `-Target Claude` only when the user explicitly limits
the installation to one agent. The default team setup is `-Target Both`.

## Behavior and Safety

The provisioner:

- copies the whole umbrella payload while excluding repository metadata,
  agent-local directories, caches, and temporary test artifacts;
- compares relative file paths and SHA-256 hashes before writing;
- does nothing when a target is already current;
- installs through a staging directory, verifies the staged payload, and
  atomically swaps it into place;
- rolls the previous target back if installation or verification fails;
- refuses to replace a symlink or other reparse-point target;
- supports `-WhatIf` and a test/admin-only `-UserProfilePath` override.

Run the canonical source repository's provisioner after pulling changes. A copy
already installed under an agent's home can repair the other target, but it
cannot discover newer commits that exist only in the source repository.

## Bootstrap Boundary

A skill cannot trigger before the agent has discovered it. If neither global
target exists, open the canonical `pugc_share` repository once with Codex or
Claude Code. Its root `AGENTS.md` and `CLAUDE.md` instruct the agent to run this
provisioner automatically when the global copies are missing or outdated.

After that first bootstrap, prompts such as “Cài Craftland auto format khi save
vào project này” can discover this umbrella skill from any project and route to
[`auto_save_format.md`](auto_save_format.md).
