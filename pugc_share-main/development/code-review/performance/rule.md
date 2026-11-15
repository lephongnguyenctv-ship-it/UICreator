# Performance Review Rules

Report a finding only when the source shows repeated or orphaned work and the proposed change preserves behavior. Signals alone select the pack; they do not prove a violation. For uncertain runtime behavior, record a limit or recommendation instead of asserting a defect.

## PERF-001 — Redundant per-recipient visual dispatch

- **Violation:** A source-proven identical, non-private visual payload is rebuilt/dispatched separately to every player in a reachable loop.
- **Check:** Trace `GetAllPlayers`, payload construction, `DispatchEventToEntity`, target filtering and receiver behavior. Confirm a single broadcast would deliver the same information and preserve private paths.
- **Severity:** Medium; High when the loop is in a frequent production path and room size is material.
- **Valid exception:** Payload or authorization differs per recipient, or broadcast cannot preserve delivery semantics.

## PERF-002 — Repeated full visual state for a small change

- **Violation:** A frequent single-field visual change rebuilds and sends the complete state while receivers already retain the current state and no other field changed.
- **Check:** Trace all changed fields, receiver cache, join queue and remove path. Show that a delta can update both active and queued state.
- **Severity:** Medium.
- **Valid exception:** Receiver has no dependable baseline, or full resend is needed for resynchronization.

## PERF-003 — Owner loop has no lifecycle exit

- **Violation:** A player/object-owned loop continues after quit, despawn or release because it has no owner stop condition or cancellation check after waits.
- **Check:** Trace creation, `while true`/wait, quit/despawn cleanup, reconnect and any delayed continuation. Prove the loop can remain active after owner removal.
- **Severity:** High for accumulating coroutines; Medium for bounded redundant work.
- **Valid exception:** A deliberately global singleton loop with bounded lifetime and explicit cleanup.

## PERF-004 — Aggregate cache invalidation is incomplete or indiscriminate

- **Violation:** A cached aggregate is read after a relevant field changes without invalidation, or a high-frequency unrelated field invalidates it every tick and defeats its stated purpose.
- **Check:** Enumerate input fields and all write sites, then compare with the affected-field predicate and cache consumers. Distinguish correctness failure from lost performance.
- **Severity:** High for source-proven stale gameplay values; Medium for demonstrable unnecessary recalculation.
- **Valid exception:** The aggregate is intentionally recomputed, or another proven mechanism maintains cache validity.

## PERF-005 — Hidden or unchanged HUD performs full rebuild

- **Violation:** A reachable update path rebuilds or relayouts a hidden HUD, or rebuilds every item for one changed item despite an available item-level update path.
- **Check:** Trace visibility/tab state, tick/event handler, full initialization and item update. Verify dirty state is applied when reopened.
- **Severity:** Medium.
- **Valid exception:** Hidden state must be rendered for a verified dependency, or the list is so small/infrequent that the project intentionally chooses full refresh; record that rationale.

## PERF-006 — Pooled async render can apply stale state

- **Violation:** An async render/effect continuation can run after `ReturnToPool` and reuse without checking owner/turn after its wait, allowing old state to appear on a new object.
- **Check:** Trace each wait, pool return/reassignment, turn/signature reset and later activation.
- **Severity:** High when wrong-owner visual state is reachable; Medium when it only duplicates work.
- **Valid exception:** Runtime or source proves cancellation completes before reuse.

## PERF-007 — Unbounded join/frame creation burst

- **Violation:** A join/snapshot path instantiates a source-proven large collection of visuals or HUD objects in one frame with no yield, quality limit or reuse.
- **Check:** Identify collection bound, loop, instantiate call and scheduling. Report the concrete count/path; do not claim FPS impact without measurement.
- **Severity:** Medium.
- **Valid exception:** A measured bounded workload is required to appear atomically.

## PERF-008 — Hot-path logging or test workload always enabled

- **Violation:** A frequently reachable handler constructs `LogInfo` messages each invocation with no runtime gate, or a worst-case seed/bot workload is reachable in production without a disabled-by-default flag.
- **Check:** Trace handler frequency, concatenation, flag default, and release entry path. Distinguish necessary structured operational logs from diagnostic spam.
- **Severity:** High for production-reachable stress workload; Medium for repeated diagnostic logging.
- **Valid exception:** A verified limited diagnostic build or deliberately bounded operational event log.

## PERF-009 — Unbounded global registry or linear lookup on a hot path

- **Violation:** A player/object registry grows across owner departures without cleanup, or a reachable frequent create/steal/anti-dupe path scans a growing list with `List.Contain` or an equivalent linear lookup.
- **Check:** Trace registry add/remove, owner quit/despawn, duplicate additions, collection bounds and lookup callers. Show the unbounded lifetime or repeated linear scan from source; do not claim measured CPU cost without profiling.
- **Severity:** Medium; High when entries can accumulate without bound across join/quit cycles.
- **Valid exception:** The collection has a demonstrably small bound and the project records why a linear lookup is acceptable.

## PERF-010 — Visibility-only hiding leaves object work active

- **Violation:** An object or pooled object is hidden with `IsVisible = false` or an equivalent display property while its scripts, triggers or updates remain active even though the object has no required hidden logic.
- **Check:** Trace the hide/reuse path and reachable scripts, triggers or updates. Recommend `SetActive(x, false)` only when the object's logic can safely stop; verify reactivation state and runtime behavior in the target project.
- **Severity:** Medium.
- **Valid exception:** The hidden object must continue running documented logic.

## PERF-011 — Owner-only world labels visible to every player

- **Violation:** Cash, collect or similar world labels multiply across bases and slots and are shown to all players although only the owner needs them.
- **Check:** Trace label creation, base/slot bounds, audience and any `VisiblePlayers` or equivalent visibility filter. Confirm the data is owner-only before recommending audience restriction; do not assert frame impact without measurement.
- **Severity:** Medium.
- **Valid exception:** The information is intentionally public to all players.
