---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/08-metrics-and-availability.md"
---

# Metrics and Availability

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Performance interpretation](12_performance_analysis_rules.md)

## Units and definitions

Shared performance meaning/reading order lives in [Metric Framework](../../publishing/game-performance-evaluation/01-metric-framework.md).
This guide owns calculation and availability implementation, not a second tier/grade system.

Retain full-precision numeric values for computation. Format only at the output boundary:

- Rates are fractions internally: `0.25` means 25%.
- Rate differences are percentage points: 25% to 27% is **+2pp**, not +2%.
- Relative count change is `(current - previous) / previous`; undefined when previous is zero.
- Survival/playtime must have a verified source unit; convert seconds to minutes exactly once.
- Average match count is decimal, not an integer count of all matches.
- DAU labels use rounded integers, including displayed before/after values and absolute changes.
- Avg DAU over a period is a mean of daily populations, not unique users during that period.

R2 denotes the reference product's day-2 return metric. Confirm R-series and C-series definitions against the source; a C metric must not automatically be interpreted as revenue conversion.

## Configurable calculation types

| Type | Meaning |
| --- | --- |
| `peak` | Maximum observed value |
| `avg` | Arithmetic mean of observed values |
| `sum` | Sum of observed values |
| `weighted_avg` | Sum(value × weight) / sum(weight) |
| `sum_ratio` | Sum(numerator) / (sum(numerator) + sum(other term)) |
| `ratio` | Configured numerator aggregate / denominator aggregate |
| `residual_ratio` | (Denominator − sum(parts)) / denominator |
| `linear` | Signed/coefficient-weighted sum of configured aggregate terms |
| `weighted_ratio` | Signed weighted numerators divided by signed aggregate denominator terms |

Transforms apply after aggregation. A divide-by-60 survival transform is inappropriate if the source is already in minutes. A multiply-by-horizon activeness transform changes the unit and axis label.

## Weighting and derived Core

Use DAU weights for overall quality metrics and the appropriate cohort population for Core/New/Revival rates, survival and matches. Never average region percentages uniformly if the product contract requires population weighting.

Where direct Core values are unavailable and the source cohorts are compatible/disjoint:

`Core population = DAU - New population - Revival population`.

`Core metric = (DAU × Overall metric - New × New metric - Revival × Revival metric) / Core population`.

Require every necessary term and a valid denominator. Do not substitute missing cohort values with zero or force invalid residuals into plausible positive values. Prefer direct cohort fields where available.

Weighted aggregation should use only observations with a valid value and eligible weight under the defined policy. Arithmetic fallback when population weights are unavailable must be explicit and visible, not silent equivalence to weighted data.

## Totals and temporal summaries

Region totals sum appropriate population measures and weight quality measures. Explicit total-row configuration overrides auto-derived recipes. Never sum rates. The reference auto-total fallback can sum unconfigured non-percent fields; define totals explicitly for averages/percentiles rather than assuming this default is analytically correct.

Weekly/monthly measures are not interchangeable: Peak WAU differs from Avg DAU; sum of DAU is not WAU. Do not average daily percentiles and label the result the exact percentile of all sessions. Show observed/expected dates for partial periods.

## Reporting lag and maturity

The reference applies a general reporting cutoff (default three days), then metric-level observation windows. With `date_basis: cohort_start`, Rn/Cn typically requires `n - 1` elapsed days plus configured reporting delay. With report-date sources the base horizon differs. Explicit metric offsets override derived horizons.

The current implementation masks R2/R7/R14/R30/C2/C7; extend and verify coverage before assuming every C14/C30 field follows the same masking.

Keep three states:

1. **Zero**: an observed numeric value, eligible for a real poor grade/delta.
2. **Missing**: no observation; show a gap/unavailable.
3. **Pending**: observation horizon has not matured; mask that metric only.

Do not drop an entire date because retention is 0% or below an arbitrary small threshold. Preserve mature metrics on the same date. Apply availability without mutating raw cached rows. Elapsed time proves eligibility, not upstream completion.

## Activeness display

For Top 30, middle P30–P70 and Bottom 30 survival cohorts, display expected active days over 7D/14D/30D: `fraction × horizon`. Example: 50% of 30D = **15.0 days**. Format one decimal; use Active days axes/tooltip/export units, not `%`. Keep original normalized rate data available to the calculation layer if required.
