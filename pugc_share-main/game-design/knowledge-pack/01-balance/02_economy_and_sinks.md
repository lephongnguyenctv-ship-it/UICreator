---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/01-balance/02-economy-and-sinks.md"
---

# 02 — Economy & sinks

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

> Shared design, event-economy and burn-horizon rules remain owned by the
> [canonical references](../README.md#integration-and-applicability); this file records a worked application.

## Income model
Coin comes from damage dealt and kills (D1/D7): `money = dmg × rate (capped by remaining HP) + kill bonus`,
scaled per boss level, plus boss rewards by tier. Consequences:
- Income grows with DPS → any power inflation is also coin inflation. Power curves need ceilings (see
  `03_power_formulas.md`).
- "Mutation" (a per-plant income multiplier) is the dedicated **income axis**; power axes (level/star/break)
  should not also multiply money.

## Price = minutes of income
Every shop price is defined as **minutes of income at the level the item unlocks** (`price-bands.json`):
gacha bags 1–8 min, fixed plants 3–30 min by rarity, buffs ~4, mutation vials 5/15, skill items 10/30,
boss ticket 3, catalysts 5× the plant. A script (`apply-price-bands.js`) multiplies by the simulator's
coin/min at that level and rounds. Two refinements:
- **Direct-buy plant price** = (cheapest gacha bag containing it ÷ probability of that plant) × 1.3, so
  certainty costs ~30% more than gambling (D62).
- **Hysteresis**: keep the old price if the new one differs < 10% (simulator noise is 1–3%) (D63).
- Prices and pacing depend on each other → run `pacing → price → pacing → price` (two rounds) each rebuild.

## Daily shop vs hourly shop (D53/D71)
Hourly rotation = everything cheap and plentiful. Daily rotation (resets 24 h) = scarce things (rare seeds,
catalysts, rare buffs) with stock 1–3 so a 24 h grinder cannot vacuum the economy. Control rarity with
**weight AND price**, not by removing items (removing kills motivation — designer's call, D92).

## Sinks that never run dry
Problem: at high level income is exponential and a soft-capped level-up cost became ~free. Fixes:
- **Upgrade system** as the main sink (D82/D83): 12 branches × 300 levels, exponential cost tuned so a
  hardcore player cannot max in 6 months, each level +0.2–0.4% (small but felt), unlock at Lv47 (after the
  player has felt the plant-level power jump).
- **Level-up cost × 2^breakTier** (D89): keeps leveling expensive late.
- **Break cost table** (D86): first break coin-only (so players learn it), later breaks need elemental
  materials with a steeply rising count; rarity multiplies material cost.
- Check per rebuild: spend split (upgrade / seeds / level / break) and **coin held at end ≤ ~0.3 min of
  income** (no hoarding = no inflation).

## Reward vs cost rule
Any mission/collection reward must exceed what the player spent to earn it, and seed rewards should give
*different* species than the ones the player already farms. Collection rewards scale smoothly with rarity
(D85) — avoid a tier that pays less than the previous one.

## What to watch on the simulator page
- coin/min by level (monotonic, Lv50/Lv21 ratio in range);
- coin held / coin earned at end (≤ 2–3%);
- spending split;
- the "wall": first level where boss win rate < 85%.

## Value every reward per hour before shipping it (D98)
A reward that looks small per drop can dominate the economy through frequency. Before adding any drop source:
1. Convert the reward to **coin-equivalent**: shop price for items/seeds, "cheapest way to obtain" for plants
   (min of direct price and gacha cost ÷ probability), expected value for packs (Σ weight × value × qty).
2. Multiply by **drops per hour** at representative levels (early / mid / late), using the simulator's kill rate.
3. Compare with the player's **coin income per hour** at the same levels.
Rule of thumb used in the source project: a side faucet (elite/special enemies, idle gifts) should add
**≲ 10–20 %** of income-equivalent, front-loaded is fine, and must never contain the top rarities at a
per-minute rate. Worked example: the dev's first special-zombie table dropped a "random seed of any rarity" pack
worth ≈ 410k coin on average roughly every 2 minutes — ≈ 13× normal income at mid game. Replaced with a cheap
common seed bag, a coin bonus scaled by kill money (×5, floored), materials, and a 3 % jackpot plant box;
spawn chances cut 5/10/100 % → 2/4/25 % per wave tier. Result ≈ 3 % of coin plus a few items per hour.

## Converters (recycler) — design rules (D97)
A converter turns unwanted items into resources. It must never become a profit loop.
- Refund a fixed share (20 %) of what was *invested* (level-up and break costs, materials), never of the purchase price.
- Convert the item into points (rarity × 2^(star−1) × element factor) and exchange points **greedily from the highest
  unlocked tier down**, so big inputs give few valuable outputs instead of hundreds of junk items.
- Leftover points below the cheapest tier → one random roll with chance = leftover ÷ price (the expected value equals
  carrying the points over), so **no per-player storage is needed** and splitting batches gains nothing.
- Exploit test: buy the cheapest source of points in the shop and recycle it immediately; the return must stay well
  below 100 % (source: ≤ 44 % worst case, ≤ 24 % typical).
- Output pools exclude the scarce tier (Light/Dark here) so the converter does not bypass scarcity.
