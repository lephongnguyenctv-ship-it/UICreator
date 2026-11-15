---
name: craftland-game-performance-evaluation
description: Evaluate a Craftland/PUGC game's health, quality, player-cohort mix, trends, and priorities using the current rule-based performance framework. Covers the metric-reading order, canonical tier assignment (cites general-knowledge/tier_list_definition.md), Core/New/Revival cohort diagnosis, a priority-ranked (P0–P3) diagnosis-and-action playbook, like-for-like trend/release/region comparison, advanced retention (R7/R14/R30, conversion, percentiles, completion, stickiness), and a required analysis-and-output protocol. Use when analyzing one game, a set of regions, a time trend, or the impact of a release. Supersedes the older game_performance_reader.md.
type: publishing-knowledge
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-10-14
source: "pugc_tracking/config/skills/game-performance-evaluation (external system, adapted)"
---

# Craftland Game Performance Evaluation

> Assess one game, a set of regions, a time trend, or the impact of a release.
> Write in concise, evidence-based English. Rates are decimal inputs unless
> already displayed as percentages: `0.40 = 40%`. Survival Time is measured in
> minutes.
>
> **Supersedes** this knowledge base's earlier `game_performance_reader.md`
> skill (retired) — that file's region-reading logic is now covered here with
> a much deeper framework (cohorts, priority playbook, trend/release
> comparison, advanced retention).

## Detail Files

| # | File | Covers |
|---|---|---|
| 1 | [`game-performance-evaluation/01-metric-framework.md`](game-performance-evaluation/01-metric-framework.md) | Reading order, source-defined metric meaning and links to weighted calculation, zero/missing/pending and availability implementation. |
| 2 | [`game-performance-evaluation/02-tiers-and-benchmarks.md`](game-performance-evaluation/02-tiers-and-benchmarks.md) | Canonical DAU/range/survival eligibility, distinction from website quality screens, shared Survival Time / Match Count / Cohort R2 bands and the practical path to T1. |
| 3 | [`game-performance-evaluation/03-cohorts-and-composition.md`](game-performance-evaluation/03-cohorts-and-composition.md) | Core/New/Revival mix and diagnosis, rate-vs-mix decomposition with residual/coverage checks, and scale decisions by cohort health. |
| 4 | [`game-performance-evaluation/04-diagnosis-and-action-playbook.md`](game-performance-evaluation/04-diagnosis-and-action-playbook.md) | Priority rules (P0–P3), metric-combination reads (High/Low Survival Time × R2 × Match Count), and required action-quality elements. |
| 5 | [`game-performance-evaluation/05-trends-releases-and-regions.md`](game-performance-evaluation/05-trends-releases-and-regions.md) | Like-for-like comparisons, Portfolio/Overview/Quick Analysis/release window contracts, per-metric coverage, change thresholds and region prioritisation. |
| 6 | [`game-performance-evaluation/06-advanced-retention-and-engagement.md`](game-performance-evaluation/06-advanced-retention-and-engagement.md) | R2→R7→R14→R30 decay curve, retention vs. conversion, Survival-Time distribution (P30/P50/P70) and completion rate, stickiness/activeness. |
| 7 | [`game-performance-evaluation/07-analysis-protocol.md`](game-performance-evaluation/07-analysis-protocol.md) | Required reasoning sequence, output requirements, the compact output template, and source basis. |

## Canonical Rules

- **Tier is defined centrally** in
  [`../general-knowledge/tier_list_definition.md`](../general-knowledge/tier_list_definition.md)
  — do not redefine it here or elsewhere. Tier is determined **only** by
  Overall R2 and Average Survival Time under the canonical DAU gate; Match Count is a quality diagnostic,
  not a tier input.
- Do not rely on absolute user volume alone. Use DAU/DNU/Revival volume to
  size the opportunity, but judge product quality with retention, Survival
  Time, Match Count, cohort quality, and composition.
- Prioritise a large weak region over a small weak region. A region with at
  least 15% of DAU that is below overall R2 by 2pp or Survival Time by 5
  minutes needs attention.
- Separate a retention-rate problem from a player-mix problem before
  recommending product changes (file 3).
- For time comparisons, use aligned update weeks and matching weekdays. Do
  not call normal weekend/Sunday seasonality a product change (file 5).

## Dependency Note

This skill's detailed thresholds were extracted from the `pugc_tracking`
system's `config/skills/analysis_rules.json`, which is **external to this
repository**. All values needed for analysis are inlined in files 1–7 and
cross-checked against this repo's own
[`tier_list_definition.md`](../general-knowledge/tier_list_definition.md). If
the live `pugc_tracking` rule engine changes its thresholds, flag the drift
here rather than silently trusting either source.

## Related

- Canonical tier ranks & recommended action → [`../general-knowledge/tier_list_definition.md`](../general-knowledge/tier_list_definition.md)
- Release/scale/drop decision timeline → [`release_pipeline_decision_making.md`](release_pipeline_decision_making.md)


## Website Implementation

[Analytics Website Builder](../development/analytics-website-builder/README.md) implements authenticated
Sheets dashboards, privacy-safe outputs, maturity/coverage, charts, release views and optional analyst prompts.
Shared grade bands/diagnosis stay in this publishing module and ranks stay in the canonical Tier List.
The imported website's no-DAU quality classifier must not silently replace official rank eligibility.
