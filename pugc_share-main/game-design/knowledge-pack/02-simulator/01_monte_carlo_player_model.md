---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/02-simulator/01-monte-carlo-player-model.md"
---

# 01 — Monte Carlo player model

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

`simulation-core.js` (~1,800 lines) plays N independent users for M continuous minutes using only the
config mirror + engine constants. Seeded RNG (mulberry32) so runs are reproducible.

## Inputs
- `loadData(dir)` reads every `config__*.json` the sim needs (plants, items, seeds, pools, shop, access
  gates, zombies, bosses, loot, missions, collection rewards, merge/break tiers, skills, skill pools,
  mutations, upgrades, consumables) + `game-engine-constants.json` (mirrors `CustomConfig`) +
  `balance-params.json` (designer assumptions the code does not own, e.g. star roll weights).
- Assumptions object `asm` toggles sub-models (lane model, missions, mutation, skills, wildcard) so a
  page can run "what-if" variants.

## Time loop (per user)
Event-driven, not per-tick: compute kill rate from current DPS and zombie spawn rules → time to reach the
boss charge → boss fight (60 s window, win if HP ≤ DPS×time) → cooldown → repeat. Every shop restock
(5 min) the bot spends coins. Day boundaries (30 min of play = 1 "day" for missions) grant daily/weekly
rewards.

## Spending priority (one restock)
```
buy garden column if affordable
→ buy a seed (prefer bags that can yield a NEW species, then cheapest)
→ buy fusion shard if a merge is pending
→ retry pending merges (needs 2 same-species same-star; never merge two planted plants if no bench spare)
→ break a capped plant (coin + materials)       ← before upgrades (D86)
→ level up the cheapest plant
→ buy the cheapest upgrade (sink)
→ use a shop-reset ticket if nothing new is affordable
```
The order matters: with upgrade first, plants got stuck at Lv23 while the sink ate everything.

## Combat model
Per plant: ATK (base × rarity × level × star × break × mutation × skills × upgrades), APS, crit, element
multiplier vs the zombie element distribution at this level; player weapon DPS (capped by garden DPS);
lanes unlocked vs plants placed; boss DPS vs lane DPS separately.

## Spawn director and special enemies (D98)
When spawns depend on performance (pressure meter), precompute per kill fraction f (rounded to 1/40) the
expected zombies per base interval and special-enemy chance per zombie with a small seeded loop over the meter,
cache it, and use it inside the kill-rate step (iterate once: kill fraction depends on throughput). Specials are
granted through the same reward path as missions/boss loot (pack expansion included); log counts, escapes and coin
per special type so a page can compare dev vs proposal.

## Skills
Plug the per-skill EV from a shared module (`skill-ev.js`) into the damage multiplier instead of re-deriving
uptime in the simulator, so pages and simulator never disagree.

## What it logs
Per user: level timeline, coin earned/spent per sink, action counts, species first-seen, star counts,
break log, upgrade log, material stock, mission rewards, milestone snapshots at fixed minutes.
`summarize()` aggregates medians/percentiles across users for pages.

## Rules for modelling
- Model the **code's** behaviour, not the design doc (e.g. merge resets level — until dev changed it; the
  sim had a flag per behaviour and the page showed both).
- When the sim cannot model something (buff usage, growth time, boss selector farming) say so on the
  page ("Simulator chưa mô phỏng: …").
- Keep sim constants in `game-engine-constants.json` with a `_source` note per block (decision ID + code
  path); `check-sync` compares them to the dev's `CustomConfig`.
- Speed: ~1 min for 60 users × 900 min. Reduce users for iterative fitting (40), raise for final (120).
