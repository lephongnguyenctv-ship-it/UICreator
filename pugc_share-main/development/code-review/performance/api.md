# Performance Review APIs and Signals

This is a source-token inventory, not a claim about undocumented FC signatures or scheduling guarantees. Verify each call and event declaration in the target project's `EditorGenLib.fcc` and installed runtime before reasoning about execution.

## Network and payload

- `GetAllPlayers`, `DispatchEventToEntity`, `BroadcastCustomEvent`, `PlatformType.Client`: trace sender, receiver and whether payload is identical/private.
- `List.Clone`: inspect batch dispatch followed by clear/reuse; do not assume the runtime copies the list.
- `Map.ContainKey`: inspect delta updates to cached payload and pending join snapshots.
- Stable pool IDs (source example `_ParadePoolIndex`) and join snapshot generation/end marker: map creation, reuse, removal and stale-batch handling.

## Server and lifecycle

- `OnAwake`, `OnUpdate`, `while true`, `WaitForMillisecond`, `WaitForNextFrame`, `OnPlayerJoin`, `OnUserQuitOrUserMatchEnd`, `OnDestroy`: identify owner, wait boundaries, stop conditions and cleanup.
- `List.Contain`, `List.RemoveAt(0)`, `List.Insert(0)`: inspect repeated scans or front mutations on growing collections, plus registry cleanup when an owner leaves.
- `LogInfo`: find concatenation in input, tick and loop paths.
- Dirty maps, cached aggregates and affected-field predicates: trace every write to result consumers.

## Client and UI

- `SetActive`, `VisiblePlayers`, `ReturnToPool`, `ResetForPool`, `BumpTurn`: inspect effect creation, reuse, state reset and owner-only world-label audience.
- `IsVisible`, `OnUpdate`, per-item HUD update methods and `Tween`: inspect whether hidden objects still run scripts/triggers or unchanged display still rebuilds.

## Scope boundary

`ReadFromDataStoreBatch`, `WriteToDataStore`, readiness flags and dirty saves route to the registered [database pack](../database/rule.md). Performance review may map their call frequency but must not issue quota, durability or consistency findings under `PERF` IDs. No numerical speedup, API atomicity or network-copy behavior is assumed without target-project measurement or runtime evidence.
