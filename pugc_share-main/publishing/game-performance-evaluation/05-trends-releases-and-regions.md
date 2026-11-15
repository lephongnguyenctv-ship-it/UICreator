---
doc_type: publishing_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
---

# Trends, Releases, and Regions

## Compare Like for Like

- Build update weeks from completed change-log release dates. If unavailable, use Thursday as the fallback update weekday.
- Compare the current N update weeks with the previous N update weeks using only matching day offsets.
- Respect recurring weekend/Sunday R2 seasonality. Do not call a normal calendar effect a release impact.
- Treat a metric as moving only when change exceeds the larger of its deadband and half of its observed volatility.

## Change-Log Effectiveness Thresholds

| Metric | Positive | Meaningful lift/drop | Strong lift / severe drop |
|---|---:|---:|---:|
| Rates | +0.1pp | 0.5pp | 2.0pp |
| Survival Time | +1 min | 2 min | 5 min |
| Match Count | +0.01 | 0.2 | 0.5 |
| DAU | +2% | 5% | 15% |

Small drops are warnings; meaningful and severe drops affect the verdict. A release is strongly positive when at least three metrics show strong positive movement; slight drops can coexist with an effective verdict.

## Region Prioritisation

A region is **big** at >= 15% of total selected DAU. Flag it when one or more apply:

- R2 is at least 2 percentage points below overall.
- Survival Time is at least 5 minutes below overall.
- Its tier is below the overall tier.
- Its share is growing while R2 is below overall: this is a high-priority *big + weak + spreading* risk.

Prioritise large, underperforming regions over small outliers. If the same issue appears across regions, frame it as a product-level problem; if only one region is weak, investigate localisation, distribution, audience, or operations first.

## WoW Interpretation

- Positive difference means current period minus previous period is positive.
- Traffic up + quality down is not automatically success; call out exposure that is growing ahead of retention or engagement.
- Traffic down + quality up can be a positive quality signal, but should be investigated for reach loss.
- Weight decisions by the magnitude of DAU/DNU/Revival7, not just percentage movement.



## Comparison Views and Coverage

The analytics website uses distinct comparison contracts; choose and name the relevant one:

| View | Comparison contract |
|---|---|
| Portfolio | Latest seven-calendar-day range versus the preceding seven days, per project. |
| Overview regional analysis | Equal-length ranges shifted by a whole number of weeks; a 30-day current window shifts 35 days to preserve weekdays. |
| Quick Analysis | Completed patch/update weeks and matching day offsets for an incomplete week; configure the fallback patch weekday (the shared reference uses Thursday). |
| Release/update detail | Exactly 7, 14 or 28 days before release versus the same number starting on release day. |
| Lightweight chart Compare | Source implementation uses preceding rows and arithmetic series means; not equivalent to weighted fixed-calendar product analysis. |

Show actual dates, source definitions and per-metric observed/expected coverage. Product-analysis
deltas require complete expected observations for that metric; partial current levels can remain
visible with coverage. Do not present sum of DAU as unique WAU, average region rates uniformly,
or aggregate daily percentiles as an exact session-distribution percentile.
Overlapping updates/hotfixes, traffic campaigns and seasonal effects are confounders, not evidence of causality.
See [chart comparison semantics](../../development/analytics-website-builder/10_chart_interactions_and_exports.md)
for a calendar-based recreation and privacy-safe exports.
Source of this extension: the 2026-10-14 analytics-builder export, chapters 08 and 12.
