# Data Storage Review Rules

## DB-001 - Per-key storage-size limit

- **Violation:** A stored key exceeds the effective configured payload limit.
- **Check:** Estimate or measure every production table/key and identify the
  configuration layer that supplied the limit. The guide baseline is `4 KB`
  for Automatic Storage, `4096 B` in the backend/Regular guidance, and
  `6144 B` in the Standard active-mode summary. Do not collapse these layers;
  use the stricter effective configured limit when the project cannot prove
  otherwise. Record unknown fields and maximum list/string lengths.
- **Severity:** High when writes can fail or truncate; Medium when the estimate is close to the limit but unverified.
- **Valid exception:** None. The `2 KB` default is a planning target, not a hard violation threshold.

## DB-002 - Read-quota compliance

- **Violation:** The projected aggregate production-player read rate exceeds the active quota: `min(100 + 5P, 150)` reads/minute before any verified full-MapCode whitelist multiplier.
- **Check:** Obtain the maximum normal concurrent-player count `P` from an authoritative project configuration or source location and cite it. Count only normal-player reachable read paths, including join, retry, timer, reconnect, and error paths. Calculate `min(100 + 5P, 150)`, apply only a verified system whitelist multiplier for the full MapCode, and compare it with peak requests per minute. If `P` or the effective multiplier cannot be verified, report the formula and unknown input; do not assume a player count or short MapCode match.
- **Severity:** High when the projected rate exceeds the cap; Medium when it depends on an unverified normal-player rate.
- **Valid exception:** Debug, editor, test, mock, benchmark, and QA-only paths are excluded unless normal production players can reach them. A documented platform guarantee or measured runtime bound proves the peak is within quota.

## DB-003 - Write-quota compliance

- **Violation:** The projected aggregate production-player write rate exceeds the active quota: `min(100 + 5P, 150)` writes/minute before any verified full-MapCode whitelist multiplier.
- **Check:** Obtain and cite the same verified maximum normal concurrent-player count `P` used for DB-002. Count only normal-player reachable writes from mutation, periodic flush, quit, game-end, retry, and callbacks. Calculate `min(100 + 5P, 150)`, apply only a verified system whitelist multiplier for the full MapCode, and compare it with peak requests per minute. If `P` or the effective multiplier cannot be verified, report the formula and unknown input; do not assume a player count or short MapCode match.
- **Severity:** High when the projected rate exceeds the cap; Medium when it depends on an unverified normal-player rate.
- **Valid exception:** Debug, editor, test, mock, benchmark, and QA-only paths are excluded unless normal production players can reach them. A verified limiter bounds all production paths below quota.

## DB-004 - Write scheduling and persistence safety

- **Violation:** A production write strategy demonstrably breaches DB-003, loses accepted state, or clears retry eligibility before a successful persistence result.
- **Check:** Trace each write path and its normal-player rate. Assess whether dirty flags, intervals, batching, immediate writes, or flush-on-quit/end are appropriate for the project's data criticality and lifecycle. For Automatic Storage, verify the current `5 s` auto-write behavior and `4 KB` boundary. For Multi-column, verify that writes replace the full value. For Leaderboard data, include cached writes that may flush at exit/end. Verify that failed writes do not silently discard state when durability is required.
- **Severity:** High for demonstrated loss of progression, inventory, or currency; Medium for a demonstrated quota risk; otherwise provide a recommendation, not a finding.
- **Valid exception:** Immediate writes, interval-free writes, or a quit/end-only flush are valid when the project-specific flow remains within quota and meets its required durability guarantee.

## DB-005 - Read lifecycle and batching

- **Violation:** Player data is read outside `OnPlayerJoin` without a documented need, or independent keys in the same table use repeated single reads when batch read is available and the choice causes a concrete quota or gameplay-readiness risk.
- **Check:** Trace every production read call and its table/key set. Verify initialization happens after join and compare same-table single reads with `ReadFromDataStoreBatch`. For conflict-sensitive or cross-room keys, verify the flow can bypass stale cache with the guide's no-cache read behavior before validation.
- **Severity:** Medium; High when the pattern breaches quota or allows gameplay before authoritative data is ready.
- **Valid exception:** A source-proven recovery or explicitly required refresh flow that remains within quota.

## DB-006 - Read/write failure handling and retry safety

- **Violation:** A non-zero read `statusCode`, failed write, timeout, or retry path is ignored; or a retry can drop required state, duplicate a non-idempotent mutation, or retry without a bounded policy.
- **Check:** Inspect every result branch. Reads must handle non-zero `statusCode`; where the project requires persistence after failure, writes must preserve an appropriate retry or recovery path and use bounded retry/backoff when retries exist. Verify that timeout is retried with backoff, quota waits/reduces frequency, value-too-large changes the schema, invalidation re-reads and uses a blocking write, no-permission stops for MapCode validation, and table-not-found checks publishing/name/module state.
- **Severity:** High for player progression, inventory, or currency; Medium otherwise.
- **Valid exception:** A documented platform failure policy that safely removes the player or aborts the affected flow without data loss.

