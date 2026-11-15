---
title: Performance Optimization — Measurement and Stress
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-18
---

# 07 — Measure and Stress Test

## Reproducible scenario

1. Record the symptom and a baseline on the same device/build/room/player count. For client, use PerfDog and the [client test](../client_performance_test.md); for server release validity and thresholds, use the [server test](../server_performance_test.md).
2. Seed a worst-case account only after database load completes. A source fixture filled all available slots with high-effect objects and enabled progression effects; its world variant filled bases across frames. Keep fixture values and activation behind a disabled-by-default production flag; avoid hard-coded test state in release paths.
3. For server logic, rotate deterministic bot actions over ready players and call real request handlers, rather than a mock bypassing validation. A fixed action cadence can reveal leaks; it does not establish peak throughput.
4. Change one mechanism at a time. Use a runtime flag for A/B effect or feature modes where possible. Run both modes under comparable state and record regressions or visual differences.
5. Remove or disable test seeding before release and rerun the official pre-release tests.

## Before/after record

| Build/flag | Device or GS version | Players and worst-case state | Duration | Client FPS/Jank/Stutter/Memory or server CPU/traffic | Observation |
|---|---|---|---|---|---|
Add a row for each actual run in the target project's test record, with its report link. Compare baseline and candidate under the same conditions; do not put guessed gains in a review finding. The source lessons contain mechanisms and regression traps, but no comparable before/after PerfDog figures.
