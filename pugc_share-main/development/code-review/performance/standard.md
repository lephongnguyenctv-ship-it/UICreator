# Performance Review Standards

## Design requirements

- Preserve targeted/private delivery while broadcasting identical shared state once.
- Keep client/server config and protocol defaults synchronized; ensure delta changes also update pending snapshots and remove paths clear caches.
- Tie every owner coroutine to lifecycle and revalidate after waits.
- Keep aggregate input fields and invalidation sites together; verify both stale-value and unnecessary-invalidation cases.
- Delay or skip invisible UI work, then refresh once when visible. Update changed items where possible.
- Pool and lazy-create effects according to quality; reset async turns and signatures before reuse.
- Gate stress seeds, bot handlers and debug logs. Record actual before/after performance data.
- Scope registries by owner, clean them on departure, make add/remove idempotent and use a map when a hot path needs frequent membership checks.
- Deactivate hidden objects when their scripts and triggers need not run; restore state on reuse.
- Restrict owner-only world labels to their intended audience through `VisiblePlayers` or the project's verified equivalent.

## Anti-patterns and code examples

Bad: `for target in GetAllPlayers()` builds the same visual payload and calls `DispatchEventToEntity` for each target. Better: build it once and call `BroadcastCustomEvent` once, provided receiver filtering and private snapshot behavior are preserved.

Bad: `while true { wait WaitForMillisecond(1000); UpdatePlayer(playerUID) }` after per-player startup, with no quit check. Better: loop while the owner state exists and check a cancellation/generation token after each wait.

Bad: `ReturnToPool(visual)` while a coroutine waits, then the continuation applies the old effect to a reused visual. Better: bump a turn on return/reuse and compare it after every wait.

Bad: every mission tick calls full HUD initialization while the tab is hidden. Better: mark it dirty, update only the cheap alert if needed, and refresh when opened.

Bad: an append-only global list is scanned with `List.Contain` for every create or steal action. Better: keep a bounded owner registry, remove it on quit, and use keyed lookup where repeated membership checks require it.

Bad: a pooled object sets `IsVisible = false` while unused scripts and triggers continue. Better: use `SetActive(x, false)` when the whole object can stop safely.

Bad: every player's client receives owner-only world labels for every base slot. Better: limit their visibility to the owner when the information is private.

## Review checklist

- [ ] Which path repeats, and how often can it run from source/config?
- [ ] Is the payload identical, public and safe to broadcast?
- [ ] Are pending snapshots, protocol defaults and remove paths covered?
- [ ] Does every loop terminate with its owner, including after a wait?
- [ ] Does every aggregate write invalidate exactly the necessary cache?
- [ ] Does hidden HUD state refresh correctly when visible again?
- [ ] Can pooled async work cross an ownership turn?
- [ ] Is worst-case/test work disabled in release?
- [ ] Are measured claims backed by comparable before/after runs?
- [ ] Can a global registry grow across owner departures or require repeated linear scans?
- [ ] Do visibility-only hidden objects continue unnecessary scripts, triggers or updates?
- [ ] Are owner-only world labels limited to their intended viewers?

## Targeted verification

Test join/quit/rejoin repeatedly, then observe active loop count and registry size; exercise duplicate add/remove and hot membership checks. Change each aggregate input separately and compare cached with uncached values. Force join snapshot plus delta/removal races. Return a visual to pool while an effect waits; check that hiding stops unnecessary work and reuse restores required state. Inspect owner and non-owner clients with many bases and slots to verify private label visibility. Toggle HUD visibility around progress and daily reset. Compare quality modes and run the [client](../../client_performance_test.md) and [server](../../server_performance_test.md) release tests when a candidate fix is implemented.

These are recommendations for the reviewed project owner. The reviewer does not edit the source.
