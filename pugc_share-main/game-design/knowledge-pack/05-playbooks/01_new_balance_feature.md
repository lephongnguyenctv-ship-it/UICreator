---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/05-playbooks/01-new-balance-feature.md"
---

# Playbook 01 — Balancing a new (or untouched) system

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

Example runs: Upgrade (D82/D83), Break (D86/D87), Skills (D88), Buffs (D91), Skill pools (D95).

1. **Read the code path** in the dev repo: data loader (`Data/*Data.fcg`), the system (`Systems/*`), the
   constants (`CustomConfig.fcc`), the dev's doc (`docs/config/<Table>.md`). Note: formulas, stat ops,
   caps, what is config vs code, any TODO/placeholder.
2. **State the goal in the designer's words** and check it against the code ("burn coin without being
   imba", "each level must be felt", "rare enough to sell rerolls later").
3. **Model it in the simulator** before tuning (cost formula, priority in the spending loop, logs).
   Add an assumption flag so dev-current behaviour can still be simulated.
4. **Propose with evidence**: a table of before/after numbers, the simulated impact (minutes to level,
   spend share, power %), unlock level with reasoning, and 1–2 alternatives. For structural changes write a
   plan file (`design/NN-*.md`); request review if the current task has not already authorized the change. For visual things: options page.
5. **Apply via a script** `scripts/apply-<id>.js` (idempotent; starts from the dev baseline for the
   affected tables; writes config JSON + names + localization CSV for new strings).
6. **Re-fit dependents**: boss HP (fit.sh), prices (2 rounds), then full rebuild; run `check-sync`.
7. **Build/extend the page** that shows the system (facts script + model + html); add to nav.
8. **Docs**: decision entry (D#), changelog line with version, dev action items (CSV list / code change),
   plan file status updated.
9. **Prepare an export** zip (changed CSVs + localization + action items), named by date/version.
   Copy it to a shared destination only when delivery there is authorized.
10. **Commit** only when authorized by the current task; reply with: what changed, measured effect, open decisions, what dev must do.

Time budget that worked: 2–4 h for a mid-size system including the page.
