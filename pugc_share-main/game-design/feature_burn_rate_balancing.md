---
name: craftland-feature-burn-rate-balancing
description: >
  Balancing reference for Craftland features with exhaustible content, progression, or rewards:
  before shipping, compute how much time each player cohort needs to burn
  through (exhaust) the feature's content, currency, or reward pool — and what
  state the game is in after they do. Use this whenever a feature, event, shop,
  progression track, faucet, or sink is being released or retuned, even if the
  user only asks "is this balanced?" Covers time-to-exhaust math per cohort,
  faucet throughput benchmarking against existing pipelines, permanent-vs-event
  feature rules, post-burn state audit, and the release checklist. Pairs with
  live_ops_economy_design.md §9 (Monte Carlo methodology) when per-unit
  randomness is involved.
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.2
last_updated: 2026-10-09
---

# Feature Burn-Rate Balancing

> Core question a designer must be able to answer before releasing or
> rebalancing exhaustible content, progression, or reward pools: **"How long until a player has burned through
> this — per cohort — and what happens to them after?"**
>
> If you cannot state the burn horizon as a number, the feature is not ready
> for a balance sign-off. This applies to events, permanent features, shops,
> progression tracks, and reward pools alike.

## Scope

Use this quantitative workflow for concrete balance or release decisions involving content exhaustion or economic output. For expressive tools, movement feel, social play, or other features without a meaningful completion pool, mark burn horizon not applicable and evaluate their intended experience. Do not invent a currency, grind, or completion gate to fit this framework. The recommendations below do not override approved game-specific decisions; use the [context and decision rules](../SKILL.md#context-and-decision-rules).

## 1. The Burn Horizon

**TimeToExhaust (per cohort) = TotalObtainableValue / NetEarnRate**

| Term | Definition | Common mistake |
|---|---|---|
| TotalObtainableValue | Everything the feature can give one player: full shop catalog cost, complete collection, max progression track, total unique rewards. | Counting only the "headline" item, not the full catalog. |
| NetEarnRate | Earn rate per day **minus** competing sinks pulling from the same currency, **plus** flat/free grants. | Using gross faucet rate; ignoring that the currency also feeds other systems. |
| Per cohort | Compute separately for at least casual and hardcore (see §2). | Computing one number for the "average player" — nobody is average. |

Express the answer in **days at stated session frequency**, not in raw currency.
"5,000 tokens" means nothing; "casual: 14 days, hardcore: 4 days" is a
balance statement.

## 2. Design to the Fastest Burner

The player who exhausts content first defines the feature's real lifetime —
not the median.

- Compute burn horizon at **cohort ceiling** (hardcore, max sessions, ceiling
  earn every day), not just cohort median.
- Rule of thumb: if the hardcore ceiling burn is **< 1/3 of the intended
  feature lifetime**, the feature will feel dead to your most engaged (and
  most vocal) players for the majority of its life. Either add depth for
  them or accept and state the tradeoff explicitly.
- Conversely, if the **casual median** burn exceeds the feature lifetime,
  casuals are locked out of completion — check this against your fairness
  gates (see live_ops_economy_design.md §9, fairness-gate verification).

The two failure modes bracket every release:

| Failure | Symptom | Detected by |
|---|---|---|
| Burns too fast | Hardcore done in days, content dead, currency piles up | Hardcore ceiling burn vs lifetime |
| Burns too slow | Casuals mathematically can't finish, feature feels rigged | Casual median burn vs lifetime |

## 3. Faucet Throughput Benchmarking

A new feature that grants items/currency is a new **faucet into an existing
economy**. Its throughput must be benchmarked against the pipelines players
already use — in the same unit.

Procedure:

1. Identify what the feature outputs (pets of tier X, currency Y, item Z).
2. Find the existing acquisition pipeline for the same output and compute its
   cost-per-unit or time-per-unit.
3. Compute the new feature's cost-per-unit / time-per-unit at realistic
   daily engagement.
4. Compare. A new faucet **> ~2× more efficient** than the established
   pipeline devalues that pipeline and everything players spent on it. Flag
   it; either price the new faucet up or accept the deliberate power-shift
   in writing.

> This check has caught order-of-magnitude errors (a new permanent faucet
> measured **12× more efficient** than the established pipeline for the same
> reward tier — invisible in isolation, obvious once benchmarked).

## 4. Permanent vs. Event Features — Different Burn Rules

| Rule | Event (time-limited) | Permanent |
|---|---|---|
| Pity / guarantee systems | Appropriate — bounded lifetime bounds total payout. | Evaluate long-run acquisition rate, reset conditions, reward value, and sinks. Permanent pity can fit the design; preserve approved game-specific pity rules. |
| Generosity curve | Front-loaded is fine; scarcity resets at event end. | Every rate compounds indefinitely — calibrate against yearly, not weekly, accumulation. |
| Burn horizon target | Burn ≈ event lifetime (finishing on the last days is the design). | Choose finite completion, repeatable mastery, or a long-tail chase according to the player experience. Model ongoing reward output after completion where applicable. |
| Duplicate handling | Dupes tolerable for short windows. | Dupe→byproduct conversion (fusion, dust, etc.) becomes a secondary faucet — include it in NetEarnRate. |

**Never copy an event's reward table into a permanent feature without
re-running the burn math.** The table was tuned for a bounded horizon.

## 5. Post-Burn State Audit

For each cohort, answer: *the day after they finish, what do they do?*

Checklist:

- [ ] **Currency overflow** — does the feature's currency keep flowing after
  the catalog is cleared? Where does it go? (No sink = inflation + "why am I
  still earning this" feel-bad.)
- [ ] **Dead mechanic** — does the feature's core action still have any
  reason to be performed? If not, is that acceptable for this feature class?
- [ ] **Chase tail** — is there an asymptotic goal (rare variant, leaderboard,
  cosmetic depth) that keeps the feature alive for finishers at low cost?
- [ ] **Re-engagement hook** — for events: does week 2+ add anything, or is
  it the week-1 loop repeated? (Flat event-lifetime arcs are the most common
  live-ops failure — see live_ops_economy_design.md §5.)

## 6. Release Checklist (run before any balance sign-off)

1. State **TotalObtainableValue** (full catalog, not headline item).
2. State **NetEarnRate** per cohort (casual median, hardcore ceiling), minus
   competing sinks, plus free grants.
3. Compute **burn horizon per cohort**; compare to intended feature lifetime.
   - Hardcore ceiling < 1/3 lifetime → too fast, flag.
   - Casual median > lifetime → locked out, flag.
4. **Benchmark the faucet** vs existing pipelines for the same output (§3).
   > 2× efficiency gap → flag.
5. If permanent: strip event-pattern mechanics (pity, front-loaded
   generosity) unless justified (§4).
6. Run the **post-burn audit** (§5).
7. If per-unit randomness exists (drops, weighted tables, variable
   sessions), don't trust the closed-form mean — run the Monte Carlo
   methodology in live_ops_economy_design.md §9. Closed-form estimates have
   been observed to overstate success rates by 2× on systems with pity/streak
   mechanics.
8. Write the numbers into the GDD. "Balanced" is a claim; burn horizons per
   cohort are evidence.

## 7. Rebalancing a Live Feature

When retuning something already live, two extra constraints:

- **Sunk investment** — players who paid the old rate must not be
  invalidated. Compute what an existing player spent to reach their state
  under old rates; if new rates make that state reachable at a fraction of
  the cost, you've devalued their investment. Grandfather, compensate, or
  stage the change.
- **Accumulated stockpiles** — players sitting on hoarded currency will burn
  new content at stockpile speed, not earn-rate speed. Model day-1 burn from
  the stockpile distribution (pull live data if available), not from zero.


## Related worked examples

The [Game Balance & Visualization Knowledge Pack](knowledge-pack/README.md) shows how a
player simulator, species timeline and content roadmap operationalize burn checks. Its
source-project caps, daily minutes and update cadence are examples; use this file's shared burn-horizon and post-burn workflow with the target game's approved goals.
