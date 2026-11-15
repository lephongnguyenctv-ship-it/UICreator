---
doc_type: knowledge_pack_index
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/SKILL.md"
---

# Analytics Website Builder

## Purpose

Recreate the capabilities and engineering lessons of a project-performance website, not its private installation. This is a portable English reference module integrated into the existing Craftland PUGC umbrella. It consolidates website-specific implementation knowledge, product rules and prompt patterns; it does not export unrelated machine-installed plugins or skills.

Extracted on **14 October 2026** from implementation code, application configuration definitions, analysis skills/prompts, README, recent changes and focused design documents. Examples are synthetic. No live accounts, private spreadsheet IDs, credential values, webhook URLs, provider endpoints or deployment identities are included.

## Integration and canonical owners

Entry points: [Development](../README.md), the [root index](../../README.md),
and the [umbrella routing](../../SKILL.md). The source entry `SKILL.md` becomes this README;
the 19 topic guides remain reference documents, not separately installed skills.
This import includes documentation and synthetic examples, not the original website code,
live configuration or operational accounts.

Reference-specific group defaults, schedules, limits, page names and runtime behavior describe
the exported 2026-10-14 snapshot. Adapt them to the approved product and verified source semantics;
they do not establish the current team's access policy or override the current user's request.

| Overlap | Canonical owner / integration |
|---|---|
| Craftland performance ranks | [Tier List Definition](../../general-knowledge/tier_list_definition.md); no second rank table here. The source website's quality classifier differs from the canonical DAU/range policy; see [analysis integration](12_performance_analysis_rules.md#tier-classification). |
| Grade bands, cohort diagnosis, release/region analysis | [Game Performance Evaluation](../../publishing/game_performance_evaluation.md). Repeated bands and thresholds route there; new mix decomposition and comparison-window details are merged into its references. |
| Spreadsheet/calculator/diagram/export methods | [Data & Tooling Patterns](../../ai-skills/data_tooling_patterns.md); this module adds a persistent multi-user website pipeline. |
| Balance simulator/config-mirror website | [Game Balance & Visualization](../../game-design/knowledge-pack/README.md); this module adds live analytics, Google login, privacy, timeline editing and diagnostics. |
| Hosting-provider deployment | [Deployment](../deployment/README.md) and [RUN Platform](../deployment/run-platform/README.md). Chapter 16 owns app artifact/state/health checks; provider auth, containers, SSH and ports stay in the provider workflow. |
| ZIP sharing exclusions | [Packaging policy](../../INSTALL.md#packaging-exclusions); website runtime artifacts need their own reviewed allowlist. |

The original host/provider identity was intentionally omitted. Choose and verify the operator's
hosting target when an actual deployment is requested; do not infer RUN Platform from this import.
If RUN is selected, use its existing-container workflow; the source Dockerfile example is for
hosts that build container images, not a requirement to run nested Docker on RUN.

## Working contract

1. Establish the requested product, data semantics and deployment environment before choosing implementation details.
2. Preserve separation between raw data, authorized analytical results, presentation state and optional AI commentary.
3. Render useful data progressively. Documents, AI and other projects must not block the first usable result.
4. Treat zero, missing and pending as different states. Show comparison dates, units, coverage and cache timestamps.
5. Enforce permissions and count privacy on the server and every export, not only in visible controls.
6. Keep configuration-driven behavior and unsaved form drafts intact when improving the UI.
7. Use placeholders until the operator supplies installation-specific values through appropriate private channels.
8. Do not deploy, send messages, edit live documents, restart production or expand access merely because these guides describe how. Obtain task-specific authorization.

## Topic map

| Guide | Read when |
| --- | --- |
| [01 Product blueprint](01_product_blueprint.md) | Defining pages, user journeys and implementation phases |
| [02 Architecture and APIs](02_architecture_and_apis.md) | Organizing backend/frontend modules and response contracts |
| [03 Configuration system](03_configuration_system.md) | Designing project sources, split config, aliases and validation |
| [04 Google login and sessions](04_google_login_and_sessions.md) | Implementing OAuth, own/shared readers and session persistence |
| [05 Access, privacy and safe boundaries](05_access_privacy_and_safety.md) | Implementing group capabilities, per-user scopes and safe exports |
| [06 Spreadsheet ingestion](06_spreadsheet_ingestion.md) | Supporting legacy/cohort tabs, headers, dates and fallback sources |
| [07 Cache and quota management](07_cache_and_quota_management.md) | Reducing reads, scheduling expiry and explaining data freshness |
| [08 Metrics and availability](08_metrics_and_availability.md) | Computing weighted metrics, totals, units and maturity windows |
| [09 Chart rendering](09_chart_rendering.md) | Building readable, responsive configurable charts |
| [10 Chart interactions and exports](10_chart_interactions_and_exports.md) | Implementing zoom, reset, legend focus, drag, comparison and downloads |
| [11 Timeline and document editing](11_timeline_and_document_editing.md) | Rendering calendars and editing original documents safely |
| [12 Performance analysis rules](12_performance_analysis_rules.md) | Grading games, diagnosing cohorts/regions and evaluating updates |
| [13 AI analysis and prompt recipes](13_ai_analysis_and_prompt_recipes.md) | Building lazy AI features and evidence-based analyst prompts |
| [14 SeaTalk and snapshot jobs](14_seatalk_and_snapshot_jobs.md) | Formatting scheduled snapshots, mentions and progress |
| [15 Admin UX and draft management](15_admin_ux_and_drafts.md) | Building compact list/detail editors and permission controls |
| [16 Deployment and operations](16_deployment_and_operations.md) | Packaging, hosting, verifying and rolling back an installation |
| [17 Diagnostics and verification](17_diagnostics_and_verification.md) | Investigating timeouts, cache behavior and regressions |
| [18 Safe configuration examples](18_safe_configuration_examples.md) | Starting from synthetic project/access/chart/job templates |
| [19 Provenance and limitations](19_provenance_and_limitations.md) | Resolving stale guidance and distinguishing current behavior from recommendations |

## Recommended build sequence

1. Product scope, configuration schemas and permission model: 01–05.
2. Ingestion, cache and deterministic calculations: 06–08.
3. Useful dashboard, progressive documents and interactions: 09–11, 15.
4. Evidence-based analysis and optional integrations: 12–14.
5. Private runtime setup, deployment and regression gates: 16–18.

Read only the relevant modules for a maintenance task. Read [limitations](19_provenance_and_limitations.md) before copying old repository examples. A recreated website is not production-ready simply because it follows this package; validate its own data pipeline, access boundaries and hosting behavior.
