---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/17-diagnostics-and-verification.md"
---

# Diagnostics and Verification

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

## Dedicated Debug page

Protect the page/direct route and every diagnostic/recovery API with Admin authorization. Record bounded process/browser histories; do not turn debugging into an unbounded log of raw source content.

Useful stages: config resolution, authentication/token refresh, cache hit/miss, waiting for another read, Google queue wait, Google network, retry backoff, row parsing, worker queue/execution, aggregation, serialization, browser rendering and optional AI/report/messaging work.

Associate stages with request ID, elapsed time, outcome and server instance ID. Include cache timestamp/expiry but not tokens, cookies, request bodies, source URLs, webhook endpoints, user rosters or raw player populations.

## Why local success can fail after deployment

| Symptom | Investigate |
| --- | --- |
| HTTP 504 on several chart routes | Gateway timeout, event-loop blocking, worker packaging or quota queue |
| Slow `checking cache` | Actually waiting for in-flight work, OAuth refresh, parsing/calculation or network mislabeled as cache |
| Google 429 | Concurrent per-reader calls, missing deduplication, several replicas or aggressive refresh |
| Login callback error | Canonical origin, callback registration, trusted proxy or runtime credentials |
| Data ready but no WoW | Insufficient previous history, mismatch in units/columns or eligibility/coverage |
| 2M shows two days | Preset parsing bug or backing history truncated to page Display Range |
| Reset shows All | Reset not bound to current applied parent range |
| Dropdown opens then closes | Filter DOM rebuilt by background rendering/resize |
| Marker detail hidden in Expand | Popup stacking/lifecycle scoped beneath expanded modal |
| Cache timestamps absent | Metadata dropped in an aggregation/projection or mixed-source status renderer |

A gateway-generated 504 might not appear as HTTP 504 inside the app. Correlate browser failure with backend stages and finish/close timestamps; do not assume the server saw the proxy response.

## CPU isolation

One historical timeout came from synchronous metric work blocking the event loop, delaying even network timeout callbacks. The reference now uses a bounded worker, scoped column-lookup reuse and derived-result caching. Measure worker and event-loop time separately.

Bound queue length, computation deadline and worker memory. Replace failed workers on later requests and release idle workers. Do not pass credentials to workers. A local benchmark improvement is not a production latency guarantee; reproduce with the new deployment's representative synthetic data.

## Operator actions

- **Test Overview**: background read/calculation/document test, with short polling requests.
- Separate map, document and connectivity tests isolate the failing layer.
- Cache bypass/reload is explicit; normal reads should reuse compatible caches.
- **Download debug text** captures bounded retained server/browser state in UTF-8.
- **Clear debug** clears completed debug history, not data caches or active tasks.
- **Restart** is separately confirmed and refused during active work; verify replacement by changed instance ID.

Export incident evidence before restart. Process-local history/caches disappear on restart. Multi-instance jobs/logs require sticky routing or shared coordination; inspect the instance that actually owns the job.

## Regression matrix

1. **Config**: include resolution, document-only projects, disabled sources, aliases/order, invalid imports and schema-version guards.
2. **Access**: unknown users, empty scope, exclusions, mixed groups, QA dates versus assigned content, direct privileged routes and privacy-safe payloads/exports.
3. **Metrics**: fractions/percent strings, valid zero, missing terms, zero weights, seconds/minutes, weighted totals, residual Core and pending long-window rates.
4. **Periods**: 7/14/28 before/after release, incomplete dates, matching weekdays, overlapping updates, month/year boundaries and complete-history zoom.
5. **Cache**: own/shared reader isolation, concurrent deduplication, expiry boundaries, force refresh, invalidation during in-flight work and immutable cached objects.
6. **Charts**: zoom/reset, marker-off hover, both update types, popup over Expand, legend focus, same-date crosshair, drag dates and privacy-safe PNG/CSV.
7. **Timeline writes**: field scope, source fingerprint, duplicate/missing matches, formula protection, uncertain write and consolidated-index lag.
8. **Admin drafts**: hidden records included, no-match search, add/duplicate/remove selection, reorder preservation, compact rows and active input focus.
9. **Integrations**: provider failure leaves data intact; test messaging payloads with stubs, not live sends.
10. **Deployment**: all modules packaged, correct entrypoint, health/assets/callback, persistence and rollback.

## Test discipline

Start with changed pure functions and fixtures, then targeted HTTP/browser checks. Use isolated synthetic users/rows and stub network writes/sends. The reference has no formal package test suite; inline checks are evidence, not a substitute for a future maintained suite.

Never save test drafts into live operational configuration or edit a real document solely to verify a UI. Discard browser drafts after QA. Record what actually passed and disclose untested deployment/external paths.
