---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/01-balance/05-boss-and-zombie.md"
---

# 05 — Boss & zombie

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

> Shared design, event-economy and burn-horizon rules remain owned by the
> [canonical references](../README.md#integration-and-applicability); this file records a worked application.

## Boss as the pacing clock
Boss appears after N kills (ramping 8→25 then flat; D27/D47), fight window 60 s, cooldown 30 s. Boss
Level +1 per win; fail keeps a % of charge. HP = `BaseHP × (1+8%)^(level−1) × BossHPMultPct[level]`.

## Fit HP to a target kill time (`fit-boss-hp.js`)
1. Run the simulator to get median **DPS vs boss** per level (includes plants, weapon, skills, upgrades).
2. Solve `HPMult[level] = targetSec × DPS / baseCurve`, smooth log(mult) with a 7-level moving average,
   round to 5%, clamp [5%, 2000%].
3. Target 35 s so the median player wins at 30–38 s of a 60 s window.
4. Iterate combat → fit three times (DPS depends on what the player could afford, which depends on boss
   coin, which depends on HP).
5. Apply the **early ease** multipliers (Lv1–12) for real humans (D96). ⚠️ The fit script overwrites every
   level, including Lv1–12 — re-apply the ease after each fit (or make the script apply it).
Outputs: `firstTryWinPct` per level; red if < 85% anywhere below the intended wall.

## Zombie HP vs capped plant power (D56/D84)
If plant power has a ceiling but zombie HP grows ×1.10/level, lanes leak eventually. Use 5%/level for
zombie HP and check `laneDps` vs lane pressure per level; the simulator logs leaks. When the dev adds new
zombie types (armour, coin), re-check Lv25–65 — that is where new mid-game enemies usually break things.

## Boss selector / tickets
Players may re-fight lower bosses for materials. Make the selector offset (−4 levels) and ticket pricing
part of the daily shop so farming is possible but capped per day.

## Checks per rebuild
- Boss kill time 30–38 s for all levels before the wall.
- No lane leaks.
- Boss HP / zombie HP ratio 7–18× (boss must feel like a boss).
- First level with win rate < 85% = the wall; make sure it matches the planned content wall.

## Spawn director: waves that react to the player (dev, D98)
The source dev replaced "one zombie per interval" with a hidden **pressure (Delta) director**: each kill adds +6,
each leak subtracts −30; thresholds 30 / 90 / 150 switch between Chill (1 zombie, slower), Steady (1–2),
Heated (1–3, faster) and Rush (burst of 3, then reset to 30). Consequences for balance:
- Throughput becomes a function of the kill fraction: a player killing everything sees ≈ 1.7× the zombies per
  base interval; one leaking ~40 % stays in Chill (≈ 0.9×). Model it as a small Markov/Monte Carlo of the delta
  meter **per kill fraction** and cache the result (zombies per interval, special chance per zombie).
- Income rises with skill, so re-check coin/min and boss charge pacing after such a change — in the source project
  pacing barely moved because the lane throughput cap was already binding.
- Keep a max-alive cap (source: 12) and pause the director during boss fights.

## Special / elite enemies
- Frequency is the main lever: target "one every 1–3 minutes" of active play so they feel like events.
  Spawn only when none is alive; tie the chance to the director tier (Rush higher).
- Make them tankier (HP ×1.1–3) and slower/faster for readability; the reward should scale with what they cost to kill.
- Value the drops per hour (see [Economy](02_economy_and_sinks.md#value-every-reward-per-hour-before-shipping-it-d98)).
