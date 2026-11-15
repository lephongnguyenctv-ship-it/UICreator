---
doc_type: publishing_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
---

# Cohorts and Composition

## Healthy Player Mix

| Cohort | Healthy share | What it represents |
|---|---:|---|
| Core | 55–70% | Regular, retained players; the stable base. |
| New | 20–30% | Acquisition and fresh-player pipeline. |
| Revival | 10–15% | Re-engaged players; useful but should not carry the daily base. |

Read the largest cohort first. The remaining share after New and Revival should normally be Core.

## Cohort Diagnosis

- **Core share below 55%**: the game relies too much on New and Revival users. Prioritise converting players into regulars instead of merely adding acquisition.
- **New share above 30%**: verify New R2. A large influx of low-quality New users can lower Overall R2 even when product quality for existing players is unchanged.
- **Revival share above 15%**: the game is leaning on win-back to sustain daily activity. Diagnose why users leave in the first place.
- **Rising Revival share with Revival R2 below 15%**: win-back is pulling low-intent users; improve targeting and the comeback experience.
- **Falling Core share while Core R2 is stable**: this can be a composition artefact caused by growth in New or Revival, not a Core-retention failure.

## Rate Problem vs Mix Problem

When Overall R2 falls by at least 1.5 percentage points:

- If approximately **less than 45%** of the explained movement comes from mix shift, treat it as a **quality/rate problem**. Find the cohort whose R2 fell and fix that cohort.
- If **55% or more** comes from mix shift while cohort R2 is broadly stable, treat it as a **composition problem**. Balance acquisition and existing-player mix; gameplay may be stable.
- Do not use only overall R2 to assign blame. Inspect Core/New/Revival R2 and share together.

## Scale Decisions by Cohort Health

- Scale acquisition in regions where New R2 is healthy, not merely where DNU is high.
- Scale revival campaigns when Revival users are sticky and Revival R2 is healthy.
- Do not scale a weak new-user funnel: higher DNU with lower New R2 increases volume but may reduce long-term value.
- Protect Core before spending heavily on traffic when Core R2 is below 50%.



## Mix and Within-Cohort Decomposition

For compatible, disjoint Core/New/Revival cohorts with complete previous/current shares and R2:

- Let `s0/s1` be previous/current share and `r0/r1` previous/current R2, all as fractions.
- Mix contribution: `(s1 - s0) * (r1 + r0) / 2`.
- Within-cohort contribution: `(r1 - r0) * (s1 + s0) / 2`.
- Sum by cohort, convert contributions to percentage points and show the residual against observed Overall R2 change.

Do not replace missing terms with zero. Different cohort/source definitions or invalid share totals
require a coverage/compatibility warning. This is an accounting decomposition, not causal attribution.
Only expose shares/counts/weights allowed for the recipient; restricted inputs remain in the authorized backend.
Website implementation and privacy projection are covered in
[Analytics Website Builder](../../development/analytics-website-builder/README.md).
Source of this extension: the 2026-10-14 analytics-builder export, chapter 12.
