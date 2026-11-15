---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/07-cache-and-quota-management.md"
---

# Cache and Quota Management

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Deployment](16_deployment_and_operations.md)

## Cache layers

| Layer | Contents | Key/freshness concerns |
| --- | --- | --- |
| Raw map | Parsed legacy/cohort rows | Effective reader, source configuration, project and reader mode |
| Official Maps | Consolidated map-source rows | Effective reader and source tab/header |
| Document | Parsed change-log entries | Effective reader and actual read source/tab/header |
| Defaults | Available dates/filter defaults | Parent source revision and reporting cutoff |
| Derived chart | Computed analytical response | Dataset identity, signed-in user, region/exclusion/count scope, config, date range and maturity policy |
| Browser | Loaded sections and interaction state | Project/source revision, user scope, current request generation |

Raw shared-reader results may be reused across users who use the same reader. Authorization/privacy must still be applied separately to each response. Derived permission-specific results must not be reused across incompatible scopes.

## Scheduled expiration, not constant polling

The reference source usually publishes map data at **09:00 and 18:00 Asia/Bangkok**. Map caches expire at the next boundary. Documents expire after **00:00** in that timezone. These are product-specific schedules; configure them for a new data pipeline.

Crossing a boundary makes the entry stale. The next request rereads it; the reference does not predownload every project exactly at the boundary. Explain this lazy behavior to operators. A source that publishes late may still require explicit refresh after publication.

Server reporting cutoff can use a different date basis from cache scheduling; align timezone configuration deliberately. Fixed UTC+7 arithmetic is suitable only where no daylight-saving rules apply.

## Deduplication and invalidation

Store an in-flight promise by source key so concurrent tabs/jobs share one read. A cache hit should bypass the Google queue. Waiters should be labeled `Waiting for an existing document read`, not falsely `Reading cache` before a value exists.

On invalidation, prevent older in-flight reads/calculations from repopulating a cleared entry. Use entry identity/revision checks. Clear related defaults and derived results when map data changes. A document edit clears document/marker/analysis entries, not unrelated map data.

Return a fresh object on derived cache hits or use immutable serialized buffers so a caller cannot mutate future responses. Bound memory, entry count and task count. The reference chart cache uses 24 entries/16 MiB and one bounded worker; those are implementation limits, not universal defaults.

## Quota control

Lazy load projects sequentially in configured order, with selected-project priority. Rate-limit actual Google calls across competing workflows for the effective reader. The reference read queue spaces calls by at least 1.25 seconds and serializes work; retries also consume quota.

Queue identity is currently derived from the access token, which is an imperfect proxy for a stable account identity when tokens rotate. A stronger recreation should use an operator-safe stable reader identity and coordinate limits across replicas. Verify actual Google quotas for the new installation; never describe a hard-coded interval as a guaranteed quota solution.

Batch compatible ranges when implemented, cache header metadata sensibly and distinguish queue wait from network duration. Bounded retries do not justify unbounded project fan-out.

## Operator controls and messages

Expose Refresh map data and Refresh documents to authenticated allowed users if adopting the reference UX. Diagnostic reload/restart stays Admin-only. Consider refresh cooldown/deduplication to avoid one user's repeated refresh causing a global read storm.

Each result should show: source = cache or Google Sheets, cached/read timestamp, data date range, next scheduled expiry and coverage. Mixed-source loads show project-specific timestamps or oldest/latest, not one misleading timestamp for all projects.

In the reference, caches live in process memory. Restart loses them; another server/replica has different entries. Persisted config/tokens are not cached rows. Use a shared cache/coordinator only if the new deployment needs cross-instance reuse and invalidate it with the same authorization/revision discipline.
