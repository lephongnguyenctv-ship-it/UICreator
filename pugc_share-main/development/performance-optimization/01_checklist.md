---
title: Performance Optimization — Quick Checklist
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 01 — Quick Checklist

For each suspected hot path, record its call frequency, player/entity count, payload size, and measured client/server symptom before editing.

- [ ] Build shared payload once and broadcast once; retain targeted delivery for private join data.
- [ ] Send authoritative IDs/numbers; omit default fields only when receiver defaults match.
- [ ] Use delta events for small changes and batch join snapshots; keep generation/end handling.
- [ ] Pool frequent spawn/despawn objects and give shared server/client instances stable IDs.
- [ ] Cache expensive aggregates; invalidate only for fields that affect the result.
- [ ] Tie loops and coroutines to owner lifecycle, with cancellation checks after waits.
- [ ] Gate hidden HUD work to dirty state and refresh the affected item when visible.
- [ ] Lazy-create visual effects by quality, spread creation over frames, and guard async reuse.
- [ ] Save only after successful load; use the [database rules](../code-review/database/rule.md) for correctness.
- [ ] Gate hot-path logs and test-only stress features with flags.
- [ ] Reproduce worst-case load and record before/after numbers with the same build, device, room, and scenario.

The first nine checks are implementation patterns, not automatic findings. A code review must show the concrete repeated work and a safe alternative; performance magnitude requires measurement.
