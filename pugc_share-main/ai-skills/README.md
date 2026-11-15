---
folder: AI Skills
title: AI Skills — Shared Skill Library
domain: craftland-ugc
status: authoritative
version: 1.4.0
last_updated: 2026-11-11
---

# AI Skills

A place to **share AI skills** — reusable, self-contained skill definitions that
AI agents can load and execute.

## Scope
- Generic, reusable AI skills not tied to a single domain.
- Each skill is one `.md` file with YAML frontmatter (`name`, `description`)
  describing when and how to use it.

## What belongs here
- ✅ Reusable AI skills meant to be shared/loaded by agents.
- ❌ Domain-specific operational knowledge (development/publishing) → put it in
  its domain folder and, if reusable, reference it from here.

## Authoring convention
Every skill file **MUST** start with frontmatter:

```yaml
---
name: <kebab-case-skill-name>
description: <when to use this skill + what it does>
---
```

## Contents
| Skill | File | Purpose |
|---|---|---|
| Data & Tooling Patterns | [`data_tooling_patterns.md`](data_tooling_patterns.md) | Proven patterns for reading master data xlsx (openpyxl/pandas pitfalls, Drive truncation trap), building/patching single-file HTML balance calculators with headless verification, draw.io XML generation, and Google Sheets export. |
| AI Agent Session Workflow | [`ai_agent_session_workflow.md`](ai_agent_session_workflow.md) | Running AI-assisted work across sessions: Cowork vs Claude Code, token economy, one entry file + routing table + progress log, per-session protocol, prompt templates, quality gates, and lessons for adopting large agent frameworks. |
| ↳ Prompt Templates & Framework Lessons | [`ai_agent_prompt_templates.md`](ai_agent_prompt_templates.md) | Copy-paste session start/end prompts, worked example, anti-patterns, lessons from large agent frameworks. |
| Prompt Master | [`prompt-master/SKILL.md`](prompt-master/SKILL.md) | Generates optimized prompts for AI tools (LLMs, coding agents, image/video/voice AI, etc.). Index with detail files in `prompt-master/references/`. |


## Related domain tooling

- [Game Balance & Visualization Knowledge Pack](../game-design/knowledge-pack/README.md):
  multi-page game balance site, config mirrors and player-simulator pipelines. This
  domain-specific reference lives under Game Design; generic spreadsheet/calculator/diagram
  methods remain in [Data & Tooling Patterns](data_tooling_patterns.md).


- [Analytics Website Builder](../development/analytics-website-builder/README.md): authenticated
  Sheets analytics/internal websites, privacy-safe exports, caches and optional analyst prompts.
  The maintained implementation reference lives under Development; performance interpretation
  remains in Publishing.
