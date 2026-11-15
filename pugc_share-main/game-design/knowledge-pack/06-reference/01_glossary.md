---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/06-reference/01-glossary.md"
---

# Glossary

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

| Term | Meaning here |
|---|---|
| Boss Level / account level | Number of bosses defeated + 1; the single progression spine that gates content |
| Charge | Zombie kills needed to summon the next boss (`ChargeTarget`) |
| Fight window | Seconds the boss stays (60 s); win if DPS × time ≥ HP |
| BossHPMultPct | Per-level HP multiplier column fitted by the tool so median kill time ≈ 35 s |
| Early ease | Extra HP multiplier < 1 for Lv1–12 so real newcomers (not bots) can win |
| Soft-cap | `1 + max·x/(x+half)` growth with a ceiling; used for level power, level cost, (optionally) stars |
| Star (merge tier) | 1–5★ via merging two identical plants; multiplicative damage table |
| Break (limit break) | Every 10 levels; coin (+ elemental materials from tier 2); unlocks passive slots at tier 1 and 5 |
| Mutation | Per-plant income multiplier (+5…50% coin) with small combat perk; rolled on growth or via vials |
| Active / passive skill | 1 active (effect × uptime), 2 passives (flat ranges); rolled from a pool per plant |
| Skill pool | `SkillPoolData` row: `id:weight` lists for active/passive; plants point to a pool |
| Seed pool / bag | Gacha item whose `SeedPoolData` lists plant ids + rarity rates; tiers I/II/III per element |
| Hybrid seed | Cheap bag of neutral species with a random element — variety without power |
| Hourly / daily shop | Restock 5 min vs 24 h; daily holds scarce items with stock caps |
| Price band | Item price expressed as minutes of income at its unlock level |
| Hysteresis | Keep an old price if the new one is < 10% different (simulator noise) |
| Mirror | `data/config/config__*.json` proposal copy of the game CSVs |
| Baseline | `data/baselines/dev-<sha>/` snapshot of the game CSVs at a dev commit |
| Fingerprint | Hash of sim inputs stored in derived files; mismatch = stale data banner |
| Facts file | Pre-aggregated JSON for one page (`*-facts.json`) |
| Apply script | Idempotent `scripts/apply-<decision>.js` that writes a decision into the mirror |
| Decision log | `design/00-decisions.md`, entries D1…; statuses CHỐT (final) / VOID / state |
| Dev action items | `design/20-dev-action-items.md`; only undone work; CSV list + code changes |
| Proposal vs dev | Site-wide toggle comparing the mirror with the dev baseline |
| Compact / full mode | Site-wide toggle hiding long explanations (designer wants little text) |
| Scene preview | UI widget overlaid on a real screenshot at a declared anchor |
| Option round | 2–4 visual alternatives rendered together, then consolidated to one |
| Wall | First level where boss win rate drops below 85% without new content |
| Segment | Casual 30 / average 60 / hardcore 120 minutes per day |
| Delta / pressure director | Hidden meter (+kill, −leak) that switches spawn tiers Chill / Steady / Heated / Rush |
| Special (elite) enemy | Rare tankier enemy that drops a reward; valued per hour before shipping |
| Skill EV | % DPS equivalent of a skill row averaged over wave/boss × fast/slow plants |
| Generated facts | Document regenerated from config + simulator with automatic checks; never edited by hand |
| Cold-read test | Fresh agent answers concrete questions from the docs only; gaps are fixed before hand-off |
