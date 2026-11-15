---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/01-balance/07-balance-review-checklist.md"
---

# 07 — Whole-game balance review checklist

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

> Shared design, event-economy and burn-horizon rules remain owned by the
> [canonical references](../README.md#integration-and-applicability); this file records a worked application.

Run after every large change and before every export. Output a numbered list R1…Rn with severity and a
suggested order (`design/24-overall-review-*.md` is the example).

## Pacing
- [ ] Minutes to Lv10 / 21 / 50 / 100 inside targets; day-1 ends around Lv12 for a 30-min session.
- [ ] Boss kill time 30–38 s; win rate ≥ 85% before the wall; no lane leaks.
- [ ] Wall level = planned content wall; hardcore reaches it in ≥ 7 days.

## Economy
- [ ] Coin held at end ≤ 3% of earned; coin/min monotonic.
- [ ] Spend split sane (no single sink > 70%); the designated main sink cannot be maxed in 6 months.
- [ ] Prices ≈ intended minutes of income at unlock level; direct-buy ≈ 1.3× gacha expectation.
- [ ] Daily-shop scarce items cannot be vacuumed by a 24 h grinder.

## Content
- [ ] No > 30-minute stretch without a new species before Lv30.
- [ ] First Legendary/Mythic not before target levels; 72 species not completable in 24 h.
- [ ] Stars: at least some 3★+ in the garden by end of day 2; material faucets exist for every star step.
- [ ] Post-wall roadmap has ≥ 3 drops ready.

## Power
- [ ] +1 level is felt on the weakest plant.
- [ ] Within-rarity DPS spread ≤ ×1.3; between-rarity jumps smooth.
- [ ] Element identity visible (+10–15%; Light/Dark +20–30%).
- [ ] Skill tier V ≤ ~4% on any plant; rarer plants roll better.

## Rewards & unlock order
- [ ] Every new drop source valued per hour (coin-equivalent × frequency) ≤ ~10–20 % of income.
- [ ] No onboarding/tutorial step asks to buy/use something not yet unlocked at that point of the chain.
- [ ] Converters/recyclers fail the "buy cheapest → convert" profit test.
- [ ] Skill pools: disabled skills removed; element EV spread ≤ ±12 %; tier targets met per family context.

## Integrity
- [ ] Simulator models what the designer thinks it models (list gaps explicitly: buffs, growth time, …).
- [ ] `check-sync` green: derived data matches config; CustomConfig matches simulator constants.
- [ ] Dev action items contain only undone work; each references a decision ID.
- [ ] Missing assets (icons, localization keys) listed.
- [ ] Giftable/tradeable flags on anything farmable.
