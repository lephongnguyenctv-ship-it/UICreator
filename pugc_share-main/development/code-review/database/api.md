# Data Storage APIs

> **Guide baseline:** `UGC_DataStorage_Creators_Guide_English.pptx` (2026.08).
> The guide distinguishes current behavior from the OB56 plan. Keep those
> states separate when reviewing source or configuration. Exact runtime
> signatures and return objects still require verification against the
> installed Database runtime.

## Storage foundations

### Automatic Storage

- Enable a custom property on the player entity; the system owns reads,
  periodic writes, and save-on-exit.
- Automatic Storage is outside the Standard Storage per-minute quota.
- Current guide baseline: up to `10` fields, primitives and lists of
  primitives, and a `5 s` auto-write interval.
- Current error boundary: a value over `4 KB` fails.
- The property name is a stable key once enabled. Restoring a field requires
  the same name and type.
- **OB56 plan, not current behavior:** up to `20` fields, nested lists such as
  `List<List<Object>>`, and failed-value/context details in the error result.
  The `10 -> 20` change requires a hotfix rollout; the 21st field blocks
  creation under the planned limit.
- TODO: Verify the editor/config API that enables a custom player property and
  the exact auto-save error object in the installed runtime.

### Standard Storage

- Creator-controlled reads, writes, deletes, quotas, cache behavior, and
  consistency handling.
- The four table types are Regular, Multi-column, Leaderboard, and
  Accumulation. See the table-type map below.

### Persistence outcomes

- Persistence should carry progress such as levels, currency, quests, and
  unlocks; rankings such as scores, seasons, and regions; or world state such
  as global totals, public events, and long-term interaction.
- Storage calls are asynchronous and can be limited or delayed. Model the
  request path as Block/API -> Game Server batching/cache/rate limiting ->
  backend validation/authorization/persistence -> Database. Timeouts, quota
  responses, and status codes are normal branches.

### External Storage

- External services are an on-demand foundation for complex online worlds.
- The guide marks capabilities and security as TBD. Do not invent an API,
  consistency guarantee, authentication model, or quota until the platform
  contract is available.

## Import

```text
import "Database.fcc" as Database
```

## Standard Database APIs

### Single read

- `ReadFromDataStore`
- [deprecated] `ReadDBSheetValue_V2`
- `ReadFromDataStoreByColumn`
- [deprecated] `ReadDBSheetColumnValue`
- `ReadFromDataStoreSteady`
- `ReadFromDataStoreByColumnSteady`
- `read_nocache` behavior/API for conflict-prone or sensitive reads. Verify
  the exact function name and signature in the installed runtime.

### Batch read

- `ReadFromDataStoreBatch`
- [deprecated] `BatchReadDBSheetValue`
- Batch independent keys in the same table when the request shape supports it.

### Write and update

- `WriteToDataStore`
- `WriteDBSheetValue_V2`
- `UpdateToDataStore`
- `WriteToDataStoreV2`
- [deprecated] `RemoveFromDataStore`
- [deprecated] `DeleteFromDataStore`
- `write_blocking` behavior/API for version validation and conflict-prone
  writes. Verify the exact function name and signature in the installed
  runtime.

## Table-type map

| Type | Key/value shape | System behavior | Review focus |
|---|---|---|---|
| Regular | UID + key + value | Persistence | Creator-owned consistency; player progress and inventory |
| Multi-column | Key + multiple fields | Regular-table wrapper | Stable schema and types; writes replace the full value, not a partial field |
| Leaderboard | Key + score + rank | Sort order and top ranks | Separate ranking from metadata; current guide config supports up to 10 tables and 200 entries per board |
| Accumulation | Key + integer | Offset accumulation | Submit `+N`/`-N` deltas for concurrent global totals; reads may be cached |

For Leaderboard tables, inspect the companion metadata table that joins on the
same key. The system owns score ordering; the creator owns key choice, score
semantics, metadata fields, and refresh timing. The guide notes that writes may
remain cached until exit or game end.

For Accumulation tables, inspect the delta calculation rather than treating the
operation like a Regular-table read-modify-write. The current guide baseline is
`200` accumulation records, a `10 s` read-cache TTL, and scheduled clearing in
Data Center. Verify each value against active configuration.

## Consistency and cache modes

- Standard, low-contention flow: read -> validate -> write.
- Conflict-prone flow: `read_nocache` -> validate existence, permissions, and
  version -> `write_blocking`.
- After invalidation, read again, recompute from the newest value, then issue a
  blocking write. Never overwrite blindly after a failed validation.
- The guide's current backend cache examples are approximately `2000 ms` for
  writes and `1000 ms` for reads. Cross-room reads can therefore be stale;
  treat timeouts, quota exhaustion, and status codes as normal branches.
- A quick exit can miss the final dirty batch. The guide notes that OB55 adds
  exit save, but hard quotas still apply.
- Accumulation reads can use the table's configured cache TTL. Do not apply
  Regular-table consistency assumptions to global totals.

## Lifecycle and management surfaces

- `OnPlayerJoin`: expected initialization point for player data reads and
  automatic-property hydration.
