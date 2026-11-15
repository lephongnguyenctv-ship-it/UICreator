---
doc_type: knowledge_pack_index
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/README.md"
---

# Game Balance & Visualization Knowledge Pack

A methodology reference pack integrated into the `craftland-pugc` umbrella, extracted from a real project: a game designer (Tomo) and an AI agent
balanced a Craftland (Free Fire UGC) tower-defense/idle game ("plants vs zombies" style) over ~6 weeks,
and built an internal **balance website** (Node.js) that reads the game's real config, simulates players,
and visualizes pacing, economy, content, skills, items and UI/UX mockups.

**Goal of this pack:** any AI agent that reads this folder should be able to rebuild a similar website
and apply the same balancing approach to another game — without needing the original conversation. This repository imports documentation only; the original website, simulator code, config, and assets are not included.

Everything here is *method + patterns + lessons*. Game-specific numbers appear only as worked examples.

## Integration and applicability

This folder is a reference module of the existing umbrella, not a standalone installable skill.
Start from [Game Design](../README.md) or the [umbrella routing](../../SKILL.md).
Source: `plant-vs-zombie/GDD/knowledge-pack/`, imported on 2026-10-09; updated 2026-10-23 with D96–D98 and the documentation hand-off (project game folder: [`games/plants-vs-zombies`](../../games/plants-vs-zombies/README.md)).
Numbered detail filenames use `lower_snake_case.md`; the track structure is preserved.

The source project's levels, prices, caps, palettes, cohort minutes, boss targets, simulator performance,
and preferences are **worked examples**, not team-wide defaults or verified current game state.
Check the target game's real code/config and approved decisions before reusing them.
Historical decisions can describe different revisions; do not combine them into one current baseline.
Imported workflow instructions describe the source collaboration; the current user's request governs
scope, approvals, edits, commits, exports, and any external delivery.

| Overlap | Canonical owner / integration result |
|---|---|
| UI/UX methodology, 8 detail files | Byte-for-byte identical to [Craftland UI/UX Mockup](../../development/ui_ux_mockup.md); reuse those files, do not keep a second copy here. |
| General Craftland design and player-segment fit | [Craftland Game Design](../craftland_game_design.md); this pack adds the worked balance workflow. |
| Earn rates, rotation shops, event simulation and fairness gates | [Live-Ops Economy Design](../live_ops_economy_design.md); this pack adds a whole-game player model and config-driven tool pipeline. |
| Exhaustible content, cohort burn horizons and post-burn audit | [Feature Burn-Rate Balancing](../feature_burn_rate_balancing.md); this pack's content roadmap is a project example. |
| Reward/grant schemas and distribution validation | [Reward & Gift-Code Configuration](../reward_gift_code_config.md). |
| Single-file calculators, spreadsheet/diagram/export tooling | [Data & Tooling Patterns](../../ai-skills/data_tooling_patterns.md); this pack adds a multi-page balance site. |
| Shared performance tiers and number notation | [Tier List Definition](../../general-knowledge/tier_list_definition.md) and [Large Number Notation](../../general-knowledge/large_number_notation.md). |
| Icon cutout, redraw and keyline audit | New reference material in [04-ui-ux/icon-pipeline-skills](04-ui-ux/icon-pipeline-skills/README.md); example colors must be replaced with the target game's palette. |

## How to read

1. Start with [00-overview/](00-overview/README.md) (10 minutes). It explains the roles, the source collaboration principles and
   the end-to-end loop. Read [working principles](00-overview/02_working_principles.md) — the rules there (never fabricate,
   flag-and-ask, single source of truth, disclosure) are what made the collaboration work.
2. Then pick the track you need:
   - Balancing a game → [01-balance/](01-balance/README.md) then [02-simulator/](02-simulator/README.md).
   - Building the visualization site → [03-visualization/](03-visualization/README.md) (+ [02-simulator/](02-simulator/README.md) for the data it reads).
   - Rebuilding game UI/UX as HTML mockups → [04-ui-ux/](04-ui-ux/README.md) (routes to the existing canonical UI/UX method in `development/` and includes the icon pipeline references).
3. [05-playbooks/](05-playbooks/README.md) contains step-by-step checklists for recurring jobs (new feature, dev sync, playtest feedback).
4. [06-reference/](06-reference/README.md) has the glossary, a digest of ~98 source-project design decisions, and a historical file map; those implementation paths are not files in this repository.

## Folder structure

