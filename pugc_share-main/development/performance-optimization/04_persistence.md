---
title: Performance Optimization — Persistence
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 04 — Persistence Boundaries

The [database pack](../code-review/database/rule.md) is canonical for quota, save safety, retries, stale sessions and consistency. Use it for findings; this page highlights performance interactions from a multiplayer Craftland project.

| Problem | Implementation | Expected benefit | Trade-off / trap | Review signal |
|---|---|---|---|---|
| Independent join reads per key | Batch keys within the supported domain/table, map results to keys deliberately | Fewer calls at join | Positional results can silently shift after key reorder; side-effect keys such as ban/kick must not share a load gate | Repeated `ReadFromDataStore` after join; positional result indexes |
| Save after failed load | Gate save on successful readiness across required databases | Prevent default state overwriting real state | Failed load needs explicit recovery; see DB rules | Save path reachable while ready flag is false |
| Every mutation writes immediately | For suitable keys, flush dirty live values on a bounded interval and clear dirty only on success | Coalesce writes | Crash can lose one interval; writing a dirty bool instead of the live value or omitting a changed field from the dirty set loses state | `OnUpdate` save timer and dirty map diverge from actual fields |
| Valuable state can be overwritten by old server | Verify latest database value against successful read/write cache before critical mutation, then abort on mismatch | Protect high-value data | Additional read and latency; exact consistency guarantee must be verified | Critical write based only on session-old cache |
| Writes serialized during shutdown | Define a durability plan and test interruption | Surface partial-save risk | Parallelizing without ordering can worsen consistency | Several keys saved with waits on quit/destroy |

The source used bounded retries with different backoff for Timeout and LimitExceeded, plus quit and destroy fallback saves. Those are project examples, not universal numeric requirements. A version without periodic flush could lose a full session on crash. Test interval-save serialization with a changed value and verify that every persisted field, including weather-like state, enters the dirty set.
