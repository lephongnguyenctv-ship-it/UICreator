---
title: Performance Optimization — Network
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 02 — Network Traffic and Events

| Problem | Implementation | Expected benefit | Trade-off / trap | Review signal |
|---|---|---|---|---|
| Same visual change dispatched once per player | Build shared payload once, use `BroadcastCustomEvent` once; client filters target against `GetLocalPlayer()` where needed | Less server-side iteration and serialization | Private join snapshots still need targeted delivery; every receiver must filter correctly | `GetAllPlayers()` around `DispatchEventToEntity` carrying identical content |
| Presentation fields sent repeatedly | Send stable IDs and compact authoritative numbers; derive mesh, material, rarity and localized text from client config | Fewer bytes and server lookups | Client/server config can drift; keep generated/shared data or a build check | Payload contains names, localized strings, mesh/material keys derivable from IDs |
| Default fields always serialized | Omit a field only when receiver explicitly restores the same default | Smaller payload | A missing key must not change meaning across versions | Constant/default fields in every event |
| Full visual sent for one small state change | Send delta such as `renderState`; patch cached payload and pending snapshot items | Smaller frequent events | Remove paths must clear cached state; generation/order matters | Full payload rebuilt for highlight/select state |
| Join sends one event per item | Batch snapshot items (source used 12 per event), retain generation and end marker; allow a non-batch kill switch | Lower event count at join | `List.Clone` before dispatch if producer clears/reuses a list; batch network cadence separately from render cadence | Per-item join dispatch loop; reused batch list |
| Pool reuse creates new client visual identity | Use stable pool index shared by server/client and hide inactive anchor with `SetActive(false)` | Avoid remove/create event churn | Old visual can flash on reuse; verify reset and activation ordering | New token/key every reuse, followed by remove/create |
| Cosmetic animation driven by server ticks | Send preview/result data once and animate on client | Fewer repeated broadcasts | Keep result authoritative; duplicate timing constants can drift | Repeated server visual event on a fixed interval |
| Client UI updates itself via event bus | Call the owning client method directly where the path stays on the same client; combine state-change events where semantics permit | Less dispatch overhead | Preserve listener boundaries if other consumers exist | `DispatchEventToEntity` every frame to same client |

### Example

Illustrative FC event bodies use the target project's declared `eventID` and `params`; `params[0]` carries `payload` in this example.

Before — the same public parameters are sent separately to every player:

```fcg
for target in GetAllPlayers() {
    DispatchEventToEntity(eventID, target, PlatformType.Client, params)
}
```

After — server builds `payload` once, omits the default field, then puts it in `params` and broadcasts once. Private join snapshots still use targeted delivery:

```fcg
if renderState != 0 { payload["renderState"] = renderState }
params[0] = payload
BroadcastCustomEvent(eventID, PlatformType.Client, params)
```

After — the client receiver keeps only events addressed to itself or to everyone:

```fcg
if target != nil && target != GetLocalPlayer() { return }
```

Before changing protocol, inspect all receivers, queued join items, removal paths and version compatibility. Omitted fields require matching receiver defaults.
