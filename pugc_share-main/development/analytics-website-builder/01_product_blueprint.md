---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/01-product-blueprint.md"
---

# Product Blueprint

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

## Product purpose

Help a product operator answer: Which projects need attention? Which region or user cohort is causing the change? Did a release improve observed performance? What is releasing or entering QA next? How current is the evidence?

Prefer actionable evidence over a wall of metrics: current value, previous value, signed change, exact dates and a short investigation suggestion.

## Navigation

Use these main areas:

- **Project Timeline**: Project Details and Calendar.
- **Project Performance**: primary row **0.Portfolio → 1.Overview → 2.Change Logs Analysis → 97.Overall**; secondary row **3.Performance Comparison → 4.Daily Chart → 5.Weekly Chart → 6.Map Comparison**.
- **98.AI**: optional personal provider configuration and prompt export.
- **99.Admin**: authorized configuration editors.
- **Debug**: administrators only, including direct-route protection.

The numeric labels are the reference product's convention, not an architectural requirement. Keep numbering and labels consistent if adapted. The special Official Maps page has its own capability; ordinary Overview is not the same permission.

## Page responsibilities

| Page | Primary job |
| --- | --- |
| Portfolio | Selected-project triage: R2, survival, match count, tier and concrete changes |
| Overview | One project's daily/monthly/weekly trends, cohorts, regions and rule-based findings |
| Change Logs Analysis | Compare fixed pre/post-release windows and expand update-specific detail |
| Performance Comparison | Configurable regional metric groups and current/previous comparisons |
| Daily/Weekly Chart | Detailed temporal tables, configured charts and authorized export |
| Map Comparison | Side-by-side project/period/cohort evidence |
| Official Maps | Consolidated map-source rows, configured map aliases and four trend charts |
| Project Details | WIP changes now; Confirmed changes next; release/QA dates and type |
| Calendar | Current and next month, release/QA entries, contextual detail/edit card |

## Progressive experience

1. Load authorized configuration and available selectors.
2. Start data reads in configured project order. Render each completed project immediately.
3. If the operator selects a pending project, prioritize it after the current read; show its own loading state.
4. Fetch document context independently and patch markers/change logs without rebuilding the data section.
5. Run AI only on explicit request or first expansion of an AI block.
6. Keep successful sections visible if another section fails.

Display progress such as `Loading Project Beta 5/10 · Reading Google Sheets` and `Using document cache from 14 Oct 2026, 09:12 ICT`. A completed count is not the same as a successful count: distinguish ready, empty, failed and pending projects.

## Portfolio decisions

Allow multiple projects with search, select-all and clear. Persist a user's browser selection, intersect it with currently authorized projects, and make empty selection perform no reads. Do not silently select newly added projects in a saved shortlist. Explain project-specific freshness when sources end on different dates.

Expose a small set of meaningful filters: All, Needs attention, Improving and Near Tier 1. Show numbers rather than only up/down labels. Keep ordinary users' views free of administrator-only infrastructure controls.

## Scope discipline

Ship core data and reliable interactions before optional AI/messaging. Do not add another crowded panel simply because the data exists. If a page becomes too dense, propose moving the feature to a dedicated view instead of adding nested tables.
