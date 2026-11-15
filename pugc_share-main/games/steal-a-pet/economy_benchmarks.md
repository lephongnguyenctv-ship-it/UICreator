---
name: sap-economy-benchmarks
description: >
  Steal A Pet — game-specific economy numbers derived from live event data
  (Kick A Ball, Steal A Ball, Meteor) and system calibrations. Use when
  pricing shop items, setting milestones, tuning drop weights, or adding a
  faucet/sink in SAP. Generic methodology lives in
  game-design/live_ops_economy_design.md and
  game-design/feature_burn_rate_balancing.md — this file is the SAP-tuned
  numbers to plug into those methods.
type: game-specific-knowledge
domain: craftland-ugc
game: steal-a-pet
status: authoritative
version: 1.0.0
last_updated: 2026-08-07
---

# Steal A Pet — Economy Benchmarks

## 1. Currency Map

| Currency | Class | Primary faucets | Primary sinks |
|---|---|---|---|
| In-game money | Idle/soft | Pet passive income | LvUp, MutaGen/Charm cost share, recovery |
| Pet Coin (PC) | Semi-premium | Events, milestones | Steal 2.0 door costs, shop |
| Craftland Tokens | Platform | Platform-level | Platform shop |
| Dust | Byproduct | Fusion, Dust Hunt, Storm Aura | MutaGen loops, recovery, event sinks |
| Magic Stones | Boss chest | Dust Hunt chests | Copycat odds |
| Event gems/tokens | Per-event | Event play + 10/day free | Event shop |

Every new feature must declare which of these it touches and whether it
inflates or deflates that layer.

## 2. Event Economy Rules (derived from Kick A Ball / Steal A Ball / Meteor)

| Rule | Value | Source |
|---|---|---|
| Free-grant coverage of top price | ≤ ~15% of top item price over event lifetime | Kick A Ball ratio — healthiest funnel of the three events |
| Top item price position | ~5% reach point of the earn distribution, below the top milestone | Log-linear interpolation on live funnels |
| Milestone spacing template | 50 / 100 / 200 / 500 / 1000 / 2000 (doubling) | Kick A Ball |
| Known funnel cliff | 200→500 gem step — only sub-50% retention step observed | Kick A Ball funnel |
| Stable attach-rate price point | ExclusiveItem tier: 14–17% attach, most regionally stable | Cross-event comparison |
| Limited item purchase cap | 1/user (assume unless stated) | Confirmed live convention |
| Low engagement diagnosis | Check participation/onboarding before touching pricing | Steal A Ball post-mortem |
| Campaign traffic | Late campaign pushes are scheduled — cohort by join date, add catch-up mechanics, don't average | Kick A Ball 400K→5M influx |

## 3. Drop / Pool Rules

- Top-band (Mythic-equivalent) share of a spawn/gacha pool: **≤ ~2%** (house
  rule; fishing pool compressed to 2.54% to comply).
- Secret pets: suppressed weights within their rarity band, always.
- Single-pet rarity bands at high pool share = inventory flood risk (ORCA
  case, ~8–9% share) — split the band or cap the share.
- New-patch chase pets sit at the bottom of their band's weights.

## 4. Faucet Benchmarks

Reference pipeline for benchmarking any new pet faucet: **the Pet Coin →
Mythic acquisition pipeline.** Compute the new faucet's effective cost/time
per Mythic-equivalent and compare (see feature_burn_rate_balancing.md §3).
Calibration precedent: unpriced fishing at ~12 casts/day measured **12×**
more efficient than the PC pipeline pre-rebalance — the fix was pool
compression + removing pity, not nerfing the PC pipeline.

## 5. Balance Tool Standards

- Deliverable format: single-file HTML calculator (vanilla JS + Chart.js),
  every config value an input, Monte Carlo where per-unit randomness exists,
  fairness-gate PASS/FAIL panel, warnings checklist, data-gaps panel for
  unspecced mechanics.
- Casual/hardcore default split: 65%/35%. Casual target = fraction of
  hardcore **token output** (solve backward), not completion probability.
- Standard fairness gate: casual completion of top item inside event window
  (or explicitly just outside, stated — e.g. casual 3-slot at 14.7 days on a
  14-day event, accepted in writing).
