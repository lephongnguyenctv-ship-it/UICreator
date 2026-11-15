# Database Review Workflow

Use this workflow only when the user explicitly requests a database review or
clearly names database storage, datastore quota, save/load player data, or the
`database` pack. When no pack is explicit, the shared contract may select this
pack from its registered applicability signals.

## 1. Import the Project

Use the shared project-root and read-only rules in
[`../../code_review.md`](../../code_review.md). The caller must provide a readable
local project path. Reuse an existing local clone when available. Cloning,
fetching, or checking out a repository writes to disk and requires explicit
approval before it is attempted.

Analyze the project read-only. Do not modify the reviewed source, create fixes,
or write output anywhere except the single Vietnamese report required by the
shared contract at the project root.

## 2. Review References

Read these pack files before drawing conclusions:

- [`api.md`](api.md) for database APIs, lifecycle hooks, and detection patterns.
- [`rule.md`](rule.md) for violation criteria and severity.
- [`standard.md`](standard.md) for remediation guidance and test scenarios.

## 2A. Align the Review With the Creator Guide

Use `UGC_DataStorage_Creators_Guide_English.pptx` (2026.08) as the supplied
source of truth for storage capabilities and the current-vs-OB56 distinction.
The review must first classify each path as Automatic, Standard, or External
Storage, then classify Standard paths as Regular, Multi-column, Leaderboard, or
Accumulation.

Record these guide-specific facts when the source exposes them:

- Automatic Storage: player custom property, system-managed reads/writes and
  exit save, outside Standard Storage quota, current 10-field primitive/list
  support, 5 s auto-write, 4 KB error boundary, and stable name/type restore.
  Treat 20 fields, nested lists, and failed-value/context details as OB56 plan.
- Standard Storage: full-value replacement for Multi-column writes;
  no-cache-read plus blocking-write for conflict-prone keys; Leaderboard score
  ordering plus same-key metadata; Accumulation signed deltas for concurrent
  global totals.
- Configuration layers are system-managed: backend capacity, room/message
  capacity, game-server budget, and full-MapCode whitelist policy. Keep room/
  message limits, value-size limits, and gameplay-server read/write budgets
  separate.
- Capacity: reads and writes are separate budgets. Use the active formula
  `min(100 + 5P, 150)` before a verified full-MapCode whitelist multiplier,
  where `P` is the authoritative maximum normal concurrent-player count.
- Management lifecycle: Editor defines; Creator Center views/searches/edits/
  cleans live data and serializes same-map/table/server jobs; Gameplay consumes
  only validated, ready data. Treat live edits as non-undoable.

Do not invent External Storage APIs, security, consistency, or quota details;
the guide marks them TBD. Do not treat sample config values as universal.

## 3. Analyze the Project

Before calculating quota, determine the project's maximum normal
concurrent-player count from an authoritative project setting, game-mode/lobby
configuration, or source-defined player cap. Cite the location used. Use that
verified value in the calculation; never substitute an assumed player count.
Calculate reads and writes separately as `min(100 + 5P, 150)` and then apply
only a verified system whitelist multiplier for the full MapCode. If no authoritative player cap is available,
express capacity as a formula using `P` players and record `P` as unknown under
`Unknowns / Assumptions`.

Identify every database foundation and table/key and trace its production player flow from
initialization through reads, in-memory mutation, scheduled writes, quit
handling, and game-end handling. Record the player identity, table, key, payload
type and estimated serialized size, read/write call sites, call frequency,
dirty-state ownership, interval, cache TTL, consistency mode, retry behavior,
and failure handling. Exclude
debug, editor, test, mock, benchmark, and QA-only paths from quota calculations
and findings unless the source proves they are reachable by normal players in
a production game.

Treat async functions, callbacks, timers, `start`, `wait`, and overlapping
lifecycle events as concurrency boundaries. Verify that older reads or writes
cannot overwrite newer state, that a failed write leaves data eligible to retry,
and that quit/end flushing does not silently discard unsaved state.

When a project supports rejoining an existing session, trace every player-keyed
cache on `globalEntity` or equivalent shared state. At the synchronous start of
`OnPlayerJoin`, before any `wait`, timer, `start`, async callback, or dispatch
that can run a consumer, verify the project creates/increments a
`sessionGeneration` for the UUID and invalidates or fences all prior
dependency-ready/cache state. Clearing only on quit is not sufficient.

