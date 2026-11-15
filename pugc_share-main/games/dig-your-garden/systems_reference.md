---
name: dyg-systems-reference
description: >
  Dig Your Garden (DYG/DYG3/DIGXUP) systems reference: design pillars, canon
  facts, systems map, per-feature rulings (Backyard Digging, Surprise Dig,
  Flower Fusion, mountain signatures), rejected patterns, and data traps.
  Read before proposing ANY DYG design.
type: game-knowledge
domain: craftland-ugc
game: dig-your-garden
status: authoritative
version: 1.0.1
last_updated: 2026-09-07
---

# DYG — Systems Reference

Apply the [context and decision rules](../../SKILL.md#context-and-decision-rules): preserve the baseline below, and label any requested redesign as a proposal with its impact.

## Design pillars (north star)

- **Chill, cozy digging; collection is the primary satisfaction.** Dig → find
  wonder → bring home → watch garden grow. PvP is spice, not the main course.
  Design decisions protect the cozy feel first.
- **No min-maxing pressure or competitive friction as a primary experience.**
- **Visible-not-hidden mechanics** — players can read what's happening.
- **Simple calculations over complex formulas** — complexity serves design.

## Canon facts (commonly gotten wrong)

- **NO base raiding.** Pet stealing happens only while a player carries a
  wonder back from the mountain (on the road).
- **Max 4 players per room** — a deliberate design lever: shared resources
  create natural, friendly tension (see Backyard Digging).

## Systems map

| System | Summary |
|---|---|
| Rarity | 5 tiers: Common, Uncommon, Rare, Legendary, Mythic |
| Wonders | Pets/plants/flowers/trees; size (XXS–XXL) and mutations (Golden, Frozen, Magma, Clover) multiply income and upgrade cost |
| Shovels | 11 (Base→Diamond), unique stat tradeoffs (Dig/Run Speed, Jump, Rarity Luck) + skills; broken durability disables luck/mutation and tanks speed |
| Luck 2.0 | Normalized 0–10 curve, per-tier multipliers, pity → `economy_benchmarks.md` |
| Rebirth | Resets shovel; grows income multiplier, base slots, jump height; 12+ levels, R14+ planned |
| Mountains | Main Chain (IDs 1–99, cumulative MinMountain pools) vs Secret Garden/Backyard (IDs ≥100, standalone isolated pools) |
| Weather | Weather types apply stacking effects boosting both income and upgrade cost |
| Economy sinks | Rebirth, shovel upgrades, rotating consumable shop (5-min waves), pet upgrades (value/second System B) |
| Wonder income [SHIPPED-DIRECTION] | All wonders standardized to fixed incomes per rarity — shifts focus to collection/decoration |

## Roadmap anchors

| Version | Content |
|---|---|
| v1.5.0 | Backyard Digging [CONFIRMED] |
| v1.8.0 | Jackpot Digging — unresolved scope/naming collision with Surprise Dig |
| v2.0+ | Weather expansion, more content, fusion, inventory, housing deco |

## Feature rulings

### Backyard Digging [CONFIRMED v1.5.0]

- Players feed unwanted pets to a shared room-wide **Keeper meter**; combined
  feed converts to a **finite shared pool of digs** (not time-gated) in a
  distinct Backyard with its own pool.
- 4-player cap + shared pool tension is **intentional** — friendly
  negotiation, not enforced fairness.
- UI reuses two existing idioms only: wooden world sign during fill ("opens in
  X more feeds"); dark-panel HUD when open (shared digs remaining + soft
  fair-share "your share ~7"). Depleted = Keeper "resting", meter ticking up.
- **No per-player feed attribution / leaderboards** — communal meters must
  not become guilt mechanics.
- Implementation ruling: Backyard is **another entry in the existing
  Shovel×Mountain pity architecture** (MinMountain-style bucket, own pool =
  Secret Garden IDs ≥100, luckRate 1.0), not a parallel system.
- Keeper feed = flat value scaled by rarity; commons-dumping risk; cheap
  guard = diminishing returns on repeated same-rarity feeds per session.
- Drain **per dig**, not per time (ticking clock fights cozy tone).
- Threshold scales sub-linearly with room population (`base × sqrt(players)`).
- [EXPLORED] Backyard pool differs each opening.

### Surprise Dig [SPECCED — revamp of Multi-Pet Dig]

- Reuses existing counter/trigger engine, **retuned**: halve chances digs
  1–15 (expected trigger ~15 → ~22–25 digs), **hard pity cap 40** (old
  50-cap was unreachable — 99% triggered by dig 30, <1/100k hit 50).
- One weighted roll per trigger:

| Outcome | Weight | Notes |
|---|---|---|
| A — Triple Dig | 50% | 3 unique pets, pick 1; other 2 → Keeper (+2 Backyard counter) |
| B — Rank Up | 30% | Dug pet re-rolled one rarity tier up, same mountain pool, keeps size/mutation/weather; Mythic → fall through to C |
| C — Lucky Chest | 20% | Opens instantly (no keys/wait); `SurpriseChest` pool on RewardData: Money 50% (rebirth-relative, ~2–5 min passive income), MoneyTime 0.5h 25%, Random Mutagen S 15%, RandomPet Rare+ 10% |

- Open risks: (1) **Rank Up inflates high-tier acquisition** vs Luck 2.0 +
  pity — sim before locking weights; safety valve = cap B at Legendary so
  Mythic stays Luck-exclusive. (2) Revamp roughly **halves passive Keeper
  feed** (only A feeds) — recheck Backyard fill pacing. (3) **Jackpot
  Digging (1.8.0) collision** — merge or differentiate.

### Flower Fusion [EXPLORED — not fully specced]

- Transmog-style: Flower A contributes the **visual model**; Flower B donates
  its **full atomic economy package** (rarity, money/sec, price — always
  together, never split).
- **3-outcome roll**: no change / partial / jackpot; "no change" returns A or
  B randomly. Direction: "everything goes" (both inputs consumed).
- Cost scales by Flower B's rarity and level, **reusing the MutaGen formula**.
- Alternatives explored: Dust/s (passive decoration resource funding fusion),
  un-ranked Tags (Bloom/Frost/Glow) for set bonuses, color variants,
  provenance/seasonal stamps.

### Mountain signature / exclusivity

- Cumulative MinMountain → **Mountain 1 has zero true exclusives**. Fix
  direction: Signature column tag or MinMountain edits.
- Identity: **3 signature pets per mountain** (Mascot + Trophy + Signature).
- Mob type: later.

### Backlog (logged in Detail Planning)

Fever Time (streak-earned dig event, distinct trigger from weather events),
Visible luck meter, Garden ambient buff (decoration feeds back into next dig).

## Rejected patterns in the current design baseline

- **DisplayScore for decoration** — scoring beauty reintroduces min-maxing.
- **Universal dig-speed upgrades** — speed only as shovel-specific tradeoff;
  universal speed compresses the satisfying swing-count.
- **Per-player feed leaderboards** on communal meters — guilt mechanic.
- **Time-gated / ticking-clock Backyard drain** — fights cozy tone.
- **Flat money rewards** — must be rebirth-relative (see benchmarks).

## Data traps

- **Never infer pet IDs from row position** — always read the explicit ID
  column.
- Sheet names contain special characters (`Rebirth & Mountain Luck`) — quote
  exactly; enumerate sheet names first.
- Ignore any older standalone pity doc — superseded by Shovel×Mountain ruling.
- Generic xlsx/calculator/Drive patterns:
  [`../../ai-skills/data_tooling_patterns.md`](../../ai-skills/data_tooling_patterns.md).
