---
name: craftland-live-ops-event-prediction
description: Detail of Craftland Live-Ops Economy Design — simulating and predicting live-ops event income per cohort before launch: pipeline, cohort-ratio calibration, closed-form failure cases, guardrails, warnings checklist and build format.
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-11-03
---

# Live-Ops Event Prediction (Simulation & Balance-Tuner Methodology)

> Detail file of [Craftland Live-Ops Economy Design](live_ops_economy_design.md) — read that file first. Content moved verbatim on
> 2026-11-03 to keep the parent short; section numbers (§) refer to the parent's numbering.

## 9. Live-Ops Event Prediction (Simulation & Balance-Tuner Methodology)

A static spreadsheet only gives you a mean. Real players don't experience the mean — they experience day-to-day variance, and a cohort gap that looks fine on average can still leave the slower cohort locked out on a run of bad-luck days. Build a Monte Carlo simulation whenever an event has per-unit randomness (drop rolls, variable session counts, weighted reward tables) that a single expected-value number would hide. This is the generic pattern behind a live-ops "balance tuner": a single-file interactive tool that predicts each cohort's income curve and checks it against your fairness targets before the event ever ships.

### Core pipeline

| Stage | What it does | Why it matters |
|---|---|---|
| Config inputs | Event timing, cohort split (e.g. casual % of players), per-unit rates, price points, and explicit fairness gates as `(cohort, target day, target %)` tuples. | Every number that affects the outcome should be an input, not a hardcoded assumption — that's what makes the tool reusable across events. |
| Derived analytical stats | Closed-form E[value/day] per cohort (§2's floor/ceiling math), shown instantly, before running anything stochastic. | A fast sanity-check number — if this looks wrong, the simulation will too, and it's cheaper to catch here. |
| Monte Carlo simulation | Simulate N players per cohort (5,000+ is a reasonable default) day by day, rolling the actual per-unit randomness (drop chance, session count, weighted reward draw) rather than applying the mean directly. | Surfaces the real distribution, not just its average — this is the entire point of simulating instead of calculating. |
| Percentile bands | P10/P50/P90 per day per cohort, plotted against the deterministic predicted line and against shop-price lines on the same chart. | If "predicted" and "simulated P50" drift apart, that's a modeling bug, not noise — catch it immediately by eye. |
| Auto price suggestion | Search downward from the highest simulated value for the price where the target % of a cohort's distribution still clears it by the target day. | Turns "what should this cost" from a guess into a number derived from the model you already built. |
| Fairness-gate verification | Compute each cohort's actual % against its target from the simulated distribution and render an explicit pass/fail verdict. | Makes "is this fair" a checkable claim instead of a vibe. |
| Rule-based warnings | A fixed checklist of known failure modes (below), re-run automatically every time the simulation updates. | Catches the same handful of mistakes every time, so you don't have to remember to look for them manually. |

### Cohort-ratio calibration — a non-obvious detail worth getting right

If two cohorts differ not only in play volume but in a secondary multiplier (e.g. one cohort's actions are worth more per action — better gear, higher-quality submissions, bigger drops), don't set the slower cohort's completion chance to a flat fraction of the faster cohort's. That only produces the intended *value* ratio if the multipliers happen to match, which defeats the point of modeling them separately in the first place. Solve backward in the metric that actually matters (the output currency), not the proxy metric (completion chance):

```
pSlow = clamp( (targetFraction × meanPFast × fastOutputRate) / slowOutputRate,  floor, 1 )
```

Then verify by checking that the *simulated output ratio* lands near the intended target fraction — not that the completion-chance ratio does. When the target is mathematically unreachable even at 100% completion (the multiplier gap is too wide), that's a real finding: raise the weaker cohort's multiplier, lower the target, or accept the shortfall explicitly rather than silently letting the math overshoot 100%.

### When closed-form lies — verified failure cases

- **Pity/streak mechanics:** a closed-form success estimate on a system with
  guaranteed-hit-within-N mechanics overstated real success ~2× (formula said
  ~50%, Monte Carlo said ~25%). Any interval-guarantee, streak, or capped
  counter mechanic → simulate, don't calculate.
- **Secondary-multiplier cohorts:** see cohort-ratio calibration above —
  flat probability fractions silently miss the target output ratio.

### Guardrails to encode as simulation inputs

- **Floor** — minimum completion chance or minimum grant per cohort per period, so nobody is mathematically locked out of high-value content (ties to §2's floor).
- **Ceiling** — cap on daily/session earn so no single lucky day trivializes the pacing.
- **Free/flat grants** — a login-independent baseline that raises the floor without touching the fill-rate gap. Track what share of a cohort's total income this represents; once it's the majority, the core earn mechanic isn't doing the work anymore and the "gap" you designed has quietly collapsed.

### Warnings checklist (encode these as automatic checks, not manual review)

| Failure mode | What it catches |
|---|---|
| Ratio drift | The simulated cohort ratio strays from the intended target fraction — usually a floor or flat grant pulling it, not the core rates. |
| Unreachable target | Even at 100% completion, the slower cohort's simulated output can't reach the target fraction — the target itself is infeasible given the multiplier gap. |
| Rarity/tier signal violated | A flat secondary bonus lets a lower rarity/tier out-earn a higher one in total value — the tier system stops signaling anything (see §6, Asymmetric Balance). |
| Data gaps | Any mechanic not specified in the design doc is modeled as an explicit flagged placeholder, never a silent guess. |
| Price/income mismatch | Median simulated income can't cover a listed price by its target day — flag this before players hit it live, not after. |
| Data pipeline integrity | Before analyzing live tracker data: check milestone counts are monotonic, rows aren't frozen mid-event, and paired columns aren't degenerate (e.g. Price == DiscountPrice everywhere = inactive column). Broken pipeline data produces confident wrong conclusions. |
| Campaign traffic skew | Scheduled UA campaign pushes flood late-join users and dilute funnel rates. Cohort by join date; never average across a campaign boundary. Campaign schedules are known in advance — design catch-up mechanics for them, don't react. |
| Population base ambiguity | Every conversion % must state its base explicitly (eligible pool vs reach vs total) and whether it's a mid-event or end-of-event snapshot. |

### When a full simulation isn't necessary

If every player experiences a fixed rate with no per-unit randomness, the closed-form calculation in §2 is enough on its own. Reach for simulation specifically when variance or a cohort/secondary-multiplier mismatch could be hiding a real problem behind a clean-looking average.

### Build format

Build this as a single-file interactive HTML artifact — sliders/inputs for every config value, live-recomputed output, a percentile chart, a day-by-day table, and the warnings panel — rather than a static spreadsheet. It's faster to explore tradeoffs and easier to hand to PM/Art for sign-off. Split inputs into two tiers: ones that change the underlying distribution (re-run the full simulation) and ones that only change what's checked against an already-simulated distribution, like prices or target days (just re-check, don't re-roll). This keeps the tool responsive while someone is actively tuning it.
