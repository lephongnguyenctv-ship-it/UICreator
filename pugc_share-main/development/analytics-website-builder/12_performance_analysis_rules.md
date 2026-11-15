---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/12-performance-analysis-rules.md"
---

# Performance Analysis Rules

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Metrics](08_metrics_and_availability.md)

## Evidence hierarchy

Use the approved deterministic config for the target product, and resolve shared Craftland definitions through the canonical owners below. These are owner-supplied heuristics for this class of game, not universal industry benchmarks. Grade only eligible metrics with adequate samples and coverage; show unknown/pending instead of a false neutral success.

Read Overall/Core/New/Revival R2, survival and match count together. Population/mix gives context only where count permission allows it. Prioritize the largest affected cohort/region internally while ensuring restricted outputs do not expose hidden weights.

## Tier classification

Use the [canonical Tier List Definition](../../general-knowledge/tier_list_definition.md)
for official Craftland ranks, including its Overall R2 range, minimum survival and DAU gate.
Match count remains a diagnostic, not a tier input. Do not reproduce the rank table in app guides.

The exported website classifier checks minimum R2/survival thresholds top-to-bottom and does not
apply the canonical DAU gate. It can also fall back differently when a higher R2 band lacks its
required survival. This is a **reference quality-screen policy**, not proof of an official rank.
When recreating it, align the configured engine with the approved canonical policy or explicitly
label its provisional quality screen. Do not silently remove the DAU gate or assume the algorithms
are equivalent. Required population checks belong on the server even when counts are hidden;
unavailable evidence must produce an eligible/unknown state, not an invented rank.

Near Tier 1 is a configurable shortlist, not an extra tier. Derive its tolerances from the canonical
target and the approved product config. The exported website used tolerances of 5pp in R2 and
2 minutes of survival; these are reference shortlist settings, not new rank thresholds.
Crossing a threshold does not guarantee business success.

## Current absolute grade bands

Shared survival/match/cohort R2 bands live in
[Tiers and Benchmarks](../../publishing/game-performance-evaluation/02-tiers-and-benchmarks.md).
Use those values rather than maintaining a second table here. Grade only mature, covered observations;
zero is a real value, while missing/pending observations remain unavailable.

The reference website's sample gates are separate from official tier eligibility:
total/Core/engagement context roughly Avg DAU 1,000, New grading 100, Revival 50.
These are configurable evidence gates, not significance tests or permission to expose hidden counts.

## Healthy composition and diagnosis

Use [Cohorts and Composition](../../publishing/game-performance-evaluation/03-cohorts-and-composition.md)
and the [Diagnosis and Action Playbook](../../publishing/game-performance-evaluation/04-diagnosis-and-action-playbook.md)
for shared mix/quality interpretation. Region thresholds and prioritization belong in
[Trends, Releases, and Regions](../../publishing/game-performance-evaluation/05-trends-releases-and-regions.md).

Apply those findings only to authorized observations. A restricted website output must omit DAU,
hidden size-based sorting and population weights; use a permitted display order instead.
The backend can compute authorized evidence without exposing private inputs in JSON/prompts/exports.

## Comparisons are not all the same

The source website's Portfolio/Overview/Quick Analysis/release windows are now documented in
[Comparison Views and Coverage](../../publishing/game-performance-evaluation/05-trends-releases-and-regions.md#comparison-views-and-coverage).
Implement and label the selected view's actual dates, weights and per-metric coverage.
The lightweight chart Compare remains distinct; see [chart interactions](10_chart_interactions_and_exports.md).

## Overall R2 explanation

Use the shared [Mix and Within-Cohort Decomposition](../../publishing/game-performance-evaluation/03-cohorts-and-composition.md#mix-and-within-cohort-decomposition)
for the formula, required evidence, percentage-point output and residual checks.
Present permitted cohort observations first and put formula details behind expansion.
This is an accounting estimate, not causal attribution.

## Update-change thresholds

The shared [Change-Log Effectiveness Thresholds](../../publishing/game-performance-evaluation/05-trends-releases-and-regions.md#change-log-effectiveness-thresholds)
own minimum/meaningful/strong movements; do not copy the table into the website guide.
General trend deadbands are separate source-product settings: rate 0.8pp, count 5%, survival 0.5m,
decimal 0.1, with volatility adjustment where the configured engine uses it.
Keep these settings configurable and explicitly sourced rather than changing the shared definitions.

Small increases/decreases can use muted green/red; meaningful movement uses stronger colors.
Gray means unchanged/unavailable, not every small change.

## Release detail UX

Use a global 7/14/28-day comparison selector and an Analyze update action with independent horizon. Three dark Core/New/Revival cards show before → after and R2/survival/match delta. Repeat coverage only for missing comparisons, not identical 14/14 labels on every complete metric.

Keep optional sustained-lift/decay patterns and overlapping-release warnings in detail. Do not restore the retired release-goal feature or arbitrary three-day weekly comparisons. Recommendations must name evidence, suspected mechanism and next validation step.
