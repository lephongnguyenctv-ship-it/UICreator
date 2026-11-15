---
title: Performance Optimization — UI and HUD
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 06 — UI and HUD

| Problem | Implementation | Expected benefit | Trade-off / trap | Review signal |
|---|---|---|---|---|
| Hidden HUD rebuilds on every progress tick | Store dirty state while hidden; update cheap alert state; rebuild when opened or tab selected | Avoid invisible layout work | Hidden data still must be correct on reopen | Tick handler calls full `InitActivitiesHUD` despite invisible HUD |
| One item changes but whole list rebuilds | Return a changed flag/ID; refresh that widget, full rebuild only on reset | Less layout and object churn | Reset/day rollover must invalidate list | Every mission progress event rebuilds all items |
| Every tab initializes in `OnAwake` | Lazy initialize on first open; prewarm important tabs in small scheduled increments | Lower initial hitch | Prewarm only with bounded work and correct cancel/priority | Mass HUD instantiate at boot |
| Countdown updates faster than display changes | Sleep to next visible minute above 15 minutes, then update by second; use engine `Tween` for fill | Far fewer text updates | Derive remaining time from server timestamp; cancel loop/tween when hidden or mission changes | Per-frame text assignment for minute-level display |
| Tiny income event has no visible effect | Skip event/update only after proving it cannot change displayed rounded value | Fewer UI events | Comparison direction is easy to reverse; test both branches | Event emitted for unchanged formatted balance |
| Custom UI duplicates engine capability | Prefer verified built-in module where requirements permit (source moved chat to `RoomSocial.asset`) | Remove custom lifecycle/event work | Check feature parity and migration | Large custom chat/effect system mirrors engine module |

An adaptive long countdown can reduce text rebuild frequency, but the result depends on its update interval and must be measured in the target map. A display guard once used the wrong comparison direction. Test visible output, cancellation, and changed/unchanged cases.
