---
name: pvz-systems-reference
description: >
  Plants vs Zombies (Craftland farm-defense idle game, VN team) — game-specific rulings, locked decisions with
  decision IDs, key values as of 2026-10-23 and codebase traps. Use for ANY Plants vs Zombies / PvZ Craftland task
  (Boss Level pacing, seeds/shop, plant level/break/star, skills, mutations, special zombies, recycler, onboarding)
  before proposing designs; current numbers must be re-read from the project's generated facts document.
type: game-specific-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-23
---

# PvZ — systems reference

> Values below are a **dated snapshot (2026-10-23, proposal D98 on dev `6e9b7db8`)**. Before asserting a current
> value, read `GDD/design/30-balance-facts.md` in the project (see [README](README.md)).

## Pillars
| # | Pillar |
|---|---|
| P1 | The plant is the character: Level (cap 60), Break (6 tiers, every 10 levels), Star (merge, cap 5★), Mutation, 1 active + 2 passive skills, element |
| P2 | Damage and kills pay coin (kill money + 3 % of HP dealt); kills charge the boss |
| P3 | One spine: **Boss Level** gates everything (features, shop, garden slots, zombies, loot tiers) |
| P4 | Gacha seeds are the main source of plants; direct purchase ≈ 1.3× gacha expectation |
| P5 | Elements: Water ▶ Fire ▶ Nature ▶ Water, Light ⟷ Dark; ±25 % damage (MorePct); Light/Dark scarce |
| P6 | Rewards > cost; side faucets valued per hour |

## Rulings by system (decision IDs in the project log)
| System | Ruling | D# |
|---|---|---|
| Pacing targets (bot, continuous minutes) | Lv10 22–36 · Lv21 55–85 · Lv50 190–290 · Lv75 380–530 · Lv100 600–840; humans ≈ ×1.5 | D47, D54 |
| Boss | Charge by kills (8 → 130), 60 s fight, 30 s rest; HP = 5000 × 1.08^(Lv−1) × BossHPMultPct; Lv1–12 eased for humans | D33, D60, D64, D96 |
| Zombies | HP ×1.05^Lv; element zombies from Lv21/23/25 (Water/Fire/Nature), 46/50 (Light/Dark); pressure director (1–3 per wave, Rush) | D84, D93, D98 |
| Special zombies | 4 types (Gold/Material/Seed/Seed+); proposal chance 2/4/25 % per tier, weights 60/20/17/3, Seed drop = seed bag I | D98 |
| Economy | Price = minutes of income at unlock; hourly shop (5 min) + daily shop (Lv19, scarce goods); Upgrade = main sink (12 × 300 levels, Lv47) | D52, D71, D82, D83 |
| Plant cost | Level-up = 100 × rarityCost × (1+15·L/(L+20)) × 2^break; break table by tier × rarity | D57, D86, D89 |
| Stars | 1→3★ free, 3→4★+ needs Fusion Shard; new plants 70 % 1★ / 30 % 2★; merge keeps level/break | D30, D68, D74, D93b |
| Skills | 12 active families × 5 tiers (trigger × action); EV target 8/11/15/20/27 %; pools by element identity × rarity ladder; Finishing Touch disabled (removed from pools) | D95, D98 |
| Recycler | Up to 12 plants; 20 % refund of invested coin/materials; points → 6 recycle seeds greedy; no storage | D97 |
| Unlocks (selection) | Teleport shop Lv2, teleport garden Lv4, merge Lv15, daily missions Lv12, daily shop Lv19, boss selector Lv35, leaderboard Lv40, upgrade Lv47 | D76, D77, D93, D98 |
| Onboarding | 21 chained missions to ~Lv12; every "buy X" step after the level that unlocks X | D65, D93, D98 |

## Data traps (this codebase)
- Skill pool rolls ignore `IsEnabled` → remove disabled skills from `SkillPoolData`.
- `fit-boss-hp.js` rewrites Lv1–12 and erases the D96 human ease.
- Charge/HP levers live in `BossChargeProgressionData` (row = level, 1-based); the simulator reads that table.
- Spawn/special chances are `CustomConfig.fcc` constants (code change), not CSV.
- Icons resolve by `fileId`, not the stale `filePath` text.
- The designer's clone may not be pulled: use `origin/main`.

## Open (2026-10-23)
- Designer decision: late pacing Lv75–100 is 5–11 % faster than target.
- Dev: copy D98 CSVs, SPAWN-01 constants, Hunter Focus mechanic (SKILL-04), pool enable check (SKILL-05).