- `OnUserQuitOrUserMatchEnd`: inspect pending persistence, exit save, cache
  cleanup, and rejoin fencing for the leaving player.
- `OnGameEnd`: inspect final persistence and cleanup for all active players.
- **Editor:** define properties and tables, and build XP, level, reward, and
  other gameplay logic. The guide maps Mobile to Automatic Storage, PC to
  Automatic + Standard Storage, and External Storage to a later stage.
- **Creator Center:** view/search/edit live data, paginate complex values,
  clean or schedule cleanup for Leaderboard/Accumulation tables, and operate
  future batch jobs. Treat edits as live, high-risk writes that cannot be
  undone.
- **Gameplay:** read player progress, display rankings, and display
  accumulated results only after the relevant data is ready and validated.

## Configuration sources and limits

These are system-managed configuration layers, not project files. Consume the
effective values supplied by the platform; do not require creators to carry or
edit the underlying system configuration:

- **Backend capacity:** key/value limits, table counts, and backend cache
  settings. The guide shows `50 B` key length, `4096 B` value, `30` Regular
  tables, `10` Leaderboards, `2000 ms` write cache, and `1000 ms` read cache in
  the current config snapshot.
- **Room and message capacity:** UGC Data-Storage room caps by region and tab
  type, plus room-creation and other message-rate limits by region, protocol,
  and command. A room-creation limit is not a data-storage read/write quota.
- **Game-server budget:** request timeout, read/write quota, multipliers, and
  cache. The guide baseline is `min(100 + 5 x Active Players, 150)` per minute
  for reads and separately for writes. Use the configured interval/amount and
  do not assume the slide's sample values.
- **Map whitelist policy:** a multiplier applies only when the full MapCode is
  configured. A short code is unsupported. The multiplier scales only that
  map's per-minute read/write quota; it does not change value size or backend
  room capacity.

Additional limit references from the guide:

- Key length: `50 B`.
- Automatic Storage error boundary: `4 KB`.
- Standard Storage: `6144 B` in the active-mode limit summary; the backend
  snapshot and the Regular/Multi-column safety guidance show `4096 B`.
  Record which layer supplied the effective value and use the stricter
  configured limit when uncertain.
- Request timeout: `2500 ms` in the current mode snapshot.
- Leaderboard: up to `10` tables and `200` entries per board in the current
  guide configuration.
- Accumulation: up to `200` records and a `10 s` read-cache TTL in the current
  guide configuration.

## Failure/status handling

Treat every result status as an explicit branch:

| Status | Meaning | Safe next step |
|---|---|---|
| Timeout | Backend did not answer in time | Limited retry with backoff and context logging |
| Read/write quota exceeded | Per-minute budget exhausted | Reduce frequency, batch, or wait for the next window |
| Value too large | Record exceeds the effective size limit | Split/compact schema; do not retry unchanged |
| Data invalidated | Value changed between read and write | `read_nocache`, recompute, then `write_blocking` |
| No permission | Target MapCode has a different creator | Stop and validate map ownership |
| Table not found | Removed, not created, misnamed, or module not ready | Check publishing, table name, and module state |

Retries are for temporary failures. Schema, permission, invalidation, and
capacity problems need a changed input or an explicit recovery path.

## Detection patterns

- Find the storage foundation, table type, MapCode, table/key declarations,
  payload construction, field schema, and effective configuration together.
- Find automatic-property definitions and verify field count, supported types,
  stable property names, restore-by-name/type behavior, and the `4 KB` error
  boundary.
- For Regular/Multi-column data, find the read-validation-write sequence,
  full-value replacement, stable constants for names/types, schema version,
  migration, dirty state, retry policy, and whether conflict paths use
  no-cache reads plus blocking writes. On the critical path, inspect
  AccountId + Key serialization and version validation.
- For Leaderboards, find score/rank writes separately from same-key metadata,
  top-entry limits, refresh timing, and exit/end cache behavior.
- For Accumulation, find signed deltas, record limits, read-cache TTL, and
  Data Center cleanup scheduling. Do not model it as a global Regular-table
  total.
- Find Creator Center edits, cleanup jobs, CSV import/export paths, progress
  and failure reporting, and serialization of writes for the same map/table/
  center server. Mark OB56 roadmap items as planned, not current.
- Treat `async func`, `start`, `wait`, timers, dispatches, and database
  callbacks as stale-read/stale-write boundaries. Capture the session
  generation before scheduling work and return without cache/runtime mutation
  or save when it is stale.
- Find player-keyed `globalEntity` or equivalent caches, ready/loading/saved/
  pending/allow-save flags, `sessionGeneration`, `hydratedGeneration`, and
  `readyGeneration` through join, quit, save completion, and rejoin.
- Locate the normal concurrent-player cap in authoritative source/configuration
  before calculating quota. Exclude debug, editor, test, mock, benchmark, and
  QA-only paths unless normal players can reach them.

TODO: Verify the exact signatures, status-code enum, success semantics,
retryability, ordering, and atomicity of every non-deprecated API in the
installed Database runtime.
