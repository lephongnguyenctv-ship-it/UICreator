---
title: Changelog — Craftland PUGC Skills & Knowledge Base
domain: craftland-ugc
status: authoritative
---

# Changelog

Notable changes to this knowledge base. Each entry corresponds to the
`version` / `last_updated` bump recorded in the frontmatter of the files
listed (per the Update Protocol in [`CONTRIBUTING.md`](CONTRIBUTING.md)). This file is
a summary index, not a source of truth — the frontmatter on each file is
canonical.

## 2026-11-12

### Fixed

- `development/effect-generation/` (effect pipeline) — iOS crash from non-square textures. iOS uses PVRTC, which only accepts square power-of-two textures; a 128x32 `trail` made iPhone texture creation fail and crash the game, while Android (ETC2) and PC/simulator (DXT5) accept non-square. `scripts/fab_textures.py` `encode_chain` now stretches non-square textures to a square (longest side) for IOS only (trail 128x32 → 128x128, as in the artist's sample). `SKILL.md` (Limits, `trail` row, custom-PNG ask) and `references/artist-style.md` (Textures rule) document the square + power-of-two requirement.

## 2026-11-11

### Added

- `ai-skills/prompt-master/` (SKILL.md 1.8.2) — generates optimized prompts for AI tools; detail files `references/templates.md` and `references/patterns.md`; registered in `ai-skills/README.md` (1.4.0).

## 2026-11-03

Restructured for agent reading efficiency: always-loaded entry files are ~60% smaller and
long skill files are split into a short parent plus verbatim detail files (no content removed;
moved headings stay in the parent as one-line stubs, so existing anchors still resolve).

### Added

- `ai-skills/ai_agent_session_workflow.md` (1.1.0) + detail `ai_agent_prompt_templates.md` (1.0.0) — running AI-assisted work across sessions: Cowork vs Claude Code, token economy, project setup (one `AGENTS.md` entry file with a routing table, `CLAUDE.md` import, progress log, task recipes), session protocol, quality gates, prompt templates and lessons from reviewing Claude Code Game Studios; precedence: repository protocols, existing logs and stricter approval rules win.
- `CONTRIBUTING.md` (1.0.0) — the Update Protocol and conventions, moved verbatim from `README.md`, plus a file-length convention (~150 lines / ~12 KB → index + detail files).
- Detail files (1.0.0), content moved verbatim from their parents: `game-design/craftland_platform_primer.md`, `craftland_retention_and_room_dynamics.md`, `craftland_feature_design_and_critique.md`, `live_ops_event_prediction.md`, `game_tag_evidence_by_tag.md`; `game-design/foundations/schell_112_lenses_master_index.md`, `rules_emergence_and_information.md`.

### Changed

- `SKILL.md` (1.19.0): 19.4 KB → ~7 KB. Two-level routing table (task → index → most-used files); `description` cut from ~3,000 to 971 characters (Agent Skills limit 1,024); rules renamed "Context and Decision Rules", which repairs the `SKILL.md#context-and-decision-rules` links in 7 files; new rule 7 (AI-assisted builds) and rule 8 (CONTRIBUTING.md).
- `README.md` (1.15.0): 13 KB → 5 KB. Folder tree removed (folder READMEs list contents); Key Cross-References as one table; Update Protocol moved to `CONTRIBUTING.md`.
- Parents shortened: `craftland_game_design.md` (1.4.0, 23 → 12 KB), `foundations/core_lenses_and_principles.md` (1.1.0, 19 → 10 KB), `live_ops_economy_design.md` (1.7.0, 17 → 11 KB), `foundations/systems_and_cybernetics.md` (1.1.0, 13 → 9 KB), `game_tag_success_analysis.md` (1.1.0, 12 → 6 KB).
- Indexes register the detail files: `game-design/README.md` (1.10.0), `game-design/foundations/README.md` (1.1.0), `ai-skills/README.md` (1.3.0).
- Update Protocol links now point to `CONTRIBUTING.md`: `CLAUDE.md`, `AGENTS.md`, `INSTALL.md` (1.4.1), this file's header.
- `game-design/knowledge-pack/05-playbooks/04_documentation_handoff.md` (1.0.1): back-link to the session workflow.

## 2026-10-27

### Added

- `development/ui-ux-mockup/09-design-tokens-and-layout.md` — why mockups drift (hand-computed absolute coordinates, free per-screen values, content inside `border-image`), build modes A (rebuild from `.ui`) vs B (new design, flow layout), token sheet, popup spacing rhythm.
- `development/ui-ux-mockup/10-component-kit-templates.md` + `templates/` — ready-to-copy kit: `ui-kit.css` (tokens, flow layout, skin/content layering, outline debug), `ui-kit.js` (skin registry, primitives, 15 semantic components; browser + Node), `example-screens.js` (screen registry template), `kit-gallery.html` (component gallery), `layout-lint.js` (no-browser lint for type scale, grid, colors, popup height, overflow, overlap, manual positioning; `--self-test`), `component-spec.template.md`.
- `development/ui-ux-mockup/11-component-extraction-workflow.md` — inventory → measure/cluster values → specs → gallery → golden screens → gradual migration, with source-project failure lessons.

### Changed

- `development/ui_ux_mockup.md` (1.1.0): detail table 9–11, process step 3/5 point to the kit and lint.
- `ui-ux-mockup/04` hard rules + link to the kit; `06` layers 5 (layout lint) and 6 (golden screens) + checklist; `08` principle #0 (state the build mode).
- `game-design/knowledge-pack/04-ui-ux/01_ui_ux_overview.md` (1.1.0) notes the change; `SKILL.md` (1.17.0), `README.md` (1.13.0), `development/README.md` (1.10.0) routes updated.

## 2026-10-23

### Added

- `development/craftland_data_config_patterns.md` (1.0.0) — where a data-driven Craftland project keeps balance values (Assets/CSV + CSVIndex, CustomConfig.fcc, access/gate tables, virtual packs, fileId icons), load-time validation traps, CSV-vs-code delivery split, read-only repo workflow with `origin/main`.
- `game-design/knowledge-pack/05-playbooks/04_documentation_handoff.md` (1.0.0) — document status labels, agent handbook, generated facts with automatic checks, decision index + contradictions table, cold-read acceptance test.
- `games/plants-vs-zombies/` (README + `systems_reference.md`, 1.0.0) — PvZ pillars, rulings with decision IDs, dated key values, codebase traps, project source-of-truth paths.

### Changed

- Knowledge pack 1.1.0 (from PvZ D96–D98 and v5.17–v5.19): unlock-order integrity and QoL-shortcut timing (`01_progression_pacing`), reward value per hour + converter rules (`02_economy_and_sinks`), trigger × action skill EV model, element skill-pool identity and pool traps (`06_skills_mutations_items`, `03_power_formulas`), spawn director, special enemies and fit-script warning (`05_boss_and_zombie`), review checklist, simulator director/special modelling and `origin/main` sync (`02-simulator`), export button and out-of-tree deploy packaging (`03-visualization`), later UI rounds (`04-ui-ux/03`), dev-sync summary step, digest D97–D98, glossary, file map.
- `SKILL.md` (1.16.0), `README.md` (1.12.0), `development/README.md` (1.9.0), `game-design/README.md` (1.9.0) register the new files and routes.

## 2026-10-18

### Added

- `development/performance_optimization.md` and `development/performance-optimization/` — generic multiplayer server/client performance guidance from Steal A Pet lessons: network, loops/caches, persistence boundaries, visuals, HUD, reproducible measurement and pitfalls.
- `development/code-review/performance/` — registered four-file `PERF` reference pack with 11 source-verifiable rules and a Vietnamese report example.

### Changed

- `SKILL.md` (1.15.0), `README.md` (1.11.0), `development/README.md` (1.8.0), and `development/code_review.md` (1.1.0) register routing and the new pack.
- `development/client_performance_test.md` and `development/server_performance_test.md` (1.1.1) cross-link implementation guidance while retaining their release-test standards.

## 2026-10-14

### Added

- `development/analytics-website-builder/` — imported the source entry as an umbrella reference
  README plus 19 topic guides for configurable Sheets analytics/internal websites. Added
  source/version/date metadata, normalized numbered filenames and retained synthetic examples.

- `development/deployment/` — provider-specific deployment knowledge for team web apps/services.
- `development/deployment/run-platform/` — imported the source RUN Platform deployment pack's
  12 chapters and four templates; added provider/template indexes, source/version/date metadata,
  and normalized numbered Markdown filenames. No duplicate RUN workflow was found.

### Changed

- `README.md` (1.10.0), `development/README.md` (1.7.0), `SKILL.md` (1.14.0), Publishing,
  AI Skills, Deployment/RUN and balance-pack indexes register and cross-link the analytics builder.
- Removed duplicate tier/grade/mix/change-threshold tables from the imported analysis guide;
  canonical ranks retain their existing DAU/range policy. Documented the source website classifier's
  difference rather than replacing team rules. Repaired canonical links to the retired performance reader.
- `publishing/game_performance_evaluation.md` (1.1.0) and its existing detail references gain
  comparison-window/coverage and mix-vs-quality decomposition guidance; clarified source-defined
  C metrics, valid-zero/maturity and correlation limits. Added metadata to edited detail references.
- Linked app-specific artifacts/session/health/rollback guidance to provider deployment; kept the
  original unspecified hosting identity unspecified and distinguished image-build hosts from RUN.

- `scripts/package_skill.py` — exclude environment files, common key/credential containers,
  credential config/directory names at every depth, symlinks/reparse points, and the current
  output archive. Preserve required knowledge, installers, `.vscode` assets and non-secret templates.
- `scripts/test_package_skill.py` — add black-box dummy-credential, payload-preservation,
  output-archive and symlink regression checks; exclude the test helper from the sharing ZIP.
- `INSTALL.md` (1.4.0), `README.md` (1.9.1), and `development/README.md` (1.6.1) — document
  ZIP exclusions, their filename-based limits, and shell entry points using the canonical packager.
  Replace manual copy/zip recipes that bypassed its filters.

- `README.md` (1.9.0), `development/README.md` (1.6.0), and `SKILL.md` (1.13.0) register
  deployment scope and routing; `game-design/knowledge-pack/README.md` (1.0.1) links balance-site hosting.
- Adapted source-document authority/credential/commit conventions to the current task;
  marked live API details as unverified during import and retained the upstream guide link.
- Deployment templates require app-specific configuration; import adaptations and verification
  limits are documented in `development/deployment/run-platform/templates/README.md`.

## 2026-10-09

### Added

- `game-design/knowledge-pack/` — imported the Game Balance & Visualization reference pack
  from `plant-vs-zombie/GDD/knowledge-pack/`: balance worked examples, player simulator,
  derived-data and config-sync pipeline, balance-site patterns, icon processing, playbooks
  and historical references. Added per-track indexes and frontmatter; normalized new
  detail filenames to `lower_snake_case.md`. Implementation code/config/assets are not included.

### Changed

- Deduplicated the source UI/UX method: all eight files exactly match the existing
  `development/ui-ux-mockup/` files, so imported links route to that canonical method.
- Registered the module in `README.md` (1.8.0), `game-design/README.md` (1.8.0)
  and `SKILL.md` (1.12.0); linked related Development, AI Skills, UI/UX, Craftland design,
  live-ops economy, burn-rate and data-tooling references with version/date bumps.
- Labeled source-game targets, palettes and decisions as worked examples; made historical
  file paths explicit. Adapted commit/export conventions to current task authorization,
  removed the `.git` copying workaround, and clarified simulator fingerprints must include
  prices when the spending model depends on them.

## 2026-09-19

### Changed

- `development/release_guideline.md` (v1.0.0 -> v1.1.0) — extended the
  pre-release guideline with the shared release/hotfix email approval flow,
  banner/description and in-game changelog checks, code-review-bot and
  localization checks, new-room/version observation, old-room/GMT handling,
  and the containment-to-remediation bug response sequence.
- `README.md` (v1.6.2 -> v1.7.0), `development/README.md` (v1.4.2 ->
  v1.5.0), and `SKILL.md` (v1.9.2 -> v1.10.0) — registered and routed the
  expanded release/hotfix operational knowledge; `publishing/release_pipeline_decision_making.md`
  (v1.0.1 -> v1.0.2) now cross-links to the operational release guideline.
- `development/code-review/database/api.md`, `rule.md`, `standard.md`, and
  `workflow.md` — aligned the database reference pack with
  `UGC_DataStorage_Creators_Guide_English.pptx` (2026.08): Automatic,
  Standard, and External Storage foundations; four Standard table types;
  no-cache/blocking consistency flows; layered limits and quota formulas;
  Creator Center governance; status-code handling; and current-vs-OB56
  boundaries.
- `README.md` (1.6.1 -> 1.6.2), `development/README.md` (1.4.1 -> 1.4.2),
  and `SKILL.md` (1.9.1 -> 1.9.2) — removed project-facing references to
  system-owned configuration filenames while retaining their slide-sourced
  limits and quota behavior.

## 2026-09-09

### Added

- `development/ui_ux_mockup.md` (v1.0.0) — methodology for rebuilding
  Craftland UI/UX screens as HTML/CSS mockups matching the real Craftland
  Studio `.ui` file and assets: input checklist, coordinate-system
  conversion, visual primitives (9-slice/tint/text-outline), a reusable
  component library, HUD/scene anchoring, no-browser verification, and an
  interactive multi-screen browsing-tool scaffold. Detail files under
  `development/ui-ux-mockup/`. Source: external `craftland-ui-ux-skill`
  methodology (game-agnostic, no game-specific data).
- `publishing/game_performance_evaluation.md` (v1.0.0) — evaluate a game's
  health, quality, cohort mix, trends, and priorities: metric-reading order,
  tier assignment (cites `tier_list_definition.md`), Core/New/Revival cohort
  diagnosis, a priority (P0–P3) diagnosis-and-action playbook, like-for-like
  trend/release/region comparison, and advanced retention (R7/R14/R30,
  conversion, percentiles, completion, stickiness). Detail files under
  `publishing/game-performance-evaluation/`. Source: external
  `pugc_tracking/config/skills/game-performance-evaluation`, adapted (tier
  table de-duplicated against `tier_list_definition.md`; the external
  `analysis_rules.json` dependency and a stale legacy-file reference were
  rewritten to fit this repository).

### Removed

- `publishing/game_performance_reader.md` — retired and **replaced** by
  `publishing/game_performance_evaluation.md` (materially broader: adds
  cohort analysis, priority playbook, trend/release comparison, and advanced
  retention on top of the same tier system). All cross-references updated
  (`SKILL.md`, `README.md`, `CLAUDE.md`, `general-knowledge/README.md`,
  `general-knowledge/tier_list_definition.md`,
  `publishing/release_pipeline_decision_making.md`).

### Changed

- `SKILL.md` (1.7.0 → 1.9.0), `README.md` (1.5.0 → 1.6.0),
  `development/README.md` (1.3.0 → 1.4.0), `publishing/README.md`
  (1.0.0 → 2.0.0), `general-knowledge/README.md` (1.1.0 → 1.1.1),
  `general-knowledge/tier_list_definition.md` (2.0.0 → 2.1.0), and
  `publishing/release_pipeline_decision_making.md` (1.0.0 → 1.0.1) —
  registered UI/UX mockup and Game Performance Evaluation routing/index
  entries, and repointed every reference from `game_performance_reader.md`
  to `game_performance_evaluation.md`.

## 2026-08-31

### Changed

- `development/client_performance_test.md` (1.0.0 -> 1.1.0) - updated the
  Samsung J7 device classification/RAM, full-load measurement note, and
  hard versus soft client release standards.
- `development/server_performance_test.md` (1.0.0 -> 1.1.0) - updated server
  stress-test validity, hard/soft release standards, traffic grace handling,
  and T0/T1/T2 testing exemptions.

## 2026-08-30

### Added

- `development/code_review.md` and `development/code-review/` — shared
  read-only Code Review contract, database and network reference packs,
  combined Vietnamese report templates, and pack authoring guidance. The
  database and network rules were migrated from `ReviewCode` commit `3755b3e`.
- `scripts/validate_code_review_packs.ps1` — validates the review-pack manifest,
  required four-file structure, registration, rule prefixes, and rule IDs.
- `development/craftland_skill_provisioning.md` (v1.0.0) — the single umbrella
  workflow for checking, installing, updating, and repairing global Codex and
  Claude Code copies.
- `scripts/provision_craftland_pugc.ps1` — deterministic dual-target
  provisioner with hash comparison, staging, verification, rollback,
  idempotence, `-Check`, and `-WhatIf` support.
- `AGENTS.md` plus a matching `CLAUDE.md` bootstrap rule — automatically
  provision the global skill copies when the canonical repository is opened
  and either target is missing or outdated.
- `development/auto_save_format.md` (v1.0.0) — agent workflow for installing
  and verifying the standard Craftland FC auto-save formatter.
- `assets/auto-save-format/.vscode/` — the five-file StealAPet `.vscode`
  snapshot, including formatter, task, settings, recommendations, and MCP
  configuration.
- `scripts/install_auto_save_format.ps1` — idempotent JSON merge, formatter
  backup/replacement, Trigger Task on Save installation, rollback, and
  post-install verification for Codex and Claude Code.

### Changed

- `SKILL.md` (1.6.0 → 1.7.0), `README.md` (1.4.0 → 1.5.0),
  `development/README.md` (1.2.0 → 1.3.0), and `INSTALL.md` (1.2.0 → 1.3.0)
  — exposed Code Review routing, indexes, installation guidance, and the
  project-root report convention.
- `development/README.md` (1.1.0 → 1.2.0) and `SKILL.md` (1.5.0 → 1.6.0) —
  registered umbrella-skill provisioning triggers and routing.
- `INSTALL.md` (1.1.0 → 1.2.0) — made dual-platform provisioning the
  recommended install/update path and documented the first-bootstrap boundary.
- `scripts/package_skill.py` — excludes agent-local installation directories
  while retaining the new provisioner in the packaged umbrella.
- `development/README.md` (1.0.0 → 1.1.0) and `SKILL.md` (1.4.0 → 1.5.0) —
  registered auto-save-format triggers and routing.
- `INSTALL.md` (1.0.0 → 1.1.0) — added prompt-based installation and updated
  ZIP requirements so bundled assets and the installer remain available.
- `scripts/package_skill.py` — packages the installer, excludes repository-only
  helper/test files, and writes `craftland-pugc/SKILL.md` first.

## 2026-08-25

### Added

- `game-design/reward_gift_code_config.md` (v1.0.0) — game-native schema
  discovery, reusable reward-definition matching, grant/gift-code generation,
  validation, and required distribution coverage plus faucet/sink tables.
- `general-knowledge/large_number_notation.md` (v1.0.0) — canonical two-way
  raw/compact economy notation from `k` through `De`, with Excel formulas and
  precision/storage rules.

### Changed

- `game-design/craftland_game_design.md` (1.1.0 → 1.2.0) — added designer
  modes, Roblox-first comparable-game research, New/Mid/Late segment fit,
  mandatory feature pros/cons, and the feature decision package.
- `game-design/live_ops_economy_design.md` (1.5.0 → 1.6.0) — requires a
  coverage matrix and quantitative faucet/sink ledger for material economy
  work, including segment fit and two-way large-number display.
- `SKILL.md` and repository indexes — registered the new routes and added
  designer-first behavior that does not redirect ordinary design work to a
  named teammate.
- SAP and DYG game indexes — route reward/gift work through the generic
  workflow while preserving each game's native schema.

### Fixed

- Removed named-person handoff prompts from Steal A Pet design context; open
  engine questions are now recorded as capability-confirmation requirements.

## 2026-08-07

### Added
- `games/` — new per-game knowledge folder, one subfolder per live game.
  Generic files stay game-agnostic; game-specific rulings/configs live here
  and get promoted up when they generalize.
  - `games/steal-a-pet/` — README, systems_reference, economy_benchmarks.
  - `games/dig-your-garden/` — README, systems_reference, economy_benchmarks.
- `ai-skills/data_tooling_patterns.md` (v1.0.0) — reading master data xlsx
  reliably, building/patching single-file HTML balance calculators, headless
  JS verification, draw.io XML generation, Google Drive/Sheets export.
- `game-design/feature_burn_rate_balancing.md` (v1.0.0) — burn-horizon /
  time-to-exhaust balancing check for any feature release or rebalance:
  per-cohort exhaust time, faucet throughput benchmarking, permanent-vs-event
  rules, post-burn state audit, release checklist.

### Changed
- `README.md` (1.0.0 → 1.3.0) — added `games/` to the folder map and
  navigation rules.
- `SKILL.md` (1.1.0 → 1.3.0) — added routing rows for the new files above;
  added rules for game-specific tasks (read locked rulings before proposing
  designs) and reading source GDD/Master Data before answering balance
  questions.
- `ai-skills/README.md` (1.0.0 → 1.1.0) — registered `data_tooling_patterns.md`.
- `game-design/README.md` (1.4.0 → 1.5.0) — registered
  `feature_burn_rate_balancing.md`.
- `game-design/craftland_game_design.md` (1.0.0 → 1.1.0) — added §1.1 Room
  Model Constraint: platform-wide guidance on new/veteran player balance in
  Craftland's matchmaking-free, session-based rooms (anchor floors, relative
  participation gates, progression-gated exposure; rejects winner-take-all
  room events).
- `game-design/live_ops_economy_design.md` (1.4.0 → 1.5.0) — added the
  permanent-feature faucet rule (pity/guarantee systems are an event pattern;
  don't carry them to permanent features unbounded); added "when closed-form
  lies" verified failure cases (pity/streak mechanics overstating success
  ~2x); added 3 pitfalls (data pipeline integrity, campaign traffic skew,
  population base ambiguity).

### Fixed
- `game-design/craftland_game_design.md` had unbumped `version`/`last_updated`
  despite new content — corrected as part of this pass.
