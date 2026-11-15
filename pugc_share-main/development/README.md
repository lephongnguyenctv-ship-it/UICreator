---
folder: Development
title: Development — Skills & Knowledge
domain: craftland-ugc
status: authoritative
version: 1.10.0
last_updated: 2026-10-27
---

# Development

Skills & knowledge related to **map development** for Craftland/UGC.

## Scope
- Map building, level/scene design, scripting and gameplay logic.
- Development conventions, tooling, and technical references for map creators.
- Multiplayer map server/client performance optimization and source-verifiable review.
- Building authenticated internal/analytics websites with Sheets, privacy, cache, charts and diagnostics via [Analytics Website Builder](analytics-website-builder/README.md).
- Hosting internal team web apps/services, including balance tools, via [Deployment](deployment/README.md).

## What belongs here
- ✅ Map development workflows, editor/tooling guides, scripting patterns.
- ❌ publishing/performance analysis → see [`../publishing`](../publishing/README.md).
- ❌ Cross-domain shared knowledge → see [`../general-knowledge`](../general-knowledge/README.md).

## Contents

| Skill / Knowledge | File | Purpose |
|---|---|---|
| Analytics Website Builder | [`analytics-website-builder/README.md`](analytics-website-builder/README.md) | Imported 19-topic website methodology: product/API/config, Google login, access/privacy, ingestion/cache, metrics/charts/exports, timeline writes, AI/snapshots, drafts and operations. Shared performance rules and provider deployment reuse their canonical modules. |
| Deployment | [`deployment/README.md`](deployment/README.md) | Provider-specific hosting workflows for team web apps/services; RUN Platform references, SSH/ports, updates, recovery and Windows templates. |
| RUN Platform Deployment | [`deployment/run-platform/README.md`](deployment/run-platform/README.md) | Imported 12-chapter RUN workflow plus four deployment templates; upstream API details must be checked when deploying. |
| Team Workflow (Cadence) | [`team_workflow.md`](team_workflow.md) | Daily/weekly meeting cadence (stand-up, weekly update, Thursday playtest, monthly brainstorm) and the 1-week Agile sprint model. |
| Team Onboarding | [`team_onboarding.md`](team_onboarding.md) | Start-here guide for new Craftland/PUGC VN members: team context, first-day/week path, role tracks, high-level lifecycle, source-of-truth map, and completion criteria. |
| Team Tooling Reference | [`team_tooling_reference.md`](team_tooling_reference.md) | Current team tools and resources: VN PUGC Master Sheet tracker, FF-OGC GitHub, fecl, Craftland Editor, publishing access, SeaTalk groups/bots, reports, feedback, and asset links. |
| Product Lifecycle — Dev Forge | [`product_lifecycle_dev_forge.md`](product_lifecycle_dev_forge.md) | Prototype → Demo1/2/3 milestones and the genre-specific development-time matrix. |
| Development Lifecycle — Stages | [`development_lifecycle_stages.md`](development_lifecycle_stages.md) | Stage-by-stage development process (Requirement Analysis → Launch), the PIC for each stage, and terminal outcomes (Launched / Not to be Launched). |
| Client Performance Test | [`client_performance_test.md`](client_performance_test.md) | Pre-release test that the game runs well on low-end devices (PerfDog, benchmark Samsung J7): setup, test cases, pass/fail metrics, optimization directions. |
| Server Performance Test | [`server_performance_test.md`](server_performance_test.md) | Pre-release server stress test via Gtop loadTest: get battlefield-code URL, configure/run the test, and healthy vs abnormal monitoring thresholds. |
| Multiplayer Performance Optimization | [`performance_optimization.md`](performance_optimization.md) | Implementation patterns for network, server CPU, persistence boundaries, client rendering and HUD; numbered detail guides in [`performance-optimization/`](performance-optimization/README.md), with before/after measurement. |
| Release Guideline | [`release_guideline.md`](release_guideline.md) | Pre-release timeline plus release/hotfix operating flow, readiness checks, version/room observation, and bug containment-to-remediation steps. |
| Skill ZIP Packaging | [`../INSTALL.md`](../INSTALL.md#packaging-exclusions) | Canonical ZIP packager with credential/path exclusions and black-box regression checks in `scripts/test_package_skill.py`; preserves knowledge, installers and templates. |
| Craftland Skill Provisioning | [`craftland_skill_provisioning.md`](craftland_skill_provisioning.md) | Provision, update, repair, and verify the same umbrella payload in the global Codex and Claude Code skill directories. |
| Craftland Auto-Save Format | [`auto_save_format.md`](auto_save_format.md) | Install and verify the standard FC `.vscode` auto-save formatter plus Trigger Task on Save through Codex or Claude Code without manual file copying. |
| Code Review Workflow | [`code_review.md`](code_review.md) | Shared read-only review contract, project-root detection, pack selection, combined reports, Vietnamese output template, and review gates. |
| Performance Review Pack | [`code-review/performance/workflow.md`](code-review/performance/workflow.md) | Registered 11 source-verifiable `PERF` rules for multiplayer network, loops, caches, registries, rendering, labels and HUD; persistence rules remain in the database pack. |
| Code Review Pack Authoring | [`code-review/pack_authoring.md`](code-review/pack_authoring.md) | Authoring rules for future reference packs without creating standalone skills. |
| Code Review Pack Validator | [`../scripts/validate_code_review_packs.ps1`](../scripts/validate_code_review_packs.ps1) | Validates the review-pack manifest, structure, rule IDs, prefixes, and registration. |
| Craftland Data & Config Patterns | [`craftland_data_config_patterns.md`](craftland_data_config_patterns.md) | Where a data-driven Craftland project keeps balance values (Assets/CSV + CSVIndex, CustomConfig.fcc constants, access/gate tables, virtual packs, fileId icons), load-time validation traps, CSV-vs-code delivery split and safe read-only repo workflow. |
| Craftland UI/UX Mockup | [`ui_ux_mockup.md`](ui_ux_mockup.md) | Rebuild Craftland UI/UX screens as HTML/CSS mockups matching the real `.ui` file (Craftland Studio) and assets: input checklist, coordinate-system conversion, visual primitives (9-slice/tint/text-outline), component library, HUD/scene anchoring, no-browser verification, interactive browsing-tool scaffold, design tokens + flow layout (rebuild vs new-design modes), a ready-to-copy component kit with gallery and layout lint, and component extraction from existing screens. Detail files in [`ui-ux-mockup/`](ui-ux-mockup/); kit code in [`ui-ux-mockup/templates/`](ui-ux-mockup/templates/). |

> **Cross-reference:** the **Launched** stage uses post-launch grading from the
> [Tier List Definition](../general-knowledge/tier_list_definition.md).


## Related design knowledge

- [Game Balance & Visualization Knowledge Pack](../game-design/knowledge-pack/README.md)
  covers config-driven balance tools and simulator pipelines. Its UI/UX track uses
  [Craftland UI/UX Mockup](ui_ux_mockup.md) as the single canonical method; icon processing
  references live in the pack's [icon pipeline](../game-design/knowledge-pack/04-ui-ux/icon-pipeline-skills/README.md).
