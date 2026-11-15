---
name: dyg-economy-benchmarks
description: >
  Dig Your Garden economy & balance: Luck System 2.0 normalization, rebirth
  luck curve, pity architecture (Shovel × Mountain), Pet Upgrade
  value-per-second System B (La closed-form), multiplier stacking, wonder
  income standardization, rotation shop (ShopItems/ItemWaves), and
  balance-work rules. Use for any DYG balance, tuning, or simulation task.
type: game-knowledge
domain: craftland-ugc
game: dig-your-garden
status: authoritative
version: 1.0.0
last_updated: 2026-08-07
---

# DYG — Economy Benchmarks

> The live GDD spreadsheet is the source of truth for current values; this
> file captures decisions, analysis, and risks. Verify before asserting.

## Luck System 2.0

- Layered: shovel luck + rebirth luck + mountain multipliers (+ event
  multiplier), normalized into a 0–10 effective-luck curve with per-tier end
  multipliers.
- Normalization anchor: `MaxCurrentTotalLuck = 5.3` for R1–R13.
  [PROPOSED two-phase] raise to **6.5 when R14+ ships**.
- [ANALYSIS] At old MaxLuck=10 players only reached ~19% of the tier
  multiplier range — anchor to realistic player values, not theoretical max.
- [ANALYSIS] Event multipliers >1.5× clamp EffLuck at 10 and waste surplus —
  keep headroom below clamp.
- [PROPOSED] Rebirth luck power curve `0.204 × r^0.6` (R1: 0.00→0.20,
  R13: 0.37→0.89) → 1.58× Mythic uplift across progression, R13 eff ≈ 9.72
  (below clamp, event headroom). Unconfirmed — check GDD.
- [FLAGGED INCONSISTENCY] Overall sheet used 15× Mythic end multiplier vs 8×
  in the Mountain Luck Formula sim sheet. Verify which won.

## Pity architecture

- Pity is **Shovel × Mountain**: each shovel keeps its own counter per
  mountain, persisting through durability loss; full reset on trigger.
- Milestone-based with randomized `MinDigs–MaxDigs` windows.
- **Principle**: a pity cap beyond ~P99 of the trigger distribution is
  effectively unreachable and wastes the mechanic (the Multi-Pet Dig 50-cap
  fired <1 in 100,000; 99% triggered by dig 30 → cap moved to 40).

## Pet Upgrade value/second — System B [CURRENT]

Moved from System A (recursive L\* detach level, two-floor regime) to
**System B**: piecewise closed-form with handoff level `La`.

- Multipliers (Mutation, Weather, Size) applied to base value **upfront** →
  effective base `B`.
- `La = FLOOR(1 + (B × g × e / MinUpgradeValueGainFlat)^(1/(1−e)))`
- **`MinUpgradeValueGainFlat` must stay explicit** — baking in MinFlat=1
  silently breaks the guarantee if the knob changes.
- Upgrade cost = base cost (anchored to pet price & value/sec) × independent
  overlay multipliers: level curve, rarity, secret, mutation, weather stack,
  size (XXS=0.8 … S=1.0 neutral … XXL=1.5). Keep overlays explicit and
  independently tunable — never bake into base values.
- Tooling: dual-engine (A vs B) single-file HTML/Chart.js comparison
  calculator exists.

## Wonder income

- [SHIPPED-DIRECTION] All wonders standardized to **fixed incomes per
  rarity**. Intent (never stated in changelogs): collection/decoration over
  income min-maxing.

## Rotation shop (ShopItems / ItemWaves)

- `ShopItems` = master catalog; `ItemWaves` = rotation. Waves cycle
  **sequentially**, Duration = **5 min** each; current set 20 rows, 3–5
  item types per wave.
- Mutagen IDs 11–22, canonical rarity ladder cheapest→dearest:
  **Golden → Frozen → Magma → Clover → Fossilized → Sweetheart**, each in
  S/SS with a consistent **3× S→SS multiplier** (75M GOLDEN_S → 1,050M
  SWEETHEART_SS). Rarity drives both price and wave frequency.
- **IDs 3–6 (specific mutations) excluded from all waves.**
- `RAND_MUTATION` (ID 2) flagged imbalanced, throttled: 6 wave appearances /
  9 total stock (from 10/19).

## Multiplier stacking

Size (XXS–XXL) × Mutation (Golden/Frozen/Magma/Clover) × Weather stack —
applies to both pet income and upgrade cost.

## Balance-work rules

- Money rewards are **rebirth-relative** ("X minutes of passive income"),
  never flat — flat is worthless at R10+ and broken at R1.
- **Sim before locking weights** on any outcome that inflates rarity
  acquisition (Surprise Dig Rank Up; see `systems_reference.md`).
- Watch rarity-economy inflation against the loot weight system for any
  free-upgrade mechanic.
- Burn-rate methodology (time-to-exhaust per cohort before release):
  [`../../game-design/feature_burn_rate_balancing.md`](../../game-design/feature_burn_rate_balancing.md).
