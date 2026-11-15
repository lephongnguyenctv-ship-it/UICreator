---
name: craftland-auto-save-format
description: Install or update the Craftland FC auto-save formatter in a local Windows project for Codex or Claude Code. Use when a developer asks to install auto-save-format, copy the standard Craftland .vscode setup, configure Format FC Code for .fcg files, or install Trigger Task on Save. Runs the bundled deterministic installer, merges missing VS Code configuration without overwriting existing JSON values, replaces a conflicting formatter only after backup, installs gruntfuggly.triggertaskonsave, and verifies the result.
type: development-skill
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-08-30
---

# Craftland Auto-Save Format

Install the bundled `.vscode` snapshot with the deterministic PowerShell
installer. Do not reproduce its merge logic manually.

## Install

1. Resolve the target project to an existing absolute Windows path. Use the
   current workspace when the user says “this project.”
2. Resolve the umbrella-skill root from this file (`development/..`).
3. Run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "<skill-root>\scripts\install_auto_save_format.ps1" -ProjectPath "<absolute-project-path>"
   ```

4. Treat exit code `0` plus `installed and verified successfully` as success.
   Report any backup path and warnings. Never claim success after a nonzero
   exit code.

Use `-WhatIf` only for a requested preview. Use `-CodeCommand` when the VS Code
CLI is available under a command other than `code`.

## Installed behavior

- Trigger `Format FC Code` on save for `**/*.fcg` through
  `gruntfuggly.triggertaskonsave`.
- Run `.vscode/format-fc.ps1` through Windows PowerShell.
- Write formatted FC code as UTF-8 without BOM.
- Preserve existing JSON values and add only missing configuration. Back up and
  replace a conflicting `format-fc.ps1` because its rule order is significant.
- Install only `gruntfuggly.triggertaskonsave`; keep
  `craftLandstudio.ffugclanguage` as a VS Code recommendation.

The bundled source snapshot lives at
[`../assets/auto-save-format/.vscode`](../assets/auto-save-format/.vscode).

