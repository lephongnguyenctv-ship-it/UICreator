---
doc_type: knowledge_base_index
project: pugc_share
title: Craftland PUGC — Skills & Knowledge Base
domain: craftland-ugc
audience: AI agents (parsers), Craftland team
status: authoritative
version: 1.15.0
last_updated: 2026-11-03
source_of_truth: true
parsing_notes: >
  ROOT index. Six top-level folders, each with its own README listing its files.
  Shared/canonical definitions live in general-knowledge and are referenced, not
  duplicated. Task routing lives in SKILL.md; the Update Protocol in CONTRIBUTING.md.
folders:
  - development
  - game-design
  - ai-skills
  - publishing
  - general-knowledge
  - games
---

# Craftland PUGC — Skills & Knowledge Base

Skills & knowledge for the Craftland/UGC (Free Fire PUGC VN) team, packaged as an
installable umbrella skill for Claude Code, Claude Desktop/claude.ai, Codex or any agent
that reads Markdown.

| Need | File |
|---|---|
| Route a task to the right file | [`SKILL.md`](SKILL.md) |
| Add or edit knowledge (Update Protocol) | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Install / package the skill | [`INSTALL.md`](INSTALL.md) |
| What changed | [`CHANGELOG.md`](CHANGELOG.md) |

Every skill `.md` carries YAML frontmatter (`name`, `description`) — the metadata agents use
to discover it. `README.md` files are **indexes**, not triggerable skills.

## Folders

| Folder | Purpose | Index |
|---|---|---|
| **Development** | Map development, team workflow/tooling, pre-release tests, multiplayer performance, code review, UI/UX mockups, analytics websites, deployment | [development/README.md](development/README.md) |
| **Game Design** | Pure design foundations, Craftland mode/gameplay design, economy, rewards, burn rate, tag viability, balance knowledge pack | [game-design/README.md](game-design/README.md) |
| **AI Skills** | Reusable, domain-agnostic AI skills (data tooling, AI session workflow) | [ai-skills/README.md](ai-skills/README.md) |
| **Publishing** | Performance reads, cohorts, release/scale/drop decisions | [publishing/README.md](publishing/README.md) |
| **General Knowledge** | Canonical shared definitions (tier list, large-number notation) | [general-knowledge/README.md](general-knowledge/README.md) |
| **Games** | Per-game rulings, locked configs, benchmarks — one subfolder per live game | [steal-a-pet](games/steal-a-pet/README.md) · [dig-your-garden](games/dig-your-garden/README.md) · [plants-vs-zombies](games/plants-vs-zombies/README.md) |

## How To Navigate (for AI agents)

1. Find the task in [`SKILL.md`](SKILL.md) routing; otherwise identify the domain above.
2. Open that folder's README and read only the files it points to.
3. Resolve shared definitions from `general-knowledge` — read the definition, never a copy.
4. If the task names a specific game, read that game's folder first; locked decisions are not re-litigated.

## Key Cross-References

| Topic | Canonical owner | Related |
|---|---|---|
| Tier assignment | [`tier_list_definition.md`](general-knowledge/tier_list_definition.md) | [`game_performance_evaluation.md`](publishing/game_performance_evaluation.md) assigns tiers with it; [Analytics Website Builder](development/analytics-website-builder/README.md) reuses it |
| Economy values ↔ large numbers | [`large_number_notation.md`](general-knowledge/large_number_notation.md) | [`reward_gift_code_config.md`](game-design/reward_gift_code_config.md) |
| Multiplayer performance | [`performance_optimization.md`](development/performance_optimization.md) | [client](development/client_performance_test.md) / [server](development/server_performance_test.md) tests keep release gates; [database pack](development/code-review/database/rule.md) keeps persistence rules |
| Code review | [`code_review.md`](development/code_review.md) | registered packs under `development/code-review/` |
| Release / hotfix operations | [`release_guideline.md`](development/release_guideline.md) | hosting steps in [Deployment](development/deployment/README.md) |
| Internal web apps & hosting | [Analytics Website Builder](development/analytics-website-builder/README.md) | [RUN Platform](development/deployment/run-platform/README.md); performance rules stay in Publishing |
| Config-driven balance, simulator, balance site | [Knowledge Pack](game-design/knowledge-pack/README.md) | worked example [Plants vs Zombies](games/plants-vs-zombies/README.md); config reading in [Data & Config Patterns](development/craftland_data_config_patterns.md); UI/UX method in [UI/UX Mockup](development/ui_ux_mockup.md) |
| AI-assisted work & hand-off | [AI Agent Session Workflow](ai-skills/ai_agent_session_workflow.md) | long projects: [Documentation hand-off](game-design/knowledge-pack/05-playbooks/04_documentation_handoff.md) |
| New team members, tools | [`team_onboarding.md`](development/team_onboarding.md) | [`team_tooling_reference.md`](development/team_tooling_reference.md) |
| ZIP packaging & credential exclusions | [`INSTALL.md`](INSTALL.md#packaging-exclusions) | `scripts/package_skill.py`, `scripts/test_package_skill.py` |
