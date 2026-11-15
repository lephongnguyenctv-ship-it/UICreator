---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/01-balance/04-content-and-rarity.md"
---

# 04 — Content & rarity

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

> Shared design, event-economy and burn-horizon rules remain owned by the
> [canonical references](../README.md#integration-and-applicability); this file records a worked application.

## Tiered seed pools (D62/D72)
Instead of one bag per element, make 3 tiers per element with the same shape as the neutral ladder:
- Tier I (4 cheapest species, 70/30 common/uncommon, cheap, early),
- Tier II (7 species, 40/40/20),
- Tier III (9 species, 25/40/30/5).
Unlock the tiers at spaced levels (I at 14/17/20, II at 31/33/35, III at 41/43/45 for Water/Fire/Nature).
Light/Dark are late and scarce (basic 46/50, premium 77/84, ultimate 89/95) and mostly in the daily shop.

## Rarity gating
Rarity appears from level, not from luck alone: first Legendary not before ~Lv40, first Mythic not before
~Lv70 (targets in `balance-targets.json`). Every pool has a **tail chance** (D14) so the top rarity is
*possible* but rare; and a **hybrid bag** at Lv10 (cheap neutral species with a random element) introduces
elements as pure variety before elemental zombies appear at Lv21.

## Measuring variety
`species-times.js` → per species: median minute of first ownership, % of users who ever get it, which seed
granted it. Count species owned at Lv10/20/30/50/100 and compare with targets (36 species in 3–6 h; 72 must
exceed 24 h continuous; ~50–66 species at Lv100). A flat stretch = add a pool or reward earlier.

## Collection rewards (D65/D85)
Per species × star milestones. Coin reward rises smoothly with rarity; higher stars give materials/catalysts.
Guard: milestones for stars above the live cap stay disabled but keep their rows (future content).

## Boss loot by tier (D81)
6 loot tiers keyed to boss level bands. Fixed core (coin + materials) + random extras (seed bags I–V, plant
boxes, catalysts, vials) with per-item ‰ and quantity ranges. Virtual "bag" items (ids 00004–00010) expand
into a pool at claim time; keep a "no reward" slot so the total stays 1000‰ when adding new drops.

## Content roadmap (post-wall)
Biweekly cadence, one focus per drop, numbers in `design/25-content-plan-*.md`:
levels+bosses → garden slots → star cap +1 → levels+bosses → items/events → star cap +1 … Keep ≥ 9 garden
slots and ≥ 3 star tiers in reserve for months 4–6. Re-fit boss HP only for new levels.
