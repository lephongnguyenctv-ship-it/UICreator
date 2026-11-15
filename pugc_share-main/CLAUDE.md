# Working Instructions — Craftland PUGC Knowledge Base

> Agent operating guide for the `pugc_share` repository. Read this first, then
> use [`SKILL.md`](SKILL.md) for task routing and [`CONTRIBUTING.md`](CONTRIBUTING.md) for
> the full Update Protocol.

## What this repo is

An installable **umbrella skill** + flat Markdown knowledge base for the
Craftland PUGC (Free Fire User-Generated Content, VN) team. `SKILL.md` routes to
the right knowledge file; it never duplicates content. `general-knowledge/` is
the single source of truth that all other files reference.

## Automatic skill bootstrap

At the start of the first task in this canonical repository, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\provision_craftland_pugc.ps1" -Target Both -Check
```

Exit `0` means both global copies are current. If it exits `2`, run the same
command without `-Check`, then verify with `-Check` again. The user has
authorized this repository-scoped bootstrap. Stop and report any other
non-zero exit instead of claiming success.

The canonical targets are `$HOME/.agents/skills/craftland-pugc/` for Codex and
`$HOME/.claude/skills/craftland-pugc/` for Claude Code. Keep every capability
inside this umbrella; do not create standalone skills for individual rules.

## How Jay uses me here

Primary job: **author, create, and package new skill files** for this KB. When
asked to build a skill, I produce a properly-structured `.md` and prepare it for
delivery.

## Operating rules (agreed with Jay)

1. **Flag and ask first.** When I spot any problem — missing file, broken link,
   tier-label inconsistency, duplicate content, frontmatter error — I report it
   and wait for Jay's go-ahead before changing anything. No silent fixes, even
   trivial ones.

2. **Follow the Update Protocol exactly** (see [`CONTRIBUTING.md`](CONTRIBUTING.md) §Update
   Protocol). Every new/edited skill runs the full 4 steps:
   - **Step 1 — Duplicate check:** read the root README + every folder README;
     search for overlap by frontmatter `name` and by topic/keywords. Classify as
     exact overlap (update existing), partial overlap (extend or extract shared
     part into `general-knowledge`), or no overlap (create new).
   - **Step 2 — Pick folder + filename:** use the decision table in CONTRIBUTING.md.
     Filename = `lower_snake_case.md`; frontmatter `name` = unique `kebab-case`.
   - **Step 3 — Register + cross-link:** add a row to the folder README Contents
     table; add to Key Cross-References if cross-cutting; bump `version` and
     `last_updated` in frontmatter.
   - **Step 4 — Verify:** confirm single-source-of-truth holds (no rule defined
     twice) and all relative links resolve (lowercase folder names, no spaces).

3. **Tier labels use T-notation** — `T0, T1, T1-, T2, T2-, T3, T4`. This is the
   canonical form from
   [`general-knowledge/tier_list_definition.md`](general-knowledge/tier_list_definition.md).
   Do **not** introduce the longer "Tier 1-" form in new content. (2026-09-09:
   `publishing/game_performance_reader.md` — the file that still used the
   longer "Tier 1-" form — was retired and replaced by
   `publishing/game_performance_evaluation.md`, which uses T-notation only.)

4. **Single source of truth.** If a value/rule would be copied into a second
   file, it belongs in `general-knowledge/` and gets linked from both. Never
   re-derive tier rules locally — cite `tier_list_definition.md`.

5. **Packaging.** After authoring, build the installable ZIP with
   `python scripts/package_skill.py` (output: `~/Downloads/craftland-pugc-skill.zip`,
   contents under `craftland-pugc/`). Verify the first entry is
   `craftland-pugc/SKILL.md` and no path contains a space.

## Authoring template for a new skill `.md`

```yaml
---
name: <unique-kebab-case-name>
description: <when to use this skill + what it does — this is the trigger text>
type: <general-knowledge | publishing-knowledge | game-design-knowledge | development | ai-skill>
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: <YYYY-MM-DD>
---
```

Then the body: clear headings, tables over prose for rules/thresholds, and links
to `general-knowledge/` for any shared definition.

## Folder map (where things go)

| Topic | Folder |
|---|---|
| Building/implementing maps (scripting, tooling, build) | `development/` |
| Gameplay/mode design, balancing, progression | `game-design/` |
| Publishing, performance reads, release/scale/drop | `publishing/` |
| Reusable, domain-agnostic AI skill | `ai-skills/` |
| Definition reused by 2+ folders | `general-knowledge/` |

## Canonical reference points

- Tier system (T0–T4): `general-knowledge/tier_list_definition.md`
- Region performance reading: `publishing/game_performance_evaluation.md`
- Release fast-fail gates (R2 >25% / >30% / >40%): `publishing/release_pipeline_decision_making.md`
- What to build / concept viability: `game-design/game_tag_success_analysis.md`
