---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/01-balance/03-power-formulas.md"
---

# 03 — Power formulas

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

> Shared design, event-economy and burn-horizon rules remain owned by the
> [canonical references](../README.md#integration-and-applicability); this file records a worked application.

## Principle: every growth curve has a ceiling (D43)
Replace unbounded power laws with a **soft-cap**:

```
softCap(x, maxBonus, halfLife) = 1 + maxBonus · x / (x + halfLife)
```
- Level multiplier: `softCap(level−1, 4, 15)` → ×1 at Lv1, ×2.5 at Lv16, approaches ×5 and never exceeds it.
- Level-up cost: `softCap(level, 15, 20)` → approaches ×16.
- Why: income = damage, so unbounded ATK = unbounded coin; and once the ceiling is known, adding 20 more
  levels later never breaks shop prices.

## Layered multiplicative model
```
ATK  = BaseATK × RarityMult[rarity] × LevelMult(level) × StarMult(star) × BreakMore(tier) × (1 + Σ IncreasePct) 
APS  = 1000 / IntervalMs × (1 + Σ AttackSpeed%)
DPS  = ATK × APS × (1 + critChance × (critMult − 1))
```
- Stat ops follow the engine (`Flat`, `IncreasePct` additive, `MorePct` multiplicative). Decide per system
  which op it uses and keep it consistent (stars: MorePct table; break: MorePct + attack speed + crit; skills
  and passives: IncreasePct).
- Rarity ATK multipliers 1 / 1.15 / 1.35 / 1.7 / 2.2 / 2.8 — a smooth ladder; check the actual DPS jump between
  rarities (we found ×2.5 Epic→Legendary vs ×1.7–2.2 elsewhere and flagged it).
- Within a rarity, keep DPS within ±15–30% (we found ×1.87 inside Epic; flagged, not yet fixed).

## Order of power axes (D12)
Level < Break < Star. Level is cheap and frequent, break is a milestone every 10 levels, star is the rare
big jump (needs 2 copies + materials). Max star 5 for v1, data prepared to 20 for later content.

## Element identity (D93)
Element variants start with identical stats to the neutral plant, then get a flavour:
Water = attack speed +13%; Fire = ATK +15%; Nature = ATK +6% & speed +6%; Light = +12%/+12% (≈ +25% DPS);
Dark = ATK +30%, speed −4% (heavy hits, ≈ +25% DPS). Element advantage vs enemies ±25%.
Rule the designer set: element plants 10–15% stronger than neutral, Light/Dark 20–30%.

## Skills
Simple buff skills: value = `effect% × uptime`, uptime = Duration/Cooldown. Once skills have triggers and
actions (bonus hit every N hits, % current HP, slow, extra targets, armed crit), convert each to **% DPS
equivalent** with an explicit model — see [Skills, mutations, items](06_skills_mutations_items.md#action-based-skills-and-an-ev-model-d98).
Tune all families to equal EV per tier (source targets I–V ≈ 8 / 11 / 15 / 20 / 27 %) so family choice is
flavour, tier is power. Passive value = mean of [min,max], halved if it only applies to bosses.

## "Is +1 level felt?"
Check the smallest plant: ATK 20 × (LevelMult(2) − LevelMult(1)) must be ≥ 1 damage. If a step rounds to
0, the designer will ask why leveling is pointless — raise base ATK or the early slope.

## Elements/mutation/skills on the roster page
Give the designer a page where they pick Level / Star / Mutation / Skill / Crit / Element advantage and see
ATK, APS, DPS for all 72 plants at once, plus "× vs Lv1 1★" (see [Page Catalog](../03-visualization/03_page_catalog.md)).
Break is implied by level (Lv10 → break 1) — do not expose it as a separate slider; it confused the designer.
