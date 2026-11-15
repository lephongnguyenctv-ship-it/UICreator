---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/02-architecture-and-apis.md"
---

# Architecture and APIs

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

## Reference implementation

The reference uses Node.js/CommonJS, native HTTP/fetch, a static HTML/CSS/JavaScript frontend and custom canvas charts. It has no frontend build step or package-defined test suite. This is an implementation option, not a requirement to avoid frameworks.

Keep these boundaries even with another stack:

| Layer | Responsibility |
| --- | --- |
| HTTP entrypoint | Routing, identity guards, request parsing and response contracts |
| Config | Includes, validation, public projection and project aliases |
| Auth/token store | OAuth, sessions, reader selection and private credential persistence |
| Sheets | Network queue, parsing, source resolution and constrained document writes |
| Metrics/availability | Numeric parsing, aggregation and per-metric eligibility |
| Dashboards/product analysis | Authorized tables, comparisons, insights and release windows |
| Calculation worker | Bounded CPU-intensive daily/weekly/cohort computation |
| AI/report/messaging | Optional integrations consuming authorized analytical payloads |
| Diagnostics | Request stages, cache/network/worker timing and recovery status |
| Frontend | Filters, local interaction state, incremental rendering and drafts |

The reference files are `server.js`, `run_server.js`, `lib/`, `public/` and `config/`. Several orchestration/cache/messaging functions still reside in the HTTP entrypoint; a new implementation can extract them rather than reproducing a large router.

## Data path

`Browser filters → authenticated API → project/region authorization → cached source retrieval → availability policy → worker/aggregation → privacy projection → JSON → chart/table rendering`.

Documents and optional AI follow separate paths. Workers receive rows and calculation definitions, not OAuth tokens. Cached raw rows are immutable; privacy and maturity are applied for the particular analytical request.

## Useful route families

These are reference contracts, not a promise that every new app needs identical URLs:

| Method/path | Purpose |
| --- | --- |
| GET `/health` | Lightweight process health; no private data |
| GET `/api/me`, `/api/config` | Session state and authorized public config |
| GET `/auth/google`, `/oauth/callback` | Google login/consent flow |
| POST `/api/logout` | Session logout |
| POST `/api/dashboard`, `/api/daily-chart`, `/api/weekly-chart` | Analytical results |
| POST `/api/daily-defaults`, `/api/weekly-defaults` | Available source/date defaults |
| POST `/api/map-comparison`, `/api/product-analysis`, `/api/update-analysis` | Specialized comparisons |
| POST `/api/summary-change-logs` | Project document context |
| GET `/api/project-timeline`, `/api/project-timeline-progress` | Timelines and loading progress |
| POST `/api/project-timeline/edit` | Constrained original-document edit |
| POST `/api/official-maps`, `/api/official-maps/change-logs` | Separate data/document loading |
| GET `/api/cache/status`; POST `/api/cache/clear` | Freshness and explicit cache invalidation |
| GET/POST `/api/admin/config`, `/api/admin/field-config` | Authorized configuration |
| `/api/admin/diagnostics/*` | Logs, background tests and controlled recovery |
| `/api/admin/seatalk-*` | Messaging configuration, debug and scheduler |
| `/api/user/ai-*`, POST `/api/ai`, `/api/report` | AI preferences, analysis/prompt and reports |

## Response design

Return rows with metric definitions/formats, exact filter dates, source identity suitable for display, availability/coverage and cache metadata. Use a request ID in success and error responses where practical. Do not expose raw credentials, internal paths or private provider details.

Frontend errors must tolerate an HTML gateway response, not only JSON. Distinguish authentication, authorization, validation, source failure, timeout and conflict. Retry safe reads selectively; never reuse read-retry behavior for uncertain writes or message sends.

## Async correctness

Use request generations or cancellation for project/filter switching. A late response for Project Alpha must not replace Project Beta. Deduplicate identical in-flight work. Long diagnostics should start a background task and poll short progress requests instead of keeping one gateway request open indefinitely.

Patch a section's contents, not the entire filter area, when new documents arrive. Persist selected ranges, legend visibility and chart interaction state by stable chart ID, not by transient array position when cards can reorder.
