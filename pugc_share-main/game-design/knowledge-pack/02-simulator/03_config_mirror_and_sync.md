---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/02-simulator/03-config-mirror-and-sync.md"
---

# 03 — Config mirror & dev sync

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

## Mirror format
`data/config/config__<Table>.json` = `{ headers: [...], rows: [[...], ...] }` + `_manifest.json`
(types row, source, category: game / gdd / stale). Keep the dev's header order and type row exactly; the
export must round-trip.

## Import (dev → mirror)
`import-csv.js` reads `<game repo>/Assets/CSV/*.csv` (row 1 headers, row 2 types), converts by type, writes
JSON + manifest. Run it to start a baseline or after the dev changes a schema (new column such as
`SkillPoolId`). Then **re-apply** the proposal scripts on top (they are idempotent) — or, if the dev has
applied everything, the import *is* the new proposal base.

## Export (mirror → dev)
`export-csv.js` writes `data/csv-game/*.csv` (zero-padded ids as the dev's files do). Ship a zip with only
the changed tables + localization additions + `20-dev-action-items.md`.

## check-sync.js
- Diffs mirror vs the game repo's CSVs (lists tables with N differing rows, missing tables, header
  mismatches) → the "dev hasn't applied / new proposal" list.
- Compares `CustomConfig.fcc` constants with `game-engine-constants.json` (a mapping table; remove entries
  when the dev deletes a constant).
- Checks derived-file fingerprints.
Output goes to the "Đồng bộ" page as well.

## Dev action items (`design/20-dev-action-items.md`)
Short, current, only undone work:
- Section A "copy CSV" with ID (e.g. `SKILL-03`), files, 1–3 line what/why, decision reference.
- Section A' "code change" if any, with file/function names from the real repo.
- Section B "open" (bugs, QA checks).
- "Send to dev": the exact list of CSV files.
After each dev commit batch, read the diff, delete done items, list "dev applied" in the header.

## Reading the dev repo
Read-only; use `git log`, `git show <sha>:<path>`, `git grep`. Look at: `CSVIndex` (column order),
`CustomConfig` (constants + comments), `docs/config/*.md` (the dev's own data docs), the system files
named in those docs. Record findings as "state" entries in the decision log (D35/D37/D40/D41/D49…).

## When the game repo is fetched but not pulled
The designer's clone may sit on an old `HEAD` while `origin/main` has the new commits. Do not checkout/pull a
repo you were told is read-only. Instead:
- summarize with `dev-diff <lastBaselineSha> origin/main`;
- extract CSV/contracts with `git archive origin/main Assets/CSV Assets/Scripts/Contracts | tar -x -C /tmp/x` and
  run the import against that folder;
- give `check-sync` a revision (`GAME_REV=origin/main`) instead of hard-coding `HEAD`;
- build the new baseline by importing, copying the mirror into `baselines/dev-<sha>/`, then restoring the proposal
  tables you had already changed.
New tables (e.g. `SpecialZombieData`) must be added to both the import and export lists.
