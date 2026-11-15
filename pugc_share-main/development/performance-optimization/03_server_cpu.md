---
title: Performance Optimization — Server CPU
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 03 — Server CPU and Loops

| Problem | Implementation | Expected benefit | Trade-off / trap | Review signal |
|---|---|---|---|---|
| Aggregate recomputed in many callers | Cache per owner; mark dirty on writes to fields that affect it; clone returned mutable values | Move repeated scans off hot paths | Missing invalidation returns stale data; broad invalidation defeats cache | `GetBaseIncome`-like slot scan in leaderboard, reward or HUD path |
| A frequently written unrelated field invalidates cache | Centralize an explicit affected-field predicate | Preserve cache hit rate | New relevant fields must join predicate | Per-second `Balance` write calls aggregate invalidation |
| Player coroutine survives quit | Loop while owner data/ready state exists; cancel or fence after each wait and on removal | Prevent work accumulation across rejoins | Delayed save/cleanup can leave a short live window; prevent post-save mutations | `while true` in player-owned work, no terminal state |
| Global registry only grows | Scope registry by owner, remove on quit, make add/remove idempotent | Bound lookup and memory growth | Shared IDs may need separate global ownership mapping | `List.Contain` against append-only global IDs |
| Repeated static calculations | Precompute weights/CSV maps at `OnAwake` and reuse | Remove repeated parse/scans | Honor engine collection limits; front insertion/removal is costly | Same immutable table parsed per request |
| Many players join in one frame | Stage noncritical DB/base initialization and visual work | Flatten join spike | Do not allow gameplay before data is ready; delays are project-specific | Join handler performs all heavy work synchronously |
| String-building log in input/tick handler | Gate structured debug logging behind a runtime flag | Remove avoidable hot-path work | Retain selective operational logs for important flows | `LogInfo` with concatenation in frequent handler |
| Heavy feature cannot be disabled safely | Decode a boot-time bitmask into flag lookup, with safe fallback | Fast kill switch and A/B diagnosis | Source implementation has at most 31 flags and needs a new match to reload | Test/heavy feature hard-coded on or off |

### Example

Illustrative FC fragments use `RecalculateIncome` and `AffectsIncome` as existing project logic, not engine APIs.

Getter — the `GetIncome(owner)` body recalculates only when dirty and clones the cached result for its caller:

```fcg
if _IsDirty[owner] {
    _CachedIncome[owner] = RecalculateIncome(owner)
    _IsDirty[owner] = false
}
return List.Clone(_CachedIncome[owner])
```

Selective invalidation — the `OnFieldChanged(owner, field)` body marks dirty only for an income input:

```fcg
if AffectsIncome(field) { _IsDirty[owner] = true }
```

Owner lifecycle — the task runs only while player data exists and checks again after waiting:

```fcg
while Map.ContainKey(_PlayerData, playerUID) {
    wait WaitForMillisecond(1000)
    if !Map.ContainKey(_PlayerData, playerUID) { return }
}
```

Check every relevant write, warm-cache correctness, and quit/rejoin cancellation. An unrelated per-second balance change should not defeat the cache.
