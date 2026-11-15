---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/06-reference/02-decision-log-digest.md"
---

# Decision log digest (D1–D98)

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

Full text with numbers: `design/00-decisions.md`. Grouped by theme; the principle is what transfers.

## Progression spine & pacing
- D13/D18/D28 — one axis only (Boss Level); drop the second axis entirely, including its name.
- D15/D17/D47 — v1 wall at a fixed level (50 → later 100); unlock density high early, none late.
- D27/D47 — boss charge ramps 8→25 kills then flat; v1 trusts a level cap, not longer charges.
- D33/D64 — boss fight window 60 s, 30 s rest; fix off-by-one in level-indexed tables (row t = level t).
- D44/D45/D47 — pacing v3/v5: weapons from the start, first gun at ~10 min, ≤ 1 unlock per level early.
- D75/D76/D77 — learning/excitement curve scoring; spread heavy mechanics; day-1 return hooks (missions Lv12, teleport Lv8).
- D96 — early-game HP ease for human newcomers.

## Economy
- D1/D7 — money from damage (capped by remaining HP) + kills; D19 mutation = income axis.
- D42/D56/D84 — dev warnings on inflation; zombie HP 5%/level (not 10%) given capped plant power.
- D50/D51/D52/D62/D63 — shop opens gradually from Lv3; ≤ 2 items/level; price = minutes of income;
  direct-buy = 1.3× gacha expectation; hysteresis 10%.
- D53/D58/D71 — daily shop for scarce goods (stock caps), boss tickets moved there; clear hourly vs daily rule.
- D82/D83/D89 — Upgrade = main sink, exponential, 300 levels/branch, tiny per-level effect, not maxable in 6 months; level-up cost × 2^break.
- D92 (R5) — control Light/Dark scarcity by weight + price, not removal.

## Power formulas
- D12 — Level < Break < Star.
- D43 — soft-caps with ceilings replace unbounded curves (also for cost).
- D16/D74 — v1 caps: slots 20, stars 5, levels 60; data prepared beyond.
- D86/D87 — break price table by tier × rarity; first break coin-only; bonuses multiplicative; merge keeps level/break.
- D93 — element identity (Water speed, Fire ATK, Nature both, Light/Dark +25%).

## Content & rarity
- D3/D10/D22/D26 — 6 elements in 2 groups; Light/Dark rare, two-way counters, drop all 3 base materials.
- D14/D48/D62/D72 — tail chance; rarity appears by level; tiered pools I/II/III per element.
- D46/D47 — content burn measured per segment; roadmap cadence from hardcore day-to-wall.
- D81/D85 — boss loot in 6 tiers with virtual bags; collection reward coin smooth by rarity.
- D92 (R4) — fill early species gaps with earlier pools; D93 hybrid seed Lv10, tomato Lv5.
- D22 content plan: biweekly, one focus per drop, ≤ 10–15% base power per drop, trickle slots.

## Systems details
- D8/D30/D31 — merge needs same id + star; 1→3★ free; wildcard item (later disabled, not in code).
- D24/D25 — break materials multi-element weighted; fusion shard for merges.
- D32 — shop restock 5 min.
- D65/D67/D78/D79/D93 — onboarding chain, mission thresholds & milestone rewards, reward > cost, split long missions.
- D88/D91/D95 — skills equal EV per tier, tier V ~1%; buffs split into 7-item ladder; skill pools by rarity × element.

## Process / integrity
- D35/D37/D40/D41/D49/D68 — read the real code; record "state" entries; sync after every dev batch.
- D36/D54/D61/D73 — simulator; measure against targets with colours; pages read shared data, no hard-coded numbers.
- D38/D66/D70 — config mirror of all tables; sync page with rebuild/restart; compact UI mode.
- D57/D60/D62 — playtest feedback rounds → concrete config levers (listed in `05-playbooks/03`).

## Added 2026-10-23 (D97–D98, documentation)
- D97 — recycler/converter: 20 % refund of invested cost, points → greedy exchange from the top tier, leftover as one
  probability roll (no storage), exploit test ≤ 44 %, no scarce-tier outputs.
- D98 — dev moved to trigger × action skills (12 families): EV model per action, tier targets 8/11/15/20/27 %, the
  bonus-hit family cut from +71 % to target, pierce given a damage component, element identity through pool shares,
  disabled skill removed from pools. Special enemies + pressure director: drops valued per hour, spawn chance
  5/10/100 → 2/4/25 %, rare "any rarity" seed pack replaced by a common bag. Teleport-to-garden Lv8 → Lv4;
  onboarding "buy seed" moved after the level that unlocks it.
- Documentation hand-off (v5.19): handbook, generated facts with automatic checks, decision index with
  contradictions table, document status labels, cold-read test — see [Playbook 04](../05-playbooks/04_documentation_handoff.md).
