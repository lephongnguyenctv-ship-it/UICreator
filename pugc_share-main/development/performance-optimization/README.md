---
doc_type: knowledge_pack_index
title: Craftland Multiplayer Performance Optimization
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
source: "Internal optimization lessons from a Craftland multiplayer map (server/client performance), 2025-12 to 2026-10"
---

# Performance Optimization — Server & Client

## Scope and use

These patterns generalize lessons from a multiplayer Craftland map. Start with the [quick checklist](01_checklist.md), inspect the affected path, then read only the relevant topic. Each guide records the problem, implementation, expected benefit, trade-off, and review signal. Treat source-specific numbers and engine behavior as examples to verify in the target project; capture before/after measurements before claiming a gain.

| Guide | Read for |
|---|---|
| [01 Checklist](01_checklist.md) | Fast audit and investigation order |
| [02 Network](02_network.md) | Broadcast, payload, delta, snapshots, stable pool IDs and client animation |
| [03 Server CPU](03_server_cpu.md) | Dirty caches, loop lifecycle, registries, precompute, join spikes, logs and flags |
| [04 Persistence](04_persistence.md) | Load/save lifecycle performance traps and database-pack ownership |
| [05 Client rendering](05_client_rendering.md) | Pooling, lazy effects, quality, frame spreading and async safety |
| [06 UI and HUD](06_ui_hud.md) | Hidden HUD, item updates, lazy/prewarm and perceptual timing |
| [07 Measurement](07_measurement.md) | Worst-case seeds, handler-driven bots, A/B flags and before/after table |
| [08 Pitfalls and opportunities](08_pitfalls.md) | Regression traps and unproven opportunities |

## Canonical boundaries

- The [database pack](../code-review/database/rule.md) owns persistence safety, quota, retry and consistency review rules. This guide links to it rather than defining a competing rule set.
- [Client release testing](../client_performance_test.md) and [server release testing](../server_performance_test.md) own devices, tooling, thresholds and release decisions. The measurement guide adds diagnosis and controlled comparisons.
- The [performance review pack](../code-review/performance/workflow.md) is read-only and reports only source-verifiable violations.
