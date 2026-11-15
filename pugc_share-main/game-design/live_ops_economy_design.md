---
name: craftland-live-ops-economy-design
description: Deep dive for designing, balancing, and predicting the outcome of live-ops event economies on Free Fire Craftland — currency/tier layers, earn-rate calibration (floor/ceiling, F2P vs. paying time-to-goal), rotation shop design, pity/guarantee systems, drop-rate tie-in, retention loop fit, dominant-strategy and other balance-principle checks, the economy-specific stages of the concept-to-live workflow, and a Monte Carlo simulation methodology for predicting cohort income curves and verifying shop-price/unlock fairness gates before launch. Use this whenever gems, shop pricing, drop rates, pity systems, economy pacing/balance, or forecasting how casual vs. hardcore players will progress come up for a Craftland event — even if the user doesn't say "economy" or "prediction" explicitly. For general Craftland design work (platform primer, GDD writing, critique, brainstorming, design-theory lenses) see craftland_game_design.md; for concept/tag viability data see game_tag_success_analysis.md.
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.7.0
last_updated: 2026-11-03
---

# Craftland Live-Ops Economy Design

> Deep dive for the economy-design step of the general
> [Craftland Game Design Assistant](craftland_game_design.md) workflow — read
> that file first for the platform primer, workflow overview, and
> general-purpose design frameworks. This file only covers what's specific to
> **live-ops event economies** (currency/tier layers, earn rate, rotation
> shops, drop rates). Session/retention targets follow the canonical
> [Tier List Definition](../general-knowledge/tier_list_definition.md); concept
> viability is covered in
> [Game Tag Success Analysis](game_tag_success_analysis.md). For
> time-to-exhaust / burn-horizon checks on any feature release or rebalance,
> see [Feature Burn-Rate Balancing](feature_burn_rate_balancing.md).

