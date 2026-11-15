---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/02-simulator/02-derived-data-pipeline.md"
---

# 02 — Derived data pipeline

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

All numbers on the site are *derived files* under `data/` produced by scripts from the config mirror.
Nothing is computed inside pages except presentation.

## Rebuild order (one bash call per step when the sandbox caps calls at ~3 min)
```
1. fit.sh      : combat-levels ×3 with fit-boss-hp between → boss HP fits current DPS
2. pacing-times → apply-price-bands  (×2 rounds; prices depend on coin/min and vice-versa)
3. export-csv   : config JSON → csv-game/*.csv for the dev
4. pacing-times : final
5. combat-levels on data/ and on data/baselines/<dev>/  (proposal vs dev)
6. collection-times → collection-proposal
7. mission-facts
8. content-burn
9. species-times
10. pacing-curves
11. upgrade-facts, break-facts
12. check-sync
```
`rebuild-all.js` runs the same in one go (6–8 min); keep per-step scripts for sandboxes with time caps.

## Fingerprint = staleness detector (D63/D66)
`fingerprint.js` hashes every input that can change an output (+ constants + simulator source,
parameters, cohort assumptions, RNG seed and run settings). Each derived file stores its input fingerprint.
The source implementation excluded price columns to break its fitting loop; do not copy that exclusion
when the spending model reads prices. Use dependency-specific hashes and fit prices/pacing to convergence,
then rebuild final outputs from the final config and fingerprint. Proposal and dev need distinct cache keys.
The server compares on page load and shows a red "data is stale, rebuild" banner with a button.
If a change cannot affect the sim (e.g. an exposure gate used only by UI), restamp instead of rebuilding.

## Baselines
`data/baselines/dev-<commit>/` = the game repo's CSVs imported at that commit + constants as the code has
them. Every API accepts `?dataset=dev` → pages show "Đề xuất / Dev hiện tại" side by side. Create a new
baseline after every dev commit batch that changes mechanics; point `DEV_BASELINE` in `server.js` at it.

## Fit loops
- Boss HP: solve for target kill time, smooth, iterate with combat (DPS depends on affordability).
- Prices: minutes × coin/min, with 10% hysteresis.
- Anything else that depends on sim output (collection reward values, mission thresholds) gets a
  `*-proposal.js` that writes to `data/proposals/` for review before being applied.

## Facts files for pages
`*-facts.json` = pre-aggregated numbers for one page (upgrade-facts, break-facts, mission-facts). Pages
fetch `/api/x` which returns facts + model-computed tables. Keep heavy sim runs out of request handlers
(cache keyed by fingerprint; `onboarding` uses a 130-user cached run).
