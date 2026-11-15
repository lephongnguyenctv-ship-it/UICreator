---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/01-balance/01-progression-pacing.md"
---

# 01 — Progression & pacing

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

> Shared design, event-economy and burn-horizon rules remain owned by the
> [canonical references](../README.md#integration-and-applicability); this file records a worked application.

## One spine
Pick **one** progression axis that gates everything (here: **Boss Level** = number of bosses defeated + 1).
We removed a second axis ("House Level") early (D13/D18/D28): two axes make unlock tables, prices and
simulation twice as hard to reason about, and players don't know which one to chase.

Everything hangs off the spine: shop unlocks, seed pools, features, zombie types, garden slots, boss HP,
mission availability. The gate table (`ProgressionAccessData` → `gate.boss_level_NN`) is the single
place where "when" is defined.

## Express targets in minutes, not levels
The simulator gives **continuous play minutes to reach level X** (real humans ≈ ×1.5). Targets used:

| Level | Target (continuous) | Meaning |
|---|---|---|
| 10 | 22–36 min | end of a first session |
| 21 | 55–85 min | elements begin |
| 50 | 190–290 min | mid game |
| 100 | 600–840 min | content wall for v1 |

Keep these in `balance-targets.json`; the simulator page colours red/yellow when outside. Changing the
target = editing that file, not the code.

Segments: casual 30 min/day, average 60, hardcore 120. Report "day N hits level X" per segment; the
hardcore day-to-wall drives the content roadmap cadence (we planned biweekly updates so hardcore always
had ~2 weeks of new goals).

## Learning curve & excitement curve (D75/D76)
Score each unlock on two axes: **learning load** (new mechanic the player must understand) and
**excitement** (visible power/fun). Rules that fell out:
- Never two learning-heavy unlocks on the same level; space them ≥ 2 levels apart.
- Each level should unlock ≤ 1 thing in the first 20 levels, ≤ 2 later.
- Alternate: mechanic → content → mechanic. A content unlock (new seed bag, new plant) can sit right
  after a mechanic to let the mechanic "breathe".
- Front-load excitement in the first 10 minutes (first boss ≤ 2 min, first new plant ≤ 5 min).
- Put a **return hook** at the end of day 1 (daily missions unlocked at ~Lv12).
- **Quality-of-life shortcuts come right after the need appears.** Travel shortcuts (teleport to shop/garden) were first placed at Lv8; playtest showed players walk back and forth from Lv2, so they moved to Lv2 (shop) and Lv4 (garden) — within 1–2 levels of the moment the player first needs them (D93/D98).

## Onboarding (D65/D67/D93)
- ~20 chained missions, each teaching exactly one mechanic that just unlocked; no two complete at once.
- Reward > cost, always. "Buy a 2,500 seed" must give back more than 2,500 in value, and preferably a
  *different* thing (a new plant species, a preview of a later seed bag) to create variety.
- Split long missions ("kill 30") into 10 + 20 placed at different points.
- Keep mission IDs stable so the dev only replaces rows.

## Collection gap check
Run the species timeline (minute of first ownership per species, median). Flag any stretch > ~30 continuous
minutes with no new species before Lv30. Fix with earlier seed pools, not with stronger plants (element
variants of the same plant have the same stats — pure variety, no power creep).

## Early-game ease (D96)
Bots play optimally; new humans wander and read. After fitting boss HP to the bot, multiply Lv1–12 HP by an
ease factor (0.5 at Lv1–2, lowest 0.4 at the first HP jump, rising to 0.95 by Lv12). Rule of thumb: a
player with half the bot's DPS should still beat the boss inside the fight window until ~Lv9.

## Content wall & roadmap
Decide the v1 wall (Lv100 here) and *accept* it; plan post-wall content as biweekly drops that each have
ONE focus (levels+bosses / stars / garden slots / items) and raise base power ≤ 10–15% per drop. Trickle
scarce resources (garden slots: +2 per month, hard cap 35).

## Unlock-order integrity (D98)
Every step that asks the player to *use* something must come after the level that unlocks it — across tables.
The source game shipped an onboarding mission "buy a Cracked Seed" right after "reach Lv2", while the shop only
sold that seed from Lv3: real players got stuck (bots did not, because the simulator just waited).
- For each chained mission of type *buy / use / craft X*, compute `unlockLevel(X)` from the access-gate table and
  compare it with the highest level the chain has required so far. Flag any `unlockLevel > reachedLevel`.
- Fix by moving the mission after a "reach level ≥ unlockLevel" step, or by raising that step's target — never by
  unlocking content earlier just to satisfy a mission.
- Automate the check in the generated facts document (see [Playbook 04](../05-playbooks/04_documentation_handoff.md))
  so it runs after every config change; the same check applies to tutorial arrows and quest hints.

## Reading pacing results
- Report one canonical number per level (the long, many-user run). Shorter audit runs with other seeds differ by a
  few minutes; do not mix them in one table.
- A miss of ≤ 1 minute at the edge of a target band is rounding — record it as accepted rather than re-tuning.
- Real-player multiplier ≈ ×1.5 over the optimal bot; if live data disagrees, calibrate this factor first.
