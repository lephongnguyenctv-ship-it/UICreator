---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/14-seatalk-and-snapshot-jobs.md"
---

# SeaTalk and Snapshot Jobs

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Cache control](07_cache_and_quota_management.md)

## Models

A group has ID, name, private webhook URL and enabled state. A job has ID, name, enabled state, snapshot type, selected projects, target group IDs and schedule with enabled state, local time, weekdays and timezone.

Support Daily, Weekly single-project and Weekly all-project types. Keep job enablement separate from schedule enablement. A manual-only enabled job is not automatically scheduled. The reference defaults new jobs to disabled and unscheduled; Daily weekdays default to every day, Weekly to Monday, time 09:00 and timezone Asia/Bangkok.

## Compact Admin editor

Use searchable one-line group/job lists on the left and the selected editor on the right. Put Add in the sidebar. Group jobs by Daily/Weekly/All Projects with subtle gold/blue/teal accents and show send time plus Off/Manual/Scheduled.

Keep original record indices or stable IDs for actions even if visual category order changes. Lists must never contain webhook URLs or include them in search/hover metadata. Hidden forms remain in the draft collector. Names/type/time/status can update the list without replacing the active editor.

Duplicate jobs with a blank ID, no target groups, disabled job and disabled schedule. Preserve snapshot/project/time settings, but require review before saving/debugging. Import JSON loads a reviewable draft; exporting private messaging config must warn about webhook sensitivity.

## Snapshot content

**Daily**: latest eligible data, grouped consistently by project and Overall/Core/New/Revival quality.

**Weekly single-project**:

1. Preserve the daily row section for the current seven-day range.
2. Add weighted before/after R2, survival and available match count for Core/New/Revival, comparing seven days with the preceding seven days, not an arbitrary three-day window.

**Weekly all-projects**: one compact row per selected project with `Overall(R2/st/mc)`, `Core`, `New`, `Revival`, then `WoW Overall(R2/st/mc)`. Sort by Overall R2 descending, then survival. Include match count when present in the newer cohort schema; show unavailable markers when absent, not zero.

Use a concise legend: st = survival minutes, mc = average match count, WoW = current minus previous eligible seven-day period. Rate delta is pp; survival delta minutes; match delta absolute decimal. Show actual data dates and successful/error project counts. Do not pad with repeated `no notable change` or invented event narratives.

Formatting is illustrative. Validate message width/length in the target client rather than assuming desktop monospace tables fit every screen.

## Sending and mentions

Send from the backend, not the browser. Group webhook endpoints are private runtime values supplied by the operator. Never put a working webhook in a shareable example.

Mention debug can accept an enabled target group, a normalized/deduplicated email list and text defaulting to `test tag email`. A typical text payload carries a text content field and a mentioned-email list; verify compatibility with the integration used by the new installation. A normal email string alone is not necessarily an actual mention.

Every debug-send action is a real message, not a harmless rendering test. Do not invoke it during UI QA without explicit authorization. Avoid automatic retries that can duplicate a send when delivery is uncertain.

## Runtime and progress

Load projects lazily and sequentially, reuse map/document caches and report `Sending snapshot job debug · Loading Project Beta 5/10`. Distinguish cache retrieval, Google queue/read, calculation and sending.

Schedules in the reference run in-process using persisted authorized sessions. Multiple replicas can duplicate schedules unless there is a shared lock/leader or external scheduler. Timezone boundaries, disabled groups/jobs, stale sessions and partial project failures need explicit tests.

Do not restart while a snapshot is running. Retain an observable final success/partial-failure/uncertain-delivery state without logging webhook values or full sensitive message content.