Apply the [context and decision rules](../SKILL.md#context-and-decision-rules). These are economy design methods, not requirements to add currencies, paid acceleration, or endless progression. Use the target game's own platform and approved economy rules.

## 1. Currency & Tier Layers

Map every value layer before designing content around it:

| Layer | Definition | Design question |
|---|---|---|
| Hard currency | Diamonds — real-money-adjacent, highest friction to earn | How much of the event should be reachable without spending? |
| Event/soft currency | Gems earned via play — the primary lever to tune | What's the target time-to-goal at median session frequency? |
| Item tiers (e.g. APEX / Normal / Secret) | Rarity bands that currency and drop rates map onto | Does every tier stay viable for its cost (see §6, Asymmetric Balance)? |

Always identify what converts into what, and in which direction conversion is **irreversible**. Irreversible conversions (spend gems → get item, no refund) are where perceived fairness lives or dies.

> **Worked example:** A "Treasure Hunt" event has diamonds (hard currency, unused directly — only buys extra keys), Keys (event currency, earned by playing matches and dropped from chests), and three Chest Tiers — Bronze / Silver / Golden (rarity bands opened with Keys). The irreversible step is Key → Chest: once opened, the Key is spent with no refund, so drop-rate transparency at that exact step is where trust is won or lost.

## 2. Earn Rate Calibration

- Set an explicit **target time-to-goal** for a F2P player at median session frequency, and, if paid acceleration is part of the approved design, a separate target for paying players. Do not add paid acceleration just to satisfy this framework.
- Set a **floor** (minimum guaranteed progress per session — prevents feel-bad) and a **ceiling** (max reasonable daily earn — prevents economy flooding).
- Derive earn rate from the intended *feeling* at each stage (early = generous/hooking, mid = paced, late = aspirational), not from a spreadsheet first — start from Stage 1 of the [Concept-to-Live Workflow](craftland_game_design.md#2-concept-to-live-workflow).

> **Worked example:** F2P players average 3 sessions/day. Target: a median F2P player unlocks the first Chest Tier in 7 days. Floor = 50 Keys guaranteed per session (so a bad-luck day still nets visible progress). Ceiling = 400 Keys/day including bonuses (so no single day trivializes the week's pacing). A player buying one $5 pack should reach the same tier in ~2 days — explicit, not left to "feel about right."

## 3. Rotation Shop Design

- Rotation cadence is a **global-script** problem (see the [Platform Primer's](craftland_game_design.md#1-craftland-platform-primer) global-vs-player-script note): a timer event drives refresh, inventory state is variable-backed. Pick cadence (daily / session-based / real-time) based on what the logic layer can enforce server-side cleanly.
- Decide whether rotation includes **pity/guarantee logic**. Undisclosed pity is a trust violation, not balance (see §6, Compensating Factors) — telegraph it if used.
- Sinks must outpace or match faucets over the event's lifetime, or currency devalues and late content feels worthless.

### Permanent-feature faucet rule

Evaluate pity/guarantee systems by their long-run acquisition rate, reset conditions, reward value, and sinks. A bounded event limits total payout; a permanent system needs an explicit long-run budget. Permanent pity is a valid design option, and approved game-specific pity rules remain the baseline. Never copy an event reward table into a
permanent feature without re-running burn math (see
[`feature_burn_rate_balancing.md`](feature_burn_rate_balancing.md) §4).

## 4. Drop Rate / Spawn System Tie-In

When an event has a spawn or loot system, the spawn table **is** the economy's faucet. Tune spawn rarity weighting and gem earn rate as one pass, not two — they compound.

## 5. Retention Loop Fit

Every event economy nests inside three loop lengths (see the general [Loop Diagramming Conventions](craftland_game_design.md#6-loop-diagramming-conventions) for how to diagram these):

| Loop | Scope | Common failure |
|---|---|---|
| Session loop | What's earned/spent in one sitting | — |
| Daily loop | Missions, login streaks, rotation shop refresh | — |
| Event-lifetime loop | Launch → final tier reachable | Session loop tuned well, event-lifetime arc left flat — week-2 players have nothing left to chase. |

## 6. Applying Balance Principles to Live-Ops Economy

The general [Game Balance Principles](craftland_game_design.md#3-game-balance-principles-rollings--morris) (Rollings & Morris) apply here as:

| Principle | Applied to live-ops economy |
|---|---|
| Compensating factors | A hidden pity mechanic or undisclosed drop rate isn't balance — it's a trust-eroding trap. Telegraph pity/guarantee logic if used. |
| Impermanence | Permanent top-tier shop items compress the possibility space; time-limited/rotating items keep spend decisions live. |
| Dominant strategies | If one tier/purchase is always optimal, every other price point becomes irrelevant. Test explicitly against every price/tier in the shop. |
| Asymmetric balance | Tiers (APEX/Normal/Secret) don't need equal power — they need equivalent **viability** for their cost, not equivalent capability. |

## 7. Economy-Specific Stages of the Concept-to-Live Workflow

Elaborates Stages 2 and 5 of the general [Concept-to-Live Workflow](craftland_game_design.md#2-concept-to-live-workflow) when the concept needs an economy.

| Stage | Economy-specific detail |
|---|---|
| 2. Design Skeleton → Economy Skeleton | Sketch currencies, sinks, faucets, tiers per §1–§5. State which New/Mid/Late users each layer serves and its pros/cons. Must exist as a diagram/table before scripting. |
| 3. Platform Feasibility Check | Confirm: does persistent currency need save/load handling? Does shop rotation need a global timer script? Is drop-rate logic server-authoritative? |
| 4. Gray-Box Prototype | Smallest working loop: one currency, one sink, one faucet. |
| 5. Balance Pass → Economy Balance Pass | Apply §6 explicitly, produce the two distribution tables below, and run the §9 prediction methodology to catch cohort lockout, fastest-burner exhaustion, or infeasible price gates before launch. |
| 6. Live Monitoring | "Meaningful update" for an economy means a new tier, new mission set, or re-balanced rates — not just a minor hotfix. |

### Required distribution package

For a new economy or a material rebalance, include both outputs from
[Reward & Gift-Code Configuration §6](reward_gift_code_config.md#6-economy--distribution-review):

1. A **distribution coverage matrix** showing which channels can grant each
   reward family and whether delivery is direct, weighted, guaranteed, or paid.
2. A **quantitative faucet/sink ledger** showing segment, gate, cadence,
   quantity, probability, cap, expected value, and economy impact.

A checkmark-only matrix is useful for coverage but cannot prove balance. Use
the quantitative ledger to calculate actual injection and burn. When money is
stored as a packed Rank Value, show Rank Value, Money, Suffix, Display, and
actual magnitude using the canonical
[Money Rank Value](../general-knowledge/large_number_notation.md).

## 8. Economy Diagramming Notation

In addition to the [general loop-diagramming conventions](craftland_game_design.md#6-loop-diagramming-conventions):

- **Boxes** = currency pools or item tiers.
- **Solid arrows** = faucets (earning) and sinks (spending) — label with the triggering mechanic.
- **Dashed arrows** = conditional conversions (pity-gated, rotation-gated).
- Mark **irreversible conversions** distinctly — these are the highest trust-risk points in the economy.

## 9. Live-Ops Event Prediction (Simulation & Balance-Tuner Methodology)

Predicting event outcomes before launch: Monte Carlo cohort pipeline, cohort-ratio calibration, cases where closed-form math lies, guardrails (floor/ceiling/flat grants), an automatic warnings checklist, when a full simulation is unnecessary, and build format. → [Details](live_ops_event_prediction.md#9-live-ops-event-prediction-simulation--balance-tuner-methodology)


## Related whole-game tooling

For a simulator that plays the target game's spending/combat/progression loop and drives a
multi-page balance website, use the [Game Balance & Visualization Knowledge Pack](knowledge-pack/README.md).
Its price-band and shop examples illustrate a source project; this file continues to own
event economy calibration, cohort prediction and fairness gates.
