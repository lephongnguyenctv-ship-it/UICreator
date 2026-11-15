---
title: Performance Optimization — Pitfalls and Open Work
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 08 — Pitfalls and Open Opportunities

| Pitfall | Consequence | Check |
|---|---|---|
| No before/after PerfDog or server figures | Improvement and regression remain unproven | Use the [measurement record](07_measurement.md) |
| Test feature hard-coded on | Debug workload may ship | Gate with runtime flag and verify release state |
| Hot-path logs commented out | Diagnostics unavailable when needed | Gate selective structured logs with a flag |
| Client/server config copied with only a sync comment | Wrong visuals/text after version drift | Generate/check both from one source |
| Animation timing duplicated on both sides | Client preview and result diverge | Share timing source or send timing in payload |
| Batch result interpreted by position | Silent field swap | Bind results to stable keys; keep side-effect keys separate |
| Dirty field missing from cache or save set | Stale aggregate or lost state | Centralize affected-field list and test each mutation |
| Comparison guard reversed | Suppresses visible update | Test above/below threshold and equality |
| Cache removed in refactor | Old hot path returns | Record cache invariant and compare profiles |
| Pooled async visual has no generation check | Old effect appears on new owner | Check turn after every wait |

**Open source opportunity:** An income calculation by slot reportedly ran every second for each slot and player, with `List.Clone` on the return path, after a per-slot cache was lost in a refactor. A dirty cache like the aggregate-income pattern may help, but this is an investigation hypothesis until code and measurements confirm it in the target version. A reversed comparison guard can suppress a visible update; test below, at and above its threshold. The source also notes no periodic full flush and sequential shutdown saves; those need durability review through the [database pack](../code-review/database/rule.md).
