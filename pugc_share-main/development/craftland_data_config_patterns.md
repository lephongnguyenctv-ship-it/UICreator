---
name: craftland-data-config-patterns
description: >
  How a data-driven Craftland (Free Fire Craftland Studio, FC/FCG) project stores and loads balance data, and what
  that means for designers and AI agents who tune it without editing code: CSV tables under Assets/CSV (header +
  type rows, CSVIndex column enums, load-time validation that silently drops bad rows), code constants in
  CustomConfig.fcc tuples, level-gating through access/gate tables, virtual items and packs expanded at grant
  time, icon resolution by fileId, dev documentation folders, and the safe workflow (read-only repo, origin/main,
  CSV vs code-change split). Use when reading a Craftland project's config/code to balance it, when deciding
  whether a change is "copy CSV" or "dev changes code", or when a config edit has no visible effect.
type: development
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-10-23
---

# Craftland data & config patterns (for balancing without touching code)

> Observed in a Craftland project built by the VN team (a tower-defense/idle game, repo `PlantsvsZombies`,
> 2026-08 → 2026-10). Table and graph names are **that project's framework**, not Craftland platform APIs —
> check the target project's `Contracts/` and `Data/` folders before relying on any name. Balance methodology
> lives in the [knowledge pack](../game-design/knowledge-pack/README.md); UI files in
> [UI/UX Mockup](ui_ux_mockup.md).

## 1. Where values live

| Kind of value | Location | Who changes it | Delivery |
|---|---|---|---|
| Content & balance tables (items, plants, enemies, shop, missions, skills, loot…) | `Assets/CSV/<Table>.csv` | designer/agent proposes | dev copies CSV (no code change) |
| Tunable code constants (spawn timing, fight window, refund %, chances…) | `Assets/Scripts/Contracts/CustomConfig.fcc` — `tuple XxxConfig { Field type = default }` with comments; read through getters in `Data/GameConfig.fcg` | dev | **code change** — list it separately for the dev |
| Mechanics/formulas | `Assets/Scripts/Systems/**`, `Data/*Data.fcg` loaders | dev | code change |
| Asset registration (sprites, prefabs) | `ProjectSettings/ResourceRegisteration.asset` + `*.meta` | dev/artist | — |
| UI layouts | `Assets/UI/*.ui` (JSON entity trees) | dev | see [UI/UX Mockup](ui_ux_mockup.md) |
| Dev's own docs | `docs/config/<Table>.md` (column meaning), `docs/BusinessLogic/*.md` (per-system behaviour) | dev | read these first |

Rule for proposals: always split the delivery into **(A) CSV files to copy** and **(B) constants/code to change**.
A value you "changed" in a mirror of `CustomConfig` does nothing until the dev edits code.

## 2. CSV conventions
- Row 1 = header, row 2 = data types (`int`, `string`, `float`), data from row 3 (`index 2`). Files may start
  with a UTF-8 BOM; ids may be zero-padded (`00001`) — both parse as the same int.
- Loaders read `CSVData.ReadCSV(EResCSV.<Table>)` and access columns by an enum in `Contracts/CSVIndex.fcc`
  (`rowData[XxxCSVIndex.Field as int]`). **Column order must match the header**; a new column needs a matching
  `CSVIndex` change, so it is a code change too.
- Rows with the wrong column count are skipped (`Length` guard).
- **Load-time validation drops invalid rows** with only a log error (example: a skill row with a parameter out of
  its allowed range is not registered). Symptom: "I changed the CSV but the item vanished / nothing happened".
  Read the loader's validation function before proposing values (allowed ranges, required zero params).
- List-in-a-cell formats are common: `id:weight|id:weight` pools, `Stat:Operation:Magnitude;…` modifier specs,
  `key;key` unlock lists. Keep separators exactly.

## 3. Level gating through data
The project gated almost everything through two tables:
- `ProgressionAccessData`: `AccessKey` (e.g. `feature.teleport.garden`, `shop.basic.seed_cracked`,
  `zombie.element_water`) → `ExposureGateSetKey` (shown/previewed) and `UseGateSetKey` (usable).
- `ProgressionGateData`: `GateSetKey` (e.g. `gate.boss_level_04`) → requirement type + required value.
- Other tables reference access keys (`ShopSlotData.AccessKey`, `ZombieData.UnlockKeys`, `ActiveSkillData.AccessKey`,
  `BossLootData.AccessKey`). Moving an unlock = changing one gate key in the access table.
Cross-table check after any change: steps that require an item/feature (missions, tutorial) must come after its
use level ([unlock-order integrity](../game-design/knowledge-pack/01-balance/01_progression_pacing.md#unlock-order-integrity-d98)).

## 4. Items, packs and rewards
- Low ids are **virtual items** (coin, "random seed", "seed bag I…V", "plant box"). Virtual packs are expanded at
  grant time from `ItemPackData` (`PackId, ContentItemId, Weight, MinQty, MaxQty`) before the reward is granted
  and shown. Value a pack by its expected contents, not by its name.
- Reward tables reference ids only; a wrong id fails at grant time, not at load — validate references offline.
- Special rules can live in code (e.g. "target 00001 = coin × kill money, floored"); read the granting function.

## 5. Assets
- Sprites are resolved by **`fileId`** (registration entry ↔ `.png.meta`), not by the `filePath` text, which can
  be stale. Do not report "missing icon" from a path mismatch alone — check the fileId.
- A key referenced in CSV but absent from the registration shows as an empty icon (example: an unlock popup
  referencing an unregistered `Icon_Recycle`). Cross-check sprite keys after the dev adds features.

## 6. Runtime facts worth checking before balancing
- Server-authoritative, per-player state; caps such as "max 12 live enemies per player" or "one special alive"
  change effective throughput — find them in the state/spawner graphs.
- Avoid proposals that need new persistent storage unless necessary; a design that is computed from config and
  existing state (e.g. a converter with no saved points) is safer and faster for the dev.
- Engine stat operations are usually `Flat`, `IncreasePct` (additive), `MorePct` (multiplicative); match the
  operation, not just the number.

## 7. Working with the dev repo safely
- Treat the game repo as **read-only**: `git log`, `git show <rev>:<path>`, `git grep`, `git archive`. No checkout,
  pull or edits unless the owner asks.
- The local clone may be fetched but not pulled: compare against `origin/main`, extract CSVs with
  `git archive origin/main Assets/CSV | tar -x -C <tmp>` (details:
  [config mirror & sync](../game-design/knowledge-pack/02-simulator/03_config_mirror_and_sync.md#when-the-game-repo-is-fetched-but-not-pulled)).
- Summarize a commit batch before reading source: commits, CSV row deltas, header changes, new tables,
  new/removed functions, `CustomConfig` diffs.

## Related
- [Game Balance & Visualization Knowledge Pack](../game-design/knowledge-pack/README.md) — mirror, simulator, pages, playbooks.
- [Reward & Gift-Code Configuration](../game-design/reward_gift_code_config.md) — reward schema discovery and audits.
- [Code Review](code_review.md) — read-only review contract for FC code.
