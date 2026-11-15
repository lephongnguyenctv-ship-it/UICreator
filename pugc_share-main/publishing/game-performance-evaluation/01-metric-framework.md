---
doc_type: publishing_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
---

# Metric Framework

## Read Metrics in This Order

1. **Overall R2 and Average Survival Time**: assign the product-health tier.
2. **Match Count**: determine whether the replay loop is strong enough.
3. **Core / New / Revival R2 and Survival Time**: locate the weak player cohort.
4. **Core / New / Revival share**: determine whether the overall result is being distorted by composition.
5. **DAU, DNU, Revival7, WAU, and MAU**: size the impact and distinguish scale from quality.
6. **R7/R14/R30, conversion, completion, percentiles, and stickiness**: diagnose durability and the exact gameplay or funnel issue.

## Metric Meaning

| Metric | What it measures | How to use it |
|---|---|---|
| R2 | Day-2 return rate | Primary short-term retention and product-quality signal. |
| R7/R14/R30 | Longer-term return | Read as a retention decay curve; identify the steepest drop. |
| Survival Time | Session depth in minutes | Indicates how deeply players engage in a session. |
| Match Count | Matches per user | Indicates replay motivation and loop strength. |
| DAU/DNU/Revival7 | Population volume | Sizes business impact; does not prove quality by itself. |
| Core/New/Revival shares | Player mix | Explains whether overall R2 moved because quality changed or because audience composition changed. |
| C2/C7/C14/C30 | Source-defined conversion/success over time | Verify the event, population and horizon; do not assume monetisation from the C label alone. |
| P30/P50/P70 Survival Time | Depth distribution | Detects early quits and whether only a long tail is engaged. |
| Completion Rate | Intended-loop completion | Detects failure, pacing, or objective-design friction. |
| 7D/14D/30D Activeness | Active days in each period | Indicates habit and stickiness; convert rate × window length to active days when presenting it. |

## Data Discipline

- Use population-weighted aggregates where available.
- State missing data rather than guessing.
- Use raw numeric values for comparison and formatted values for prose.
- Filter immature retention dates: the dashboard uses a three-day reporting lag and maturity checks.
- Do not infer quality from a graph's visual position; use its underlying values.



## Website Calculation and Availability

For formulas, weighted/residual Core calculations, source units, zero/missing/pending states,
per-metric observation horizons and coverage, use
[Metrics and Availability](../../development/analytics-website-builder/08_metrics_and_availability.md).
Reporting lag and maturity depend on the source's date basis; eligibility does not prove the upstream
observation has actually arrived. Keep valid zero values and mature metrics on partially pending dates.
