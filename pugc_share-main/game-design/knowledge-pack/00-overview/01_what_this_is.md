---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/00-overview/01-what-this-is.md"
---

# 01 — What this is

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

## The setup

| Role | Who | Owns |
|---|---|---|
| Game designer | a human (here "Tomo") | Vision, taste, final say on every number and every pixel; playtests with real users |
| AI agent | you | Reads code/config, proposes balance with evidence, builds the website + simulator, writes docs, prepares exports for dev |
| Dev team | humans, separate repo | Implements code; applies CSV config the agent exports; occasionally changes mechanics (which the agent must detect and re-sync to) |

The game: a Craftland (Free Fire UGC) idle/tower-defense map. Player plants crops (72 species = 12 base ×
6 elements) in a garden; plants auto-shoot zombies; killing/damaging zombies gives coin; every N kills a
boss appears; beating the boss raises **Boss Level**, which gates all content (shop items, seed pools,
features, zombie types). Plants have Level (1–60), Star (1–5, via merge), Break tier (every 10 levels),
Mutation (income multiplier), 1 active skill + 2 passive skills. Shop = gacha seed bags + direct plants +
consumables + an hourly rotation + a daily rotation. Coin sinks: seeds, level-ups, breaks, upgrades (12
branches × 300 levels), consumables.

## What was delivered

1. **A balance website** (`tools/balance-web`, Node.js, ~26 pages): pacing, level overview, balance
   curves, resource/progression, plant level & break, skills, upgrade, plant power roster, user simulator,
   zombie & boss schedule, items, packs, shop schedule, onboarding, missions, collection rewards, content
   roadmap, UI/UX mockups, HUD simulation, system map, config tables, sync status.
2. **A Monte Carlo player simulator** (`simulation-core.js`) that plays N users × M minutes from the real
   config and produces: minutes-to-level, coin per minute, DPS per level, boss win rate, species timeline,
   collection timeline, mission/day stats, upgrade/break spending, material stock.
3. **A decision log** (`design/00-decisions.md`, D1–D96) — every balancing decision with reason, numbers,
   and status (CHỐT = final, VOID = superseded, TRẠNG THÁI = fact about code).
4. **Dev action items** (`design/20-dev-action-items.md`) — the short list the dev needs: which CSV files
   to copy and any code change, nothing else.
5. **Config exports** (zip with CSVs + the action-items file) after every balance pass.
6. **UI/UX mockups** of ~25 screens built from the real `.ui` files and real sprites, with a scene preview
   and a clickable HUD simulation (method in [canonical UI/UX method](../../../development/ui_ux_mockup.md)).

## The daily loop

```
designer asks / gives playtest feedback
  → agent reads real code + config (not memory)
  → agent proposes: numbers + reasons + simulated impact (+ 2-3 options if visual)
  → designer picks / adjusts
  → agent applies via a re-runnable script, re-fits dependent values, rebuilds all derived data
  → agent updates: decision log, changelog, dev action items, visual pages, export zip
  → agent reports the result; commits or pushes only when authorized by the current task
```

Typical turnaround per request: 1–3 hours of agent work. The designer never had to open a spreadsheet.

## What made it work

- The **website was the shared language**. The designer looked at pages, not JSON. Every proposal had a page.
- **Simulator first, opinion second.** "Lv10 takes 23 min, Lv50 3.3 h, boss dies in 30–38 s" beats "feels ok".
- **The config mirror was always rebuildable from the dev repo** (import script), so dev changes never
  silently diverged from the proposal.
- **Small, re-runnable apply scripts** per decision (`apply-d81.js` …) instead of hand-editing JSON.
- **Options, then consolidation** for anything the designer judges by eye.
