# Craftland PUGC Repository Instructions

This repository is the canonical source for the `craftland-pugc` umbrella
skill. Do not split individual workflows into standalone skills.

## Automatic bootstrap

At the start of the first task in this repository, check the global Codex and
Claude Code copies:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\provision_craftland_pugc.ps1" -Target Both -Check
```

If the command exits `2`, immediately run it again without `-Check`. The user
has authorized this repository-scoped bootstrap. Continue only after a final
`-Check` exits `0`; report any other non-zero exit instead of claiming the
skill is installed.

Read `SKILL.md` for routing. When changing knowledge or workflows, follow the
Update Protocol in `CONTRIBUTING.md` and keep all capabilities inside this umbrella.