| Folder | File | What it teaches |
|---|---|---|
| `00-overview/` | [01_what_this_is.md](00-overview/01_what_this_is.md) | Context, roles, deliverables, the daily loop designer ↔ agent ↔ dev |
| | [02_working_principles.md](00-overview/02_working_principles.md) | Never fabricate; flag-and-ask; single source of truth; disclosure labels; decision log; commit discipline |
| `01-balance/` | [01_progression_pacing.md](01-balance/01_progression_pacing.md) | One progression spine (Boss Level), minute targets per level, player segments, learning/excitement curve, unlock spacing, onboarding rules |
| | [02_economy_and_sinks.md](01-balance/02_economy_and_sinks.md) | Income model, "price = minutes of income", coin sinks that never run dry (upgrade/level/break), inflation checks |
| | [03_power_formulas.md](01-balance/03_power_formulas.md) | Soft-cap curves with a ceiling, rarity multipliers, star/break as multiplicative layers, DPS model, element identity, skill expected value |
| | [04_content_and_rarity.md](01-balance/04_content_and_rarity.md) | Tiered seed pools, rarity gating by level, tail chance, species timeline targets, collection rewards, 3-month content roadmap rules |
| | [05_boss_and_zombie.md](01-balance/05_boss_and_zombie.md) | Fit boss HP to a target kill time, early-game ease for real humans, zombie HP growth vs capped plant power, leak checks |
| | [06_skills_mutations_items.md](01-balance/06_skills_mutations_items.md) | Skill EV = effect × uptime, equal-EV families, pools by rarity × element, mutation as income axis, splitting buffs into a ladder |
| | [07_balance_review_checklist.md](01-balance/07_balance_review_checklist.md) | The periodic "whole-game review" checklist and how to rank issues |
| `02-simulator/` | [01_monte_carlo_player_model.md](02-simulator/01_monte_carlo_player_model.md) | How the player bot decides (buy/level/break/merge/upgrade priority), what to model, what to log |
| | [02_derived_data_pipeline.md](02-simulator/02_derived_data_pipeline.md) | Rebuild order, fit loops, fingerprint-based staleness detection, proposal vs dev baselines |
| | [03_config_mirror_and_sync.md](02-simulator/03_config_mirror_and_sync.md) | CSV ↔ JSON mirror, import from the game repo, export for dev, check-sync, dev action items |
| `03-visualization/` | [01_site_architecture.md](03-visualization/01_site_architecture.md) | Node/Express + static pages, model modules, `/api/*?dataset=dev` pattern, nav, version badge, compact/full mode |
| | [02_page_patterns.md](03-visualization/02_page_patterns.md) | Reusable page patterns: heatmap matrix, timeline strip, gantt, KPI cards, filter bar, pack popup, proposal-vs-dev diff |
| | [03_page_catalog.md](03-visualization/03_page_catalog.md) | The 20+ pages the site ended with, what question each answers, which data it reads |
| | [04_verification_without_browser.md](03-visualization/04_verification_without_browser.md) | jsdom harness to test pages when the agent cannot see a screen |
| `04-ui-ux/` | [01_ui_ux_overview.md](04-ui-ux/01_ui_ux_overview.md) | Summary of the canonical UI/UX mockup method in `development/`; lessons from 30+ feedback rounds |
| | [02_icon_pipeline.md](04-ui-ux/02_icon_pipeline.md) | Making rarity-keyline icons from raw plant renders (background removal, crop, keyline) |
| | [03_design_rounds_and_feedback.md](04-ui-ux/03_design_rounds_and_feedback.md) | Options → pick → tweak loop; what designers typically ask for (less text, dock to top, pacing of reward animation) |
| | [development/ui_ux_mockup.md](../../development/ui_ux_mockup.md) | Existing canonical 8-part method (not copied): inputs, `.ui` coordinates → CSS, 9-slice/tint/outline primitives, component kit, scene anchoring, verification, tool scaffold, disclosure |
| | [icon-pipeline-skills/README.md](04-ui-ux/icon-pipeline-skills/README.md) | Icon processing references (cutout → redraw → rarity keyline) with audit gates |
| `05-playbooks/` | [01_new_balance_feature.md](05-playbooks/01_new_balance_feature.md) | End-to-end checklist for balancing a new system |
| | [02_dev_sync.md](05-playbooks/02_dev_sync.md) | What to do when the dev pushes commits |
| | [03_playtest_feedback.md](05-playbooks/03_playtest_feedback.md) | Turning "it feels hard/slow/boring" into config changes |
| | [04_documentation_handoff.md](05-playbooks/04_documentation_handoff.md) | Docs another agent can take over: status labels, handbook, generated facts with checks, decision index, cold-read test |
| `06-reference/` | [01_glossary.md](06-reference/01_glossary.md) | Terms used across the pack |
| | [02_decision_log_digest.md](06-reference/02_decision_log_digest.md) | Digest of the design decisions (D1–D98) grouped by theme |
| | [03_file_map.md](06-reference/03_file_map.md) | Where the implementation lived in the original source project |

## One-paragraph summary of the method

Read the game's **real config and source code** first (never the designer's memory of it). Mirror the
config into JSON, build a **Monte Carlo player simulator** that plays the game from that config, and derive
every number on the website from the simulator + config (no hard-coded values). Choose **one progression
spine** (here: Boss Level) and express every target in **minutes of play** at a given level. Balance with
**formulas that have ceilings** (soft-caps) so adding content later never breaks prices. Make every
change through a **re-runnable apply script**, re-fit dependent values (boss HP, shop prices), rebuild all
derived data, update the decision log, and prepare CSVs plus a short **dev action-items** file. Commit
or deliver externally only when authorized by the current task. Present
2–3 **options** for anything visual, iterate on the designer's feedback, then consolidate to one. Always
**disclose** what is real data, what is a proposal, and what is a guess.


## Hosting the balance website

For deploying the internal web tool after it has been built, use the existing umbrella's
[Deployment index](../../development/deployment/README.md) and
[RUN Platform workflow](../../development/deployment/run-platform/README.md).
Keep site architecture and simulator/config methods in this pack; platform auth, container,
SSH, port mapping and redeploy details belong in that provider reference.


## Related Live Analytics Website

[Analytics Website Builder](../../development/analytics-website-builder/README.md) covers a persistent
performance-tracking/internal website backed by Google Sheets, with login, server-side privacy,
charts/exports, timeline editing and diagnostics. This balance pack retains simulator/config-mirror
methods; shared performance interpretation remains in Publishing.
