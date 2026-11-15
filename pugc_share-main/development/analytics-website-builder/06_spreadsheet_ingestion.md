---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/06-spreadsheet-ingestion.md"
---

# Spreadsheet Ingestion

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Metric calculations](08_metrics_and_availability.md)

## Reader modes

**Legacy**: one configured tab supplies the project's rows.

**Cohort tabs**: one spreadsheet contains Core Player, New Player, Revival 7 Player and Tiered Player Engagement tabs. The legacy source can fill fields absent in the new schema, such as WAU/MAU, on matching date/region identities. Document reading is independent of data-reader mode.

## Cohort schema

Shared identity columns: `Date`, `Center Region`, `Region`, `Map Name`.

| Tab | Population/share | Typical metric columns |
| --- | --- | --- |
| Core Player | `Core Player`, `P Of Core Player` | `R2/R7/R14/R30 Of Core Player`, `Avg Survival Time Of Core Player`, `Avg Match Cnt Of Core Player`, `C2/C7 Of Core Player` |
| New Player | `New Player`, `P Of New Player` | Corresponding `Of New Player` retention, survival, match and C-series fields |
| Revival 7 Player | `Revival7`, `P Of Revival7` | Corresponding `Of Revival7` metrics and `30D Activeness Rate Of Revival7` |
| Tiered Player Engagement | Cohort/distribution context | `P30/P50/P70 Survival Time` and Top 30 / P30 P70 / Bottom 30 activeness at 7D, 14D and 30D |

Confirm source semantics instead of assuming cohort shares sum to one or that a percentile is a group mean. Canonical aliases belong in configuration/metric lookup, not in many separate chart renderers.

## Efficient read workflow

1. Resolve the configured source after authorization.
2. Obtain the appropriate backend reader credential.
3. Read the configured header row, detect the first/last meaningful columns and fetch only the useful data span.
4. Quote A1 tab names correctly, including apostrophes; validate ranges on the server.
5. Convert populated rows to normalized objects while retaining missing cells as missing.
6. Merge cohort/fallback records on verified identity keys; avoid Cartesian joins and duplicated populations.
7. Cache immutable normalized rows and useful source metadata.

Where feasible, batch ranges from the same spreadsheet, but verify that batching really reduces network operations in the implementation. Do not assume a consolidated file means one API request if each tab still makes separate header/data calls.

## Numbers and dates

Parse numeric cells and supported percentage strings consistently. Normalize rates to fractions. Store dates canonically as `YYYY-MM-DD` while formatting UI dates unambiguously.

Support native Sheets date serials and recognized text dates. Infer slash-date order from a full column where unambiguous evidence exists; do not independently guess every `03/04` cell. Reject or surface unresolved ambiguity instead of silently changing release dates.

Keep upstream date semantics separate from cache age and reporting eligibility. A read performed today can still contain data ending last week.

## Fallback and missing sources

Use fallback only for missing fields, not to overwrite valid new-cohort data. Retain a real numeric zero. A absent central document tab can fall back to the original document; permission/network failures should remain visible rather than masquerading as an empty project.

Document-only projects should not trigger invalid map reads. If no rows survive the configured reporting cutoff, return an explicit empty payload rather than a misleading missing-header error.

## Read failures

Separate malformed config, missing tab/header, Google authorization denial, quota wait, network failure and no data. Use bounded retry/backoff for transient read errors. Include a readable project/stage in progress; never include access tokens or full private request URLs.
