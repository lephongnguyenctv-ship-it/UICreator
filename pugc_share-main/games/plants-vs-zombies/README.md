---
folder: Games / Plants vs Zombies (Craftland)
title: Plants vs Zombies — Game-Specific Knowledge
domain: craftland-ugc
game: plants-vs-zombies
status: authoritative
version: 1.0.0
last_updated: 2026-10-23
---

# Plants vs Zombies (Craftland farm-defense idle)

Game-specific knowledge for the Craftland **Plants vs Zombies** map (VN team, designer Tomo). Farm-defense tycoon:
each player owns a 7-column garden, plants auto-shoot zombies, damage and kills give coin, N kills summon a boss,
beating it in 60 s gives **+1 Boss Level** (account level 1→100) which gates all content.

## Scope rule
- ✅ PvZ rulings, locked decisions and their current values (dated), traps specific to this codebase.
- ❌ Reusable methods (simulator, pacing, EV models, balance website, hand-off docs) → the generic
  [knowledge pack](../../game-design/knowledge-pack/README.md), which uses this game as its worked example.
- ❌ Live numbers as a spec: they change weekly. The source of truth is the project repository below.

## Contents
| File | Use for |
|---|---|
| [`systems_reference.md`](systems_reference.md) | Pillars, systems map, rulings by system with decision IDs, key values as of 2026-10-23, data traps. Read before proposing anything for PvZ. |

## Source of truth (local project, Tomo's machine)
| Resource | Path |
|---|---|
| Handbook for agents (how to work, formulas, procedures) | `plant-vs-zombie/GDD/design/29-agent-handbook.md` |
| Current numbers (generated, never hand-edited) | `plant-vs-zombie/GDD/design/30-balance-facts.md` (`node scripts/balance-facts.js`) |
| Decision log with status index (D1–D98) | `plant-vs-zombie/GDD/design/00-decisions.md` |
| Open dev work | `plant-vs-zombie/GDD/design/20-dev-action-items.md` |
| Game code/config (read-only) | `plant-vs-zombie/PlantsvsZombies` (`origin/main`) |
| Balance website + simulator | `plant-vs-zombie/GDD/tools/balance-web` (deployed on RUN Platform) |

## Working conventions (this game)
- Replies to the designer in **Vietnamese, short**; tables over prose; at most one question.
- **Rewards always worth more than the cost**; no new UI unless necessary; less text; "plan first" when asked for a plan.
- Every change: decision entry, changelog, dev action items split into **CSV to copy** vs **code constants**, regenerate facts, local commit only (no push).
