---
name: craftland-pugc
description: >
  Craftland PUGC (Free Fire UGC, Vietnam team) knowledge base plus pure game design theory. Use for
  any Craftland/UGC map, mode or event task: game design, GDDs, critique, brainstorming, balancing,
  economy and live-ops events, reward/gift-code config, player simulation, publishing and
  performance reads, tier ranks (T0-T4), release/scale/drop decisions, development workflow and
  lifecycle, pre-release tests, code/database/performance review, multiplayer performance
  optimization, Craftland CSV/config data, UI/UX mockups, analytics or internal websites, RUN
  Platform deployment, team onboarding/tooling, skill provisioning, and AI-agent session workflow.
  Also for game-specific work on Steal A Pet (SAP), Dig Your Garden (DYG) and Plants vs Zombies
  (PvZ). Trigger on: Craftland, PUGC, UGC map, game mode, GDD, R2 retention, DAU, survival time,
  rebirth, mutation, rotation shop, large numbers, Schell lenses, feedback loops, FPS/lag, code
  review, deploy, run.ingarena.net.
license: internal
metadata:
  type: umbrella-skill
  domain: craftland-ugc
  version: 1.19.0
  last_updated: 2026-11-03
  knowledge_root: "."
---

# Craftland PUGC — Skill

Installable **umbrella skill**: it routes to knowledge files and never duplicates them.
Route in two steps: find the task below, open the **index** it names (or the direct file),
then read only the file(s) that index points to.

## Routing (task → index → most-used files)

| Task | Open | Most-used files |
|---|---|---|
| Pure / platform-agnostic design theory (lenses, feedback loops, fun, uncertainty) | [`game-design/foundations/README.md`](game-design/foundations/README.md) | `core_lenses_and_principles.md`, `systems_and_cybernetics.md` |
| Craftland mode/event design, GDD, critique, brainstorming, Roblox-first comparable research | [`game-design/craftland_game_design.md`](game-design/craftland_game_design.md) | [research order](game-design/craftland_game_design.md#comparable-game-research-order); details: `craftland_platform_primer.md`, `craftland_feature_design_and_critique.md` |
| What to build, genre/tag viability | [`game-design/game_tag_success_analysis.md`](game-design/game_tag_success_analysis.md) | — |
| Economy, live-ops events, rewards/gift codes, feature burn rate | [`game-design/README.md`](game-design/README.md) | `live_ops_economy_design.md`, `reward_gift_code_config.md`, `feature_burn_rate_balancing.md` |
| Whole-game balance, player simulator, config sync, balance website, icons, playbooks, documentation hand-off | [`game-design/knowledge-pack/README.md`](game-design/knowledge-pack/README.md) | `01-balance/`, `05-playbooks/README.md` |
| Tier/rank definition (T0–T4), large-number notation | [`general-knowledge/README.md`](general-knowledge/README.md) | `tier_list_definition.md`, `large_number_notation.md` |
| Performance reads, cohorts, trends, release/scale/drop | [`publishing/README.md`](publishing/README.md) | `game_performance_evaluation.md`, `release_pipeline_decision_making.md` |
| Team cadence, onboarding, tools, lifecycle and milestones | [`development/README.md`](development/README.md) | `team_onboarding.md`, `team_tooling_reference.md`, `development_lifecycle_stages.md` |
| Pre-release tests, release/hotfix flow | [`development/README.md`](development/README.md) | `client_performance_test.md`, `server_performance_test.md`, `release_guideline.md` |
| Multiplayer performance (network, CPU, FPS, HUD, stress) | [`development/performance_optimization.md`](development/performance_optimization.md) | `performance-optimization/README.md` |
| Code, database, reconnect-spam, duplicate-reward, persistence or performance review | [`development/code_review.md`](development/code_review.md) | `code-review/<pack>/workflow.md` |
| Where Craftland projects keep balance data (CSV, CustomConfig, gates) | [`development/craftland_data_config_patterns.md`](development/craftland_data_config_patterns.md) | — |
| UI/UX HTML/CSS mockups from Craftland `.ui` files | [`development/ui_ux_mockup.md`](development/ui_ux_mockup.md) | `ui-ux-mockup/` |
| Analytics / internal websites (Sheets, Google login, charts) | [`development/analytics-website-builder/README.md`](development/analytics-website-builder/README.md) | numbered chapters |
| Deploying team web apps/services (RUN Platform) | [`development/deployment/README.md`](development/deployment/README.md) | [`run-platform/README.md`](development/deployment/run-platform/README.md) |
| Installing/updating this skill, FC auto-save format | [`development/README.md`](development/README.md) | `craftland_skill_provisioning.md`, `auto_save_format.md`, [`INSTALL.md`](INSTALL.md) |
| Spreadsheet reading, HTML calculators, draw.io, Sheets export | [`ai-skills/README.md`](ai-skills/README.md) | `data_tooling_patterns.md` |
| AI-assisted work across sessions (tool choice, tokens, AGENTS.md, prompts) | [`ai-skills/ai_agent_session_workflow.md`](ai-skills/ai_agent_session_workflow.md) | — |
| A named game: Steal A Pet · Dig Your Garden · Plants vs Zombies | [`games/steal-a-pet/README.md`](games/steal-a-pet/README.md) · [`games/dig-your-garden/README.md`](games/dig-your-garden/README.md) · [`games/plants-vs-zombies/README.md`](games/plants-vs-zombies/README.md) | `systems_reference.md`, `economy_benchmarks.md` |

Not listed? Open [`README.md`](README.md) (folder map) and the matching folder `README.md`.

## Context and Decision Rules

1. **Single source of truth:** `general-knowledge/` defines shared rules; cite it, never re-derive tiers locally.
2. **Named game first:** read that game's `README.md` + `systems_reference.md` before proposing designs;
   locked rulings are not re-litigated. Generic files stay game-agnostic; label redesigns as proposals.
3. **Read sources, not memory:** for live-game design/balance, read the actual GDD/Master Data first and
   flag assumptions explicitly before building.
4. **Designer-first:** use repository files as working context instead of sending the user to read them
   or to a named teammate. Escalate only when asked for handoff or when an unknown blocks the decision;
   otherwise state the assumption and continue.
5. **Feature requests:** name Primary, Secondary and Not-served/Protected users across New/Mid/Late
   progression, with explicit pros and cons.
6. **Knowledge-pack examples:** read its applicability note first; source-game numbers, palettes,
   preferences and delivery conventions never override the current task or approved decisions.
7. **AI-assisted builds:** follow the session protocol in
   [`ai-skills/ai_agent_session_workflow.md`](ai-skills/ai_agent_session_workflow.md); this repository's
   rules take precedence where they differ.
8. **Adding or editing knowledge:** follow [`CONTRIBUTING.md`](CONTRIBUTING.md) (duplicate check →
   folder/filename → register → verify).

## Installation

See [`INSTALL.md`](INSTALL.md) for Claude Code, Claude Desktop, Codex and other agents.
