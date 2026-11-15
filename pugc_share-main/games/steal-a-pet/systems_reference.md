---
name: sap-systems-reference
description: >
  Steal A Pet (SAP) — canonical game-specific reference: core design pillars,
  locked formulas and config values, audience constraints, and per-system
  rulings. Use for ANY Steal A Pet task (triggers: Steal A Pet, SAP, rebirth,
  Pet Coin, Dust, MutaGen, Copycat, Dust Hunt, High Tide, Weather 2.0,
  Steal 2.0, fishing, Weather Charm). Read this BEFORE proposing designs so
  current decisions remain the baseline; explicitly requested redesigns follow the context and decision rules in the package entrypoint. Specs live in the GDD/Master Data
  xlsx files — this file holds rulings and locked values only; always read the
  actual sheets for current configs.
type: game-specific-knowledge
domain: craftland-ugc
game: steal-a-pet
status: authoritative
version: 1.0.2
last_updated: 2026-09-07
---

# Steal A Pet — Systems Reference

> **Source-of-truth rule:** GDD and Master Data xlsx files in the project are
> the spec. This file holds *design rulings, locked values, and pillars* so
> they are preserved by default. For requested redesigns, apply the
> [context and decision rules](../../SKILL.md#context-and-decision-rules); label alternatives as proposals, not current rules. When sources conflict,
> the newest Master Data wins — flag the conflict.

## 1. Design Pillars (load-bearing — check every feature against these)

| Pillar | Rule | Violation examples |
|---|---|---|
| Exposure spine | Your base earns passively but is exposed while you're away. Every open-world activity (raiding, fishing, boss fights) must cost base exposure. | Features that let players engage outside content while base is protected. |
| Theft has teeth | Stealing must remain a real loss. Recovery mechanics are discounts/paths, never free restoration. | Full-value theft insurance; recovery cheaper than defense. |
| Depth via read edges | New depth = new *reads* of existing pet state (Rarity, Level, Mutation, Weather, IsSecret, LookId), not new write systems on the pet object. | Adding a new persistent per-pet attribute when an existing one is unread. |
| Rarity axis primacy | Rarity is the primary collectible axis; Mutation and Weather are secondary. Don't flatten the hierarchy. | A weather effect that out-values a rarity tier jump. |
| No punishment for casuals | Casual players must not be punished relative to hardcore in event design. Fairness gates with PASS/FAIL verdicts are standard. | Completion math only reachable at hardcore session counts. |

## 2. Audience Constraints (under-14)

- No premium-only recovery mechanics.
- No player-to-player money transfer channels (alt-abuse + monetization risk).
- Whimsical, age-appropriate naming, always bilingual EN + VN. Naming
  convention: weathers = single/compound English word (Rainy, Nebula);
  effects = single abstract noun (Soaked, Glitter). VN localization must
  sound natural, not literal (e.g. "Kết Tinh" over "Ràng Sao").

## 3. Locked Formulas

| System | Formula / value | Notes |
|---|---|---|
| Pet upgrade (LvUp) | Closed-form engine, canonical; `LevelValueExponent = 0.7`. The `< 1` constraint is what makes the single-crossover property hold — closed form is unsafe without it. Size removed from cost formula (value-only). | Base-anchor simplification explicitly rejected (GDD §7, diverges at Lv72). |
| PetDustValue | `ROUND(r^tier_index × Level^0.4)`, `r = 1.2`, tiers COMMON=0 … LIMITED=6. | Unified source of truth for BOTH Dust Hunt combat damage and Fusion Dust yield. Never fork these. |
| MutaGen cost | `FinalUseCost = BaseUseCostLv1 × LevelMultiplier^(PetLevel−1)`, **`LevelMultiplier = 1.04`** (live). SecretMultiplier = 55%. | 1.2 was a misconfig creating a dominant mutate-before-level strategy. Exponential formulas must track the actual (concave) pet value curve. |
| Weather Charm | Exact MutaGen clone: same formula, same PetRarityMult and SecretMultiplier tables, same fail behavior (charm + money consumed). | 24-row config table produced; old weather items 30001–30005 untouched. |
| Level inheritance (Copycat) | Level always inherits from STAT pet, never LOOK pet. | Blocks cheap-level laundering. |

## 4. Locked Configs & Rulings by System

### Steal 2.0
- Free-for-all entry; rarity ceiling gated by rebirth (RB1=Common → RB12+=Limited).
- Door unlock cost = flat config table by highest stealable rarity:
  Common 3 / Rare 4 / Epic 6 / Legendary 9 / Mythic 13 / Divine 19 / Apex 28 / Limited 40 PC.
- Zero in-game money in the cost — Pet Coin only.
- Locked, no charge, if nothing stealable in the base.
- **Open:** farm-down deterrent (high-RB raiding low-RB pays only 3 PC) —
  requires confirmation that the engine supports runtime PC price
  multiplication.

### Weather 2.0
- Passive-buff axis moved to Weather; **Mutation keeps live income-multiplier
  role untouched** (migration-risk ruling — never move it back).
- Six account-wide meters; positional auras: Gale Toll (+1 PC/point to raider
  door cost, cap +5), Storm Aura (flat Dust/tick adjacent, daily cap),
  Sparkle Aura (+% income adjacent).
- Prism Selector: delete a pet → extract one weather effect as a charm; sole
  acquisition source for Prismatic/Vortex/Sequin charms.
- Storage-slot revocation: Grace State / Overflow — slot locks once emptied,
  never evicts the stored pet.
- **Open:** Prismatic final effect; pet slot-swap support (required for aura
  gameplay); Gale Toll stacking order vs Steal 2.0 farm-down multiplier.

### High Tide / Fishing (permanent, "Triều Cường")
- Weather-gated, fishing occurs **outside base** (exposure spine).
- 29-pet pool, no COMMON, no pity, Mythic band ≈ 2.54% (≤2% spawn-pool rule
  applied), secret pets weight-suppressed within band.
- Chests: three parallel counters, base 15%/7%/2%, pity caps 9/17/30; Chest N
  drop resets counters 1..N only; Chest 3 guarantee always preserved.
- Weather table: 74-min cycle, max dry gap 19 min (target ≤ 20). Heavy Rain =
  Rain + High Tide stacking rule with display-name override, not a third state.
- **Open:** chest contents; cast cost/currency; weather-gated vs always-castable.

### Dust Hunt (boss)
- Open-map boss, 30-min spawn, 120s window; leaving base to fight = exposure.
- Boss HP = 3600 (Monte Carlo–calibrated; closed-form overstated success 2×).
- Dust accrues per hit; Pool Ceiling = HP × Multiplier (default 1.0).
- Chest eligibility: participation fraction (0.30) × player's **own** DPS
  ceiling (dynamic by RB + Pet Following), never an absolute threshold.
- Pet Following unlocks at RB19 (hard gate).
- Known bug class: boss damage script bound to pet's money `Value` field
  instead of computed PetDustValue ("Mr Football", 5.2T Value, <30s kill).

### Copycat
- LOOK + STAT roles, both pets burned; 4-outcome gacha (2×2 grid), BEST capped
  at 85% via Magic Stones (Dust Boss chest currency).
- Symmetry verified (A+B ≡ B+A); gap-chaining costs more than direct (verified).
- Mutation = 1 slot per pet; weather supports up to 5.

### Rebirth / progression
- Rebirth is the prestige spine (20+ tiers). New features must respect
  already-earned levels — never invalidate prior player investment.
- RB0→RB1 is the primary retention cliff — a tutorial scaffolding problem,
  not a content problem.
- MobAmount flatlines at 18 slots from RB13.

### Spawn pools (Mob 2.9.0+)
- New/Mid/Late pools by rarity (New=Common/Rare, Mid=Epic/Legendary,
  Late=Mythic/Apex); activation by room composition, 7 states S1–S7.
- S6 (New+Late, no Mid) spawns those two pools literally — no auto-expansion.
- New pool anchors at 50% share whenever New players are present; remaining
  50% splits per non-New head.
- Rarity-signal monotonicity is checked **within** each pool's tier set, not
  across pools.

## 5. Known Data Traps (Master Data)

- Sheet name typo: `GlobalCofig`. Always enumerate sheets before reading.
- `Price == DiscountPrice` across rotation shop catalog = discount column
  inactive (known, not a bug to re-report).
- TASMANIANDEVIL (APEX/SECRET) carries nonzero weights unlike all other
  SECRET pets — suspected data entry error.
- SLOTH (74) / LLAMA (83) don't exist in live Mob sheet before v2.10.0 —
  rotation waves featuring them must not ship earlier.
- Rotation Shop (Format) is self-contained (own catalogs); ID bands: base
  11xxx, pet+mut 12xxx, pet+weather 13xxx, combos 14xxx–15xxx, mutagens
  2xxxx, weather items 3xxxx.

## 6. Rejected Patterns (do not re-propose)

- Bracket-gated steal eligibility (rejected for free-for-all + rarity ceiling).
- Log/Value-derived steal pricing (rejected for flat config table).
- Winner-take-all room events (punishes 5 of 6 players).
- Collect-N-to-unlock recovery gates (protects the wrong players — reframed
  as collect-N-for-discount).
- Pity on permanent faucets.
- WeatherMult in the income formula (scrapped; migration risk).
- Prismatic "wildcard +1 all meters" (broken on auras).
