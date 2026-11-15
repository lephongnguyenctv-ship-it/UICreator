---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/05-playbooks/02-dev-sync.md"
---

# Playbook 02 — When the dev pushes commits

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

1. `git log --oneline <last-known>..origin/main` in the game repo (the clone may be fetched but not pulled —
   see [Config mirror & sync](../02-simulator/03_config_mirror_and_sync.md#when-the-game-repo-is-fetched-but-not-pulled));
   summarize with a dev-diff script (commits, CSV row deltas, header changes, new tables, new/removed functions,
   constant changes) before opening any source file. Read the dev's own system docs (`docs/BusinessLogic/*.md`)
   first — they are the cheapest accurate description of a new mechanic.
2. For each commit touching `Assets/Scripts` or `CustomConfig`: read the diff; classify as
   *mechanic change*, *constant change*, *config apply*, *bug fix*, *new table*.
3. Diff the dev CSVs against the mirror (`check-sync` or a quick row-set diff per table). Classify
   differences as "dev applied our proposal", "dev changed something new", "ours not applied yet".
4. **Import** a new baseline `data/baselines/dev-<sha>/` (import-csv into a temp, copy); update
   `DEV_BASELINE`; add a README line describing what the code does at that commit.
5. If the dev changed a schema (new column) → update import/export table lists, re-run import into the
   mirror, then re-run the apply scripts that are still proposals.
6. If the dev changed a mechanic → update `game-engine-constants.json` (`_source` note), the simulator,
   and the constant mapping in `check-sync.js`; add a "state" entry in the decision log.
7. Clean `20-dev-action-items.md`: remove done items, update the header "dev applied…", renumber nothing.
8. Rebuild derived data for both datasets; verify the proposal still meets targets (dev changes often
   shift pacing — e.g. new zombies caused lane leaks Lv25–65).
9. Report: what dev applied, what dev changed on their own, new risks, what remains.