## DB-007 - Concurrent and stale-write protection

- **Violation:** Overlapping reads/writes, callbacks, or quit/end handling can overwrite newer state with stale data or mutate a player after its state has been released.
- **Check:** Identify async boundaries and concurrent lifecycle paths. Verify a version, generation, queue, lock, or equivalent ordering guard protects each key when the project can overlap operations. For Regular/Multi-column conflict paths, verify no-cache read plus blocking write. For Leaderboards, verify system ordering and separate metadata. For Accumulation, verify concurrent updates use signed deltas rather than a read-modify-write.
- **Severity:** High for persistent player state; Critical when stale writes can duplicate or lose currency/items.
- **Assumption:** Database request completion order and atomicity are unknown unless verified from platform documentation or a targeted test. TODO: Verify platform guarantees.

## DB-008 - Supported and versioned data representation

- **Violation:** Storage uses unsupported types, string-concatenated encoding, or a structured payload has no schema/version and cannot be safely evolved or decoded.
- **Check:** Confirm Standard values use `int`, `bool`, `float`, `Vector2`, `Vector3`, `Quaternion`, `string`, or `List`; inspect structured data for a version and backward-compatible decode path. For Automatic Storage, confirm the current primitive/list-of-primitive restriction, stable property name and type, and that nested lists are treated as OB56 plan rather than current support.
- **Severity:** High for undecodable production data; Medium for migration risk.
- **Valid exception:** A platform-supported encoding documented by an authoritative source and covered by a migration path.

## DB-009 - Rejoin-safe shared cache lifecycle

- **Violation:** A ready flag or player-keyed `globalEntity`/equivalent shared cache from an old visit can be read by a new visit before the new join synchronously invalidates or generation-fences it. Clearing only at quit does not satisfy this rule.
- **Check:** At the first synchronous statements of `OnPlayerJoin`, before every `wait`, timer, `start`, async callback, or dispatch that can run a consumer, verify the UUID receives a new/current `sessionGeneration` and every old dependency-ready/cache entry is cleared or fenced. Trace old read/write callbacks and confirm their captured generation prevents them from mutating cache or runtime state for a newer visit.
- **Severity:** Critical when stale cache can be saved as inventory, currency, or progression; High for other persistent player data.
- **Valid exception:** A cache intentionally survives rejoin only when source evidence proves it is session-independent, or it is keyed/fenced by a verified generation and cannot be consumed for player state before current-visit hydration.

## DB-010 - Hydration-before-ready and database action gating

- **Violation:** A dependency is treated as ready, or its UI/action/save is enabled, before the current visit has completed: load -> parse/validate -> assignment into the exact runtime variable used by action/save -> `hydratedGeneration == currentGeneration` -> ready. This includes a failed load that writes a default value then sets ready, an old ready state used for a new visit, or `_PlayerIsLoadingData = false`/allow-save set before hydration.
- **Check:** For every dependency, identify its staging/cache variable, runtime save-source variable, ready/loading/allow-save flag, current generation, hydrated generation, and ready generation. Prove save authorization requires `readyGeneration == currentGeneration` and `hydratedGeneration == currentGeneration`. For aggregate gates such as `AreAllDatabasesReady()`, prove every required value belongs to the current session; a boolean aggregate result alone is insufficient.
- **Severity:** Critical when default or stale data can overwrite persistent inventory, currency, or progression; High for other persistent data or database-dependent gameplay actions.
- **Valid exception:** The action/save does not read or mutate the dependency, or source evidence proves every required dependency has completed the stated current-generation hydration sequence.

## DB-011 - Transient database-state cache cleanup

- **Violation:** Ready/loading/allow-save/pending/saved flags or staging/runtime cache are neither cleared nor generation-fenced at quit/rejoin, can authorize action/save in a new visit, or are cleaned before the current persistence reaches a successful or explicit terminal recovery outcome.
- **Check:** Identify the owner and lifecycle of every transient state entry. Verify join invalidates/fences old state before any consumer can run; save authorization checks the current session, ready, and hydrated generations; and quit/end preserves pending state until success or an explicit terminal recovery policy. Confirm completion callbacks from old visits cannot clean, mutate, or save the new visit.
- **Additional check:** If Creator Center or cleanup jobs edit the same map/table, verify write jobs serialize for the same MapCode, table, and Center server, and that an overwrite is treated as live and non-undoable.
- **Severity:** Critical when stale flags/cache can authorize default/stale overwrite or loss of inventory, currency, or progression; High for other persistent data.
- **Valid exception:** A cache entry intentionally survives rejoin only when source evidence proves it is session-independent or generation-fenced, and it cannot authorize action/save before the current visit is hydrated.
