---
folder: Games / Steal A Pet
title: Steal A Pet — Game-Specific Knowledge
domain: craftland-ugc
game: steal-a-pet
status: authoritative
version: 1.0.3
last_updated: 2026-09-07
---

# Steal A Pet (SAP)

Game-specific knowledge for **Craftland: Steal A Pet** — adversarial idle
tycoon (pets earn passively, players raid bases to steal pets, Rebirth
prestige spine). Live on US/SG/IND, audience under-14, currently v2.8.x.

Apply the [context and decision rules](../../SKILL.md#context-and-decision-rules) for creative exploration, source requirements, and explicit redesign proposals.

## Scope rule

- ✅ SAP design rulings, locked formulas/configs, SAP-tuned economy numbers.
- ❌ Anything reusable by other Craftland games → generic folders
  ([`../../game-design`](../../game-design/README.md) etc.). If a lesson
  learned on SAP is game-agnostic, it goes generic and SAP cites it.
- ❌ Specs — the GDD/Master Data xlsx project files are the spec source of
  truth. This folder holds rulings; **read the actual sheets** before asserting or changing current configs.

## Contents

| File | Use for |
|---|---|
| [`systems_reference.md`](systems_reference.md) | Design pillars, baseline formulas/configs, per-system rulings, redesign scope, rejected patterns, data traps. Read before proposing ANY SAP design. |
| [`economy_benchmarks.md`](economy_benchmarks.md) | Currency map, event economy rules, drop/pool rules, faucet benchmarks, balance tool standards. |

## Working conventions (this game)

- Read master data / GDD files for current-value claims and concrete balance/config work; abstract ideation may proceed with labeled assumptions.
- Flag assumptions explicitly before building; ask on ambiguous intent.
- Output: CSV for configs, markdown for GDDs, single-file HTML for
  calculators, draw.io XML for system maps. Versioned filenames to
  the current workspace output directory (or the user-requested location).
- GDD style: lean spec, plain language, tables/formulas over prose.
- For reward or gift-code work, use the generic
  [`../../game-design/reward_gift_code_config.md`](../../game-design/reward_gift_code_config.md)
  workflow, then map it to SAP's current master-data schema.
