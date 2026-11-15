---
folder: Game Design
title: Game Design — Skills & Knowledge
domain: craftland-ugc
status: authoritative
version: 1.10.0
last_updated: 2026-11-03
---

# Game Design

Skills & knowledge for **game designers** working on Craftland/UGC and pure game mechanics.

## Scope
- **Pure Game Design Foundations**: Literature-backed game design principles, cybernetics, feedback loops, cognitive fun theory, and uncertainty taxonomy (Schell, Salen & Zimmerman, Koster, Costikyan, Pulsipher) for any game medium.
- **Craftland/UGC Gameplay Design**: Platform-adapted mode/loop design, 6-player unmatchmade room dynamics, 8-minute retention pacing, rules, balancing, progression, rewards.
- **Config-driven Balance & Visualization**: Player simulation, progression/combat/economy worked examples, proposal-vs-dev config sync, an internal balance website, icon references and recurring playbooks in [`knowledge-pack/`](knowledge-pack/README.md).
- **Player Experience**: Cognitive onboarding, difficulty curve, pacing, replay motivation.
- **Design References & Conventions**: Used to plan, prototype, critique, and iterate on game modes.

## What belongs here
- ✅ Design-side skills & knowledge (how a mode should play, why it works).
- ✅ Pure, platform-agnostic design foundations (in [`foundations/`](foundations/README.md)).
- ❌ Building/implementing the map → see [`../development`](../development/README.md).
- ❌ Performance/scaling decisions after launch → see [`../publishing`](../publishing/README.md).
- ❌ Shared canonical definitions (e.g. tier rules) → see [`../general-knowledge`](../general-knowledge/README.md).

## Related shared knowledge
- Design targets map to performance ranks defined in the
  [Tier List Definition](../general-knowledge/tier_list_definition.md)
  (e.g. survival-time and R2 goals a mode should aim for).
- Packed economy values use the canonical
  [Money Rank Value](../general-knowledge/large_number_notation.md) conversion
  for Rank Value ↔ Money/Suffix/Display translation.

## Reference archive

`game-design.skill` is a legacy source archive, not an active dependency or an alternative entrypoint. Use the maintained Markdown references below; do not load the archive as additional instructions.

## Contents

| Skill / Knowledge | File | Purpose |
|---|---|---|
| **Pure Game Design Foundations** | [`foundations/README.md`](foundations/README.md) | Platform-agnostic foundational theory module synthesized from canonical literature (Schell, Salen & Zimmerman, Koster, Costikyan, Pulsipher). Use for non-Craftland or abstract design. |
| ↳ Core Lenses & Principles | [`foundations/core_lenses_and_principles.md`](foundations/core_lenses_and_principles.md) | Schell's Elemental Tetrad, 35 curated deep-dive interactive lenses, complete 112 lenses master index, and Pulsipher's prototyping and scope discipline. |
| ↳ Systems & Cybernetics | [`foundations/systems_and_cybernetics.md`](foundations/systems_and_cybernetics.md) | Salen & Zimmerman's Meaningful Play, rules levels, cybernetic feedback loops (positive/snowball vs. negative/stabilizing), emergent systems, and degenerate strategy fixes. |
| ↳ Fun & Cognitive Pacing | [`foundations/fun_and_cognitive_pacing.md`](foundations/fun_and_cognitive_pacing.md) | Raph Koster's fun as pattern grokking, cognitive chunking, failure states (boredom from exhaustion vs. confusion from noise), verb teaching progression. |
| ↳ Uncertainty & Tension | [`foundations/uncertainty_and_tension.md`](foundations/uncertainty_and_tension.md) | Greg Costikyan's 10 sources of uncertainty, input vs. output randomness, and crafting dramatic uncertainty profiles. |
| **Craftland Game Design Assistant** | [`craftland_game_design.md`](craftland_game_design.md) | Craftland context layer: domain-adapted theory (8-Minute Retention Engine, 6-player unmatchmade room dynamics), brainstorming, Roblox-first research, balancing, GDD/critique, New/Mid/Late fit, pros/cons, and platform constraints. |
| ↳ Platform Primer & Room Model | [`craftland_platform_primer.md`](craftland_platform_primer.md) | Platform constraints and design implications; unmatchmade room model, anchor floors, relative gates, progression-gated exposure. |
| ↳ Retention Engine & Room Dynamics | [`craftland_retention_and_room_dynamics.md`](craftland_retention_and_room_dynamics.md) | 8-Minute Retention Engine (verb pacing vs. the T4 churn cliff) and 6-player room guardrails. |
| ↳ Feature Design, GDD & Critique | [`craftland_feature_design_and_critique.md`](craftland_feature_design_and_critique.md) | User-segment fit, feature decision package, GDD order, 5-point critique rubric, brainstorming, loop diagramming. |
| Reward & Gift-Code Configuration | [`reward_gift_code_config.md`](reward_gift_code_config.md) | Cross-game workflow for RewardData/GiftData-style configs. Discovers each game's native structure, reuses reward definitions, validates references and gift rules, and produces distribution coverage plus quantitative faucet/sink tables. |
| Live-Ops Economy Design | [`live_ops_economy_design.md`](live_ops_economy_design.md) | Currency/tier layers, earn-rate calibration, rotation shops, drop-rate design, cohort simulation, price gates, and economy prediction. |
| ↳ Live-Ops Event Prediction | [`live_ops_event_prediction.md`](live_ops_event_prediction.md) | Monte Carlo cohort simulation, cohort-ratio calibration, closed-form failure cases, guardrails, warnings checklist, build format. |
| Feature Burn-Rate Balancing | [`feature_burn_rate_balancing.md`](feature_burn_rate_balancing.md) | Pre-release/rebalance check for features with exhaustible content, progression, or rewards: time-to-exhaust per cohort, design-to-fastest-burner rules, faucet throughput benchmarking vs existing pipelines, permanent-vs-event burn rules, post-burn state audit, and the release checklist. |
| Game Balance & Visualization Knowledge Pack | [`knowledge-pack/README.md`](knowledge-pack/README.md) | Imported methodology for progression, economy, power, content, combat, Monte Carlo player models, config mirrors, derived-data rebuilds, visualization pages and playbooks. 2026-10-23: trigger × action skill EV, reward value per hour, converter design, spawn director/special enemies, onboarding unlock-order check, documentation hand-off playbook. Source-game values are worked examples; UI/UX detail files reuse the canonical development method. |
| Game Tag Success Analysis | [`game_tag_success_analysis.md`](game_tag_success_analysis.md) | Data-driven (210 games) analysis of which tags/genres succeed or fail. |
| ↳ Game Tag Evidence by Tag | [`game_tag_evidence_by_tag.md`](game_tag_evidence_by_tag.md) | Per-tag evidence (high-success, middle-tier, high-risk), Social Interaction paradox, Shooting tag problem. |
