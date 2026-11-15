---
doc_type: contributing_guide
project: pugc_share
title: Contributing — Update Protocol for AI Agents
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-11-03
---

# Contributing to the Craftland PUGC Knowledge Base

Read this only when **adding or editing** knowledge. For finding knowledge, use
[`SKILL.md`](SKILL.md) and [`README.md`](README.md).

## Conventions

- Each folder has **exactly one `README.md`** explaining its scope and listing its contents.
- Each skill file uses YAML frontmatter (`name`, `description`); see the authoring template in
  [`CLAUDE.md`](CLAUDE.md#authoring-template-for-a-new-skill-md).
- **Single source of truth:** shared rules live in `general-knowledge`; other skills link to them
  instead of redefining (prevents drift).
- **Keep files short for agents:** when a skill file grows past ~150 lines or ~12 KB, keep a short
  index (purpose, rules, a table of detail files) and move bulky reference sections verbatim into
  linked detail files. Keep each moved section's heading in the index with a one-line summary and
  link, so existing anchors still resolve.

## Update Protocol for AI Agents (MUST follow)

Before **adding or updating** any skill/knowledge file, an agent **MUST** run
this checklist to avoid duplication and keep files in the right place.

### Step 1 — Duplicate check (do this FIRST)
1. Read the root [`README.md`](README.md) and the **README of every folder** to see existing skills.
2. Search the repo for overlap by:
   - **`name`** in frontmatter (must be unique, kebab-case),
   - **topic/keywords** in the `description` and headings.
3. Classify the result:
   - **Exact/strong overlap** → **UPDATE the existing file**. Do **not** create a
     new one. (e.g. tier rules already live in `tier_list_definition.md`.)
   - **Partial overlap** → extend the existing file, or extract the shared part
     into `general-knowledge` and link to it from both (prevent drift).
   - **No overlap** → create a new file (Step 2).
4. If a duplicate already exists, **report it** and propose merging instead of
   adding.

### Step 2 — Pick the correct folder & filename
Use this decision guide to suggest the location:

| If the skill is about… | Put it in | Notes |
|---|---|---|
| Building/implementing maps or deploying team web/services | `development/` | scripting, tooling, build process; provider deployment references in `deployment/` |
| Gameplay/mode design | `game-design/` | how a mode plays, balancing, progression |
| Publishing, performance, release/scaling decisions | `publishing/` | post-build, launch, retention |
| Reusable, domain-agnostic AI skill | `ai-skills/` | loadable by any agent |
| A definition reused by 2+ folders | `general-knowledge/` | single source of truth |

**Filename rule:** `lower_snake_case.md`, descriptive of the content
(e.g. `release_pipeline_decision_making.md`). The frontmatter `name` is
`kebab-case` and unique across the repo.

> **Rule of thumb:** if a value/rule would be copied into a second file, it does
> **not** belong in either skill — move it to `general-knowledge` and link.

### Step 3 — Register & cross-link
1. Add a row for the new/updated file in its **folder README** Contents table.
2. If it introduces a cross-cutting concept, add it to **Key Cross-References**
   in [`README.md`](README.md#key-cross-references) and link related skills both ways.
3. Update the `last_updated` (and bump `version`) in the file's frontmatter.
4. If routing changes, update [`SKILL.md`](SKILL.md) and add a [`CHANGELOG.md`](CHANGELOG.md) entry.

### Step 4 — Verify
- Confirm no two files define the same rule (single source of truth holds).
- Confirm all relative links resolve (folder names are lowercase, no spaces).
