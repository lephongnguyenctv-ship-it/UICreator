---
title: Performance Optimization — Client Rendering
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 05 — Client Rendering

| Problem | Implementation | Expected benefit | Trade-off / trap | Review signal |
|---|---|---|---|---|
| Spawn/despawn repeatedly creates full visual hierarchy | Pool base visuals; reset async renderer, signature and active state on return; create ring/weather effects only when needed | Fewer allocations and startup objects | Cached effect ownership must be reset safely | Effect prefab instantiated in every `OnAwake`; destroy/recreate on slot change |
| Low quality still instantiates high-quality effects | Apply quality tiers before effect creation: source example Low none, Medium one, High rotating, Ultra all | Lower low-end load | Exact tiers are product choices; verify appearance | Quality branch occurs only after all effects are created |
| Join snapshot spawns hundreds of objects at once | Queue visuals by priority (own base, parade, other bases); instantiate across frames via `WaitForNextFrame()` | Reduce frame hitch | Join state can change while queued; reconcile deltas/removals | Large instantiate loop without yields |
| Async effect completes after pooled object is reused | Bump a render turn token on reuse and check after every wait; dedupe same render signature | Prevent old-owner effect flash and duplicate work | Every async path must check token, including error/cleanup | `ReturnToPool` and asynchronous render with no generation guard |
| Invisible object still runs scripts/triggers | Use `SetActive(x, false)` when lifecycle should fully stop | Avoid hidden work | Reactivation must restore correct state; visibility-only changes may be intentional | `.IsVisible = false` used to deactivate a full object |
| World labels shown to every player | Restrict `VisiblePlayers` to the owner when labels are private | Fewer rendered labels per client | Shared information must remain visible to its intended audience | Owner-only text lacks `VisiblePlayers` filtering |

Pool and quality changes need visual regression tests at reuse, low-quality mode and join/remove races. Keep the [client release test](../client_performance_test.md) as the measured acceptance gate.
