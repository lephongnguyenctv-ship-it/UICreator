---
folder: Games / Dig Your Garden
title: Dig Your Garden — Game-Specific Knowledge
domain: craftland-ugc
game: dig-your-garden
status: authoritative
version: 1.0.3
last_updated: 2026-09-07
---

# Dig Your Garden (DYG / DYG3 / DIGXUP)

Game-specific knowledge for **Dig Your Garden** — cozy multiplayer
idle/incremental digging game built in Roblox, max 4 players per room.
Core loop: dig mountain → collect wonders → place in garden → passive
income → rebirth → repeat.

Apply the [context and decision rules](../../SKILL.md#context-and-decision-rules) for creative exploration, source requirements, and explicit redesign proposals.

## Scope rule

- ✅ DYG design rulings, locked decisions, DYG-tuned economy numbers and risks.
- ❌ Anything reusable by other Craftland games → generic folders
  ([`../../game-design`](../../game-design/README.md),
  [`../../ai-skills/data_tooling_patterns.md`](../../ai-skills/data_tooling_patterns.md)).
  If a lesson learned on DYG is game-agnostic, it goes generic and DYG cites it.
- ❌ Specs — the live Google Drive GDD spreadsheet is the spec source of
  truth. This folder holds rulings; **read the actual sheets** before asserting or changing current configs.

## Contents

| File | Use for |
|---|---|
| [`systems_reference.md`](systems_reference.md) | Design pillars, canon facts, systems map, per-feature rulings (Backyard Digging, Surprise Dig, Flower Fusion, mountains), redesign scope, rejected patterns, data traps. Read before proposing ANY DYG design. |
| [`economy_benchmarks.md`](economy_benchmarks.md) | Luck System 2.0, pity architecture, rebirth curve, Pet Upgrade System B, rotation shop, multiplier stacking, balance-work rules. |

## Status tags

`[SHIPPED]` = live · `[CONFIRMED]` = locked for a version · `[PROPOSED]` =
recommended, unconfirmed · `[EXPLORED]` = brainstormed only. Never promote a
lower tag to canon; verify `[PROPOSED]` against the GDD before asserting.

## Source of truth

| Resource | Google Drive file ID |
|---|---|
| Live DYG GDD (Excel) | `1wHsG8iyqA66dlrL8UrkZxSqIHepnlFTWVpgKCofrHlQ` |
| Steal A Pet reference GDD (format precedent for analytics tickets) | `1N4lD2KWdsG59Ie9Br0_Eg9CO5FmuftZGJxWkKUZuUC4` |

Known sheets: Detail Planning, All Items, PetSize & Mutation, Weathers,
Weather Effects, Rebirth & Mountain Luck, Luck Sim Formula, Mountain Luck
Formula, Overall, Localization. Generic xlsx/Drive read patterns:
[`../../ai-skills/data_tooling_patterns.md`](../../ai-skills/data_tooling_patterns.md).

## Working conventions (this game)

- Read GDD sheets for current-value claims and concrete balance/config work; abstract ideation may proceed with labeled assumptions.
- Feature GDDs are **table-first**: 2-column tables (Field/Description or
  Type/Description), not prose. Changelog section optional.
- Changelog entries are **terse and factual** — state what changed only, no
  rationale, no player-facing framing. Accepted: "Rework wonders: all wonders
  now standardized to fixed incomes." May need a Vietnamese line.
- **Vietnamese localization**: natural VN terminology, not literal translation
  (Hoa, Sen, Cúc, Bụi, Lá, Dừa). Key conventions: flowers =
  `FLOWER_SNAKE_CASE` + `NN_NN_0` IDs (continue from pool's last ID);
  plants/trees = non-prefixed `SCREAMING_SNAKE` (e.g. `SCOTSPINE`).
  Before naming "new" assets, cross-check `unidentified` entries in All Items.
- Detail Planning backlog row convention: `backlog | (blank) | task text` in
  columns B/C/D.
- Output: CSV for configs (copyable), single-file HTML + Chart.js for
  calculators (dark instrument-panel aesthetic), to the current workspace output directory (or the user-requested location).
- Balance data is often deferred — placeholder tables are normal; don't
  speculatively fill numbers.
- For reward or gift-code work, use the generic
  [`../../game-design/reward_gift_code_config.md`](../../game-design/reward_gift_code_config.md)
  workflow and discover DYG's current native tables; do not assume SAP's
  RewardData/GiftData columns or IDs.
- Vague request → state a reasonable assumption and proceed; lead with a
  recommendation, then alternatives; flag GDD inconsistencies unprompted.
- **Analytics collaboration (DA: Jiahan)**: design defines what questions need
  answering and what events to capture; the DA owns field-level schema,
  reporting model, and pipeline. Ticket format mirrors the Steal A Pet
  tracking doc (BR-292492); Jira is the tool. Phase 1 scoped: baseline
  session, currency, steal interaction, retention. Deferred: fusion, rotation
  shop, mountain discovery, dig volume.
