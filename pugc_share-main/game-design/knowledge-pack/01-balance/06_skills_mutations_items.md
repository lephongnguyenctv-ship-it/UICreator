---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/01-balance/06-skills-mutations-items.md"
---

# 06 — Skills, mutations, items

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

> Shared design, event-economy and burn-horizon rules remain owned by the
> [canonical references](../README.md#integration-and-applicability); this file records a worked application.

## Skills
- (D88–D95, superseded for actives by D98 below) 6 active families × 5 tiers; 11 passives. Roll weights tuned so all families have equal EV per tier
  (D88) and tier V is ~1% (designer: rare enough to sell reroll/upgrade items later).
- **Per-plant pools** (D95): when the engine supports `SkillPoolData` + `PlantData.SkillPoolId`, generate
  36 pools = 6 rarities × 6 elements by script. Weight = family share (by element) × tier ladder (by rarity):
  - Tier ladder: Common 55/30/12/2.7/0.3 → Mythic 20/28/30/18/4 (tier IV+ from 3% to 22%).
  - Family share: Water favours attack speed, Fire damage, Light crit, Dark heavy hits; Nature = all
    families evenly + ladder shifted one rarity up (variety as identity, no new skills needed).
  - Passives: 3 rarity groups × element preference ×1.5.
- Decided against "roll twice keep best" (code change) and against new skills for v1 — reuse first.
- Consumables that reroll skills may use a different pool; decide explicitly whether that matters.

## Mutations (D19)
Mutation = income multiplier (+5…+50% coin from damage) plus a small combat perk. Natural roll on growth
(85% none), vials to re-roll. Known code gap: applying a vial overwrites a better mutation — flagged as a
dev item (confirm popup).

## Consumable buffs (D91)
Split the two original buffs (fertilizer ×2 dmg 10', watering +50% speed 10') into a 7-item ladder unlocking
Lv6 → Lv60 (small fertilizer ×1.5 5', fertilizer, small watering, scope +crit, watering, crit tonic,
super fertilizer ×3), sold in hourly/daily shops and dropped by bosses at 1–3%. Rare buffs must not be
giftable (bot farms gift to mains).

## Items & packs page
Every item: effect, where it unlocks, price in minutes of income, other sources (missions, collection,
boss, packs). Every pack (bag/box) is clickable everywhere it appears (shop, missions, onboarding, boss
loot) and opens the same popup listing contents with %.

## Action-based skills and an EV model (D98)
When the engine moves from "buff for X s" skills to **trigger × action** skills, keep balancing by one number:
expected **% DPS equivalent** per skill row. Source contract (dev `14002-combat-skill-redesign`):

| Trigger | Fires when | Period P used in the model |
|---|---|---|
| OnAttack | a primary hit lands and cooldown is ready | max(CD, T) + T/2 |
| OnHitCounter | Param1 confirmed hits counted and cooldown ready (counter resets on fire) | max(Param1·T, CD + T/2) |
| OnKill | the plant lands a killing hit | max(CD, kill interval) (+T/2) |
| Periodic | every cooldown | CD |

T = attack interval of the plant. Actions → gain (fraction of DPS):

| Action | Gain per context |
|---|---|
| Bonus damage +X % on one hit | X/100 · T/P |
| % current HP (cap Y % of the hit) | min(X % · current HP, Y %) · T/P → near 0 on weak mobs, ≈ cap on bosses |
| Slow X % for D s | 0 on bosses; on waves ≈ X/(1−X) · uptime · 0.5 (zombie stays longer in range) |
| Extra targets N at Y % | min(N, targets available) · Y % · T/P (≈ 0.3 targets on bosses) |
| Stat buff (damage, speed) X % for D s | X % · min(1, D/P) |
| Pierce +X vs toughness t | mean over the spawn mix of (1 − max(0, t−X)/100)/(1 − t/100) − 1, × uptime |
| Armed guaranteed crit | (critMult − 1)(1 − critChance)/(1 + critChance(critMult − 1)) · T/P |

Evaluate four contexts — waves and bosses × fast (1 s) and slow (3 s) plants — and average. Then:
- Same EV per tier across families (source: 8 / 11 / 15 / 20 / 27 %). Judge **utility** families on their
  context (slow and chain shot on waves, % HP on bosses) instead of forcing the average.
- Expect outliers in a dev's first table: the source's "bonus hit every N hits" family was at +71 % at tier V
  (≈ 2.6× target) while pierce was useless against armour 10–15. Fix with the parameter the dev documented as
  intended (keep their hit counts, change the bonus).
- If a family cannot reach the target through config (one forced crit ≈ +0.4 hit), propose a **code change**
  (e.g. use a spare param for extra crit damage) instead of over-tuning cooldowns.

## Element identity through skill pools (D98)
Give each element 2 signature families (≈ 17–20 % of its pool), 2–3 secondary (≈ 10–15 %) and the rest low.
Keep the rarity → tier ladder unchanged. Check that the pool-weighted EV per element differs by ≤ ±12 %
(here water was strongest on waves, dark on bosses — identity, not power).

## Pool traps
- A pool roll may validate only "skill exists", not `IsEnabled`; a disabled skill left in a pool still rolls.
  Disable = **remove from every pool**.
- Pools override the skill row's own roll weight; changing `RollWeight` alone does nothing for pooled plants.
