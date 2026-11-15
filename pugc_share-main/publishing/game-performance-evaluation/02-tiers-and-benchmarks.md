---
doc_type: publishing_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
---

# Tiers and Benchmarks

## Canonical Game Tier

> **Tier assignment is defined centrally.** This file does **not** redefine
> tiers. Use the canonical rank table (T0–T4, with Min/Max R2 range, Min
> Survival Time, and the Min DAU gate) in
> [`../../general-knowledge/tier_list_definition.md`](../../general-knowledge/tier_list_definition.md)
> and its **Recommended Action by Rank** table.
>
> Apply the canonical DAU gate, R2 range and Survival Time conditions together.
> A minimum-threshold top-down quality classifier is not automatically equivalent
> when survival conflicts with the R2 band or the DAU gate is omitted. Label such
> website screens explicitly; Match Count remains a diagnostic (see file 04).

## Headline Quality Bands

### Overall Survival Time for long-term games

| Value | Read |
|---:|---|
| >= 40 min | Good target. |
| 30–39.9 min | OK, but still improvable. |
| 20–29.9 min | Acceptable, not yet good. |
| < 20 min | Weak; investigate session depth, pacing, and early exits. |

### Average Match Count

| Value | Read |
|---:|---|
| >= 4 | Excellent replay behaviour. |
| 3–3.99 | Good replay loop. |
| 2–2.99 | OK/fair but needs improvement. |
| < 2 | Weak replay motivation. |

### Cohort R2

| Cohort | Excellent | Good | Acceptable | Poor / action threshold |
|---|---:|---:|---:|---:|
| Core | — | >= 60% | 50–59.9% needs work | < 50% is a product priority. |
| New | >= 20% | 15–19.9% | 10–14.9% | < 10%: onboarding/first-session problem. |
| Revival | >= 20% | 15–19.9% | 10–14.9% | < 10% poor; < 15% while Revival share rises is a warning. |

## Reaching Tier 1

The practical Tier 1 target is **Overall R2 >= 40% and Survival Time >= 20 minutes**. A credible path usually requires:

1. Protect or repair Core R2 toward 60%+; Core is the largest and highest-leverage cohort.
2. Lift New R2 toward 15–20% through a better tutorial, first session, and day-1 reason to return.
3. Lift Revival R2 toward 15–25% through better targeting and a stronger comeback experience.
4. Maintain a healthy mix: Core 55–70%, New 20–30%, Revival 10–15%.
5. Improve session depth and replay simultaneously; a retention target without a sustainable game loop is fragile.
