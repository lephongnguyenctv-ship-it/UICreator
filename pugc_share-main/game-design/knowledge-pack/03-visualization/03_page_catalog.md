---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/03-visualization/03-page-catalog.md"
---

# 03 — Page catalog (what the site ended with)

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

| Group | Page | Question it answers | Reads |
|---|---|---|---|
| Overview | Home | where is everything | nav |
| | GDD docs | design docs rendered from markdown (decision log, dev items) | `design/*.md` |
| Balance | Progression Pacing | minutes → level → what unlocks; learning/excitement curve | pacing-times, access gates |
| | Level Overview | Lv1–100 table: time (3 segments), coin, boss HP, garden, unlocks | pacing, combat, gates |
| | Balance Curves | difficulty & progress for casual/core/hardcore; targets red/yellow | pacing-curves, targets |
| | Progression / Resource | when the 72 species appear; materials per level | species-times, content-burn |
| | Level & Break | cost per 10-level segment, break price table, wait time, material stock | break-facts, break tiers |
| | Skills | active/passive tables (vertical), trigger + action text, **EV wave / boss / average vs tier target**, EV chart, **pools matrix** (rarity × element) | skills, skill pools, shared `skill-ev.js` |
| | Upgrade | 12 branches: cost, effect, payback, 6-month projection, coin burn | upgrade-facts |
| | Plant Power (roster) | 72 plants × Level/Star/Mutation/Skill/Crit/Element → ATK/APS/DPS, identity table, rarity spread | plant data + constants |
| | User Simulator | run N users live with assumptions; milestone heatmap; anomalies | simulation-core |
| Content | Zombie & Boss | per level: zombies (HP, DPS, coin), boss (HP, kill time, loot fixed/random) | zombie-schedule, combat |
| | Items | every consumable: effect, unlock, price in minutes, other sources, buff timeline | items model |
| | Packs | contents of every bag/box/seed with % and where it comes from | pack-catalog |
| | Shop Schedule | items by unlock level: price, stock, weight, hourly vs daily | shop-schedule |
| | Onboarding | 21 missions: when done, wait time, reward value vs cost | onboarding-model (sim) |
| | Missions | daily/weekly thresholds, milestone rewards, % users reaching | mission-facts |
| | Collection rewards | star milestones per species, reward value, when claimed | collection-times |
| | Content roadmap | 3-month biweekly plan, caps over time, days-to-wall per segment, R4/R5 before/after | plan data |
| UI/UX | UI/UX Example | 25+ screens rebuilt from `.ui` + real sprites, side by side with reference, asset table, scene preview | uiux.js |
| | HUD simulation | click through the HUD like in game | simulate-hud.js |
| | System Map | core loop and system relationships | system-map |
| Data | Config Tables | every table (editable grid), proposal vs dev | config mirror |
| | Sync | staleness, mirror vs game diff, constants diff, rebuild/restart buttons | check-sync |

Build order that worked: Config Tables → Simulator → Level Overview/Pacing → Shop → Zombie & Boss →
feature pages as each system got balanced (missions, collection, loot, upgrade, break, skills, items,
roster, roadmap) → UI/UX pages in parallel once assets were available.
