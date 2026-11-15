---
folder: Publishing
title: Publishing — Skills & Knowledge
domain: craftland-ugc
status: authoritative
version: 2.1.0
last_updated: 2026-10-14
---

# Publishing

Skills & knowledge related to **publishing** Craftland/UGC games — performance
analysis, regional reads, scaling/exposure decisions.

## Scope
- Reading and interpreting game/region performance metrics.
- Deciding whether a game should scale, optimize, monitor, or be deprioritized.

## What belongs here
- ✅ Performance reading, regional analysis, scaling/exposure guidance.
- ❌ Map building → see [`../development`](../development/README.md).
- ❌ Shared definitions (e.g. tier rules) → see
  [`../general-knowledge`](../general-knowledge/README.md).

## Contents

| Skill | File | Purpose |
|---|---|---|
| Release Pipeline & Decision Making | [`release_pipeline_decision_making.md`](release_pipeline_decision_making.md) | Fast-fail, performance-driven release strategy: exposure phases, R2 criteria and timing for update/scale/drop decisions, legacy strategy. |
| Game Performance Evaluation | [`game_performance_evaluation.md`](game_performance_evaluation.md) | Evaluate a game's health, quality, cohort mix, trends, and priorities: metric-reading order, tier assignment, Core/New/Revival cohort diagnosis, a priority (P0–P3) diagnosis-and-action playbook, like-for-like trend/release/region comparison, and advanced retention (R7/R14/R30, conversion, percentiles, stickiness). Detail files in [`game-performance-evaluation/`](game-performance-evaluation/). Supersedes the retired `game_performance_reader.md`. |

> **Dependency:** `game_performance_evaluation` assigns tiers using the canonical
> [Tier List Definition](../general-knowledge/tier_list_definition.md) in
> General Knowledge — it does not define tiers locally.


## Related implementation

[Analytics Website Builder](../development/analytics-website-builder/README.md) builds the internal
performance-tracking website. Its analysis guide reuses this folder's grades/cohort/release rules;
new comparison-window and mix-decomposition details are merged into the existing references.
Canonical rank eligibility remains in [Tier List Definition](../general-knowledge/tier_list_definition.md).