For every database dependency, prove this current-visit order: load completes
for the captured generation -> data is parsed/validated -> data is assigned
into the exact runtime variable read by action/save code -> `hydratedGeneration`
equals the current generation -> ready is set true -> dependent UI/action/save
is enabled. Trace all read/write callbacks and prove they capture their visit
generation and return without mutation when it is no longer current. Treat
`AreAllDatabasesReady()` or equivalent aggregate flags as unsafe unless source
evidence proves every dependency's values and hydration generation belong to
the current visit.

Verify database-dependent UI/actions are blocked until their exact dependencies
meet that definition of ready, and verify save is blocked unless both
`readyGeneration` and `hydratedGeneration` equal the current session
generation. Trace quit, end, and post-save handling: pending state must remain
until persistence reaches a successful or explicit terminal recovery outcome,
while transient caches/flags must not be able to authorize a later visit. In
every DB-009/010/011 finding, name the staging/cache variable, runtime variable
used for save, relevant ready/loading/allow-save flag, missing generation
field/check, and the concrete timeline to stale/default overwrite.

For each read, verify its lifecycle placement, batch-read opportunity, and
`statusCode` handling. For each write, verify quota impact, result handling, and
safe retry/backoff. Treat per-key dirty flags, write intervals, and quit/game-
end flush strategy as context-dependent recommendations: report them as
findings only when source evidence shows quota breach, data loss, stale
overwrite, or another concrete violated requirement. Do not assume
undocumented database atomicity, ordering, or retry semantics; place missing
proof under `Unknowns / Assumptions`.

## 4. Output

Use the shared report naming, collision, inline fallback, and Vietnamese report
format in [`../../code_review.md`](../../code_review.md). Do not create the legacy
pair of English and Vietnamese database reports. Create exactly one shared
report at the project root.

Only report findings with IDs `DB-001` through `DB-011` defined in
[`rule.md`](rule.md). Include the database data-storage map, quota formulas,
evidence locations, root-cause grouping, recommendations, unknowns, and test
results required by the shared report contract.

The database report must use the shared skeleton and add these concrete
database-specific sections:

- `Finding Overview`: a compact table with ID, severity, affected table/key or
  lifecycle flow, root cause, impact, and fix priority.
- `Data Storage Map`: the verified maximum normal player count and its source;
  storage foundation and Standard table type; every production table/key;
  payload type and size estimate; effective config layer; read/write locations;
  frequency or interval; cache TTL; consistency mode; dirty/retry state; and
  readiness/cache ownership. For rejoin-sensitive data, include staging/cache variables, the
  runtime variable used for saving, ready/loading/allow-save flags, session,
  hydrated, and ready generations, and the load -> parse -> hydrate -> ready ->
  action/save order. Mark unavailable values as unknown and exclude QA-only
  paths.
- `Potential Issues`: group findings by root cause and remediation pattern.
  For DB-009, DB-010, and DB-011, include the stale and current visit
  generations plus a numbered timeline showing how stale/default data reaches
  the save source.
- `Recommendations`: provide one shared remediation pattern per root-cause
  group, then list only key-specific exceptions.

Use this database finding-card shape inside `Potential Issues`:

```markdown
### DB-003 — Production write rate exceeds verified quota

- **Severity:** High
- **Violated rules:** DB-003
- **Impact:** Write quota can be exhausted and later player changes may not persist.
- **Root cause:** The production mutation rate and verified player cap produce more writes than the active quota allows.
- **Affected storage:** `PlayerProfile` / `currency`.

| Location | Evidence |
|---|---|
| `path/file.fcg:line` | Short fact proving the read, mutation, or write path. |

**Failure timeline**

1. The cited normal-player flow produces writes at the measured/projected rate.
2. With the verified player cap, aggregate writes exceed the calculated active quota.
3. Later writes can fail or be delayed after the project reaches quota.

**Fix:** Apply a project-appropriate write strategy without changing source during review.

**Invariant:** Every accepted in-memory change is either durably persisted once or remains eligible for a safe retry.
```
