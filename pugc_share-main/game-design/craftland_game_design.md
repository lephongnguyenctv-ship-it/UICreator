---
name: craftland-game-design-assistant
description: General Game Designer assistant/reference for Craftland (Free Fire UGC) work — brainstorming, comparable-game research with Roblox priority, feature design, New/Mid/Late user fit, explicit pros/cons, balancing, GDD writing and critique, platform constraints, operationalized design-theory lenses (Schell, Salen & Zimmerman, Koster, Costikyan, Pulsipher), and loop diagramming. Use for any Craftland game/mode/event design task. Routes pure/platform-agnostic game design questions to foundations/, and specialized economy, reward/gift config, burn-rate, and tag-viability work to their dedicated references.
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.4.0
last_updated: 2026-11-03
---

# Craftland Game Design Assistant

> General reference for designing any Craftland mode/event, targeting SEA
> mobile markets.
>
> - **Pure / Platform-Agnostic Game Design:** For universal game design literature,
>   112 lenses, cybernetics, fun theory, uncertainty taxonomies, or non-Craftland
>   game critique $\to$ read [`foundations/README.md`](foundations/README.md).
> - **Specialized References:** Load only when relevant:
>   [Game Tag Success Analysis](game_tag_success_analysis.md) for genre viability,
>   [Live-Ops Economy Design](live_ops_economy_design.md) for economy depth,
>   [Reward & Gift-Code Configuration](reward_gift_code_config.md) for config/distribution,
>   and [Money Rank Value](../general-knowledge/large_number_notation.md) for packed money.
>   Session/retention targets follow [Tier List Definition](../general-knowledge/tier_list_definition.md).

## 0. Task Mode & Working Behavior

Apply the [context and decision rules](../SKILL.md#context-and-decision-rules) first.
- **Pure Game Design requests:** If the task asks about general game design, board/tabletop games, PC/console mechanics, or abstract game theory, immediately defer to the pure literature in [`foundations/`](foundations/README.md) and do NOT apply Free Fire Craftland platform constraints.
- **Craftland UGC requests:** Apply the Craftland platform primer (§1) and the domain-adapted literature frameworks (§4). Use genre-agnostic creative methods: verb-first design, experience-first MDA, unexpected combinations, and meaningful player choices. Bring in Craftland constraints only where they apply to the target project.

Infer the lightest mode that satisfies the request. Do not force GDD production
or a long questionnaire when the user only wants ideas, research, or a balance
opinion.

| Mode | Default outcome |
|---|---|
| Brainstorm | Distinct directions sized to the request (usually 3), target fantasy/feeling, core verb, hook, and brief tradeoffs; detailed segment/balance work follows selection |
| Research | Evidence-backed comparable games and transferable execution lessons |
| Feature design | Decision-ready feature package defined in §5 |
| Balance | Current data, assumptions, cohorts, calculations/simulation, distribution impact, verdict |
| Critique | What works, core tension, largest risks, concrete improvement |
| GDD | Lean table-first specification only when requested or clearly needed as the deliverable |

Use internal files as working context, not homework for the user. Do not tell
the user to check with a named teammate unless they explicitly ask for an
owner, handoff, or escalation. When implementation capability is unknown:

1. State the exact unknown and the assumption used.
2. Continue all design work that does not depend on it.
3. Label affected options `requires capability confirmation` instead of
   redirecting the task.

### Comparable-game research order

For a feature or mechanic that benefits from external precedent, search in
this order unless the user asks otherwise:

1. **Roblox games with similar execution** — prioritize how the mechanic is
   actually played, surfaced, paced, and monetized, not just a shared genre tag.
2. **Other UGC or live-service games** with the same player behavior or
   economy role.
3. **Broader game analogues** when closer matches do not exist.

Research current sources; distinguish direct evidence from inference. Return a
compact comparison table with: game/platform, similar execution, observed
strength, failure/risk, what transfers to Craftland, what does not, and source.
Do not copy a feature wholesale: extract the design principle and re-evaluate
it against Craftland's room, audience, control, and scripting constraints.

## 1. Craftland Platform Primer

Platform constraints (block-script logic, global vs player scripts, server-side value, persistence, 6-player rooms, distribution, Creator Program) and the room model: no matchmaking, anchor floors, relative gates, progression-gated exposure. Apply to every Craftland UGC request. → [Details](craftland_platform_primer.md#1-craftland-platform-primer)

## 2. Concept-to-Live Workflow

A generalized 0→1 process for any Craftland mode or event.

| Stage | What happens | Gate before moving on |
|---|---|---|
| 1. Concept, Target Feeling & Users | One sentence: what this does that the base game doesn't. Name a specific target aesthetic and classify who it primarily serves: New, Mid, Late, or a deliberate combination. | State the primary, secondary, and not-served segments; do not call a feature "for everyone" without differentiated value. |
| 2. Comparable Research & Design Skeleton | When precedent would improve the decision, research similar execution using §0's Roblox-first order. Sketch the core loop and dependent systems. State pros, cons, and rejected/less suitable alternatives. If the concept needs a currency/reward economy, use [Live-Ops Economy Design](live_ops_economy_design.md). | Evidence and a loop/table must exist before scripting; record what transfers and what does not. |
| 3. Platform Feasibility Check | Walk the skeleton against §1: does it need save/load handling, a global timer script, server-authoritative logic? | Flag anything expensive/fragile to implement before committing on paper. |
| 4. Gray-Box Prototype | Build the smallest working version in Craftland: one core loop, minimal systems. | The core loop (verb → feedback → tension) must feel right before layering content on top. |
| 5. Balance & Distribution Pass | Apply §3 explicitly. For economy-affecting work, include distribution coverage and a quantitative faucet/sink ledger through [Reward & Gift-Code Configuration](reward_gift_code_config.md), then run burn/simulation checks when applicable. Translate large values both ways using the canonical notation. | Segment outcomes and pros/cons are explicit; no important faucet, sink, gate, or fastest-burner effect is hidden. |
| 6. Live Monitoring & Iteration | Define what counts as a "meaningful update" vs. a minor hotfix, tied to retention dashboards. | Aligns with Creator Program ranking logic (§1) — stale content loses visibility. |

## 3. Game Balance Principles (Rollings & Morris)

| Principle | Meaning |
|---|---|
| Compensating factors | Only work if visible **before** the decision. A hidden mechanic or undisclosed odds isn't balance — it's a trust-eroding trap. |
| Impermanence | Keeps content feeling alive. Permanent top-tier options compress the possibility space; time-limited or rotating options keep choices live. |
| Dominant strategies | Balance killers — if one option is always optimal, every other option becomes irrelevant. Test explicitly against every alternative. |
| Asymmetric balance | Different options don't need equal power — they need equivalent **viability** for their cost, not equivalent capability. |

See [Live-Ops Economy Design §8](live_ops_economy_design.md) for how these apply specifically to shop pricing, pity systems, and item tiers.

## 4. Core Design-Theory Lenses & Craftland Domain Adaptations

Apply universal literature frameworks (found in [`foundations/`](foundations/README.md)) adapted specifically to Craftland's 6-player, mobile SEA, block-script environment:

| Framework | Literature Source | Pure Foundation | Craftland UGC Domain Adaptation |
|---|---|---|---|
| **Elemental Tetrad** | Schell | [`foundations/core_lenses_and_principles.md`](foundations/core_lenses_and_principles.md#1-the-elemental-tetrad-schell) | "Technology" is the visual block-script engine + mobile device limits. Never design a mechanic that requires high-frequency client physics or desktop-style hotkeys. |
| **Meaningful Play** | Salen & Zimmerman | [`foundations/systems_and_cybernetics.md`](foundations/systems_and_cybernetics.md#1-meaningful-play) | Every tap must yield **discernible** feedback (audio/visual juice, floating numbers) and **integrated** outcome (feeds session or lifetime loop). |
| **Cybernetic Loops** | Salen & Zimmerman | [`foundations/systems_and_cybernetics.md`](foundations/systems_and_cybernetics.md#3-cybernetics--feedback-loops) | Unchecked positive feedback destroys unmatchmade rooms. Dampen leader advantage via anchor floors; provide skill-based negative feedback (catch-up) for trailing rookies. |
| **Pattern Mastery & Fun** | Koster | [`foundations/fun_and_cognitive_pacing.md`](foundations/fun_and_cognitive_pacing.md#1-the-core-thesis-fun-as-pattern-mastery) | Fun is the brain grokking patterns. Prevent the 8.1m T4 churn cliff by sequencing verbs using the 8-Minute Retention Engine below. |
| **Sources of Uncertainty** | Costikyan | [`foundations/uncertainty_and_tension.md`](foundations/uncertainty_and_tension.md#2-the-10-sources-of-uncertainty-costikyans-taxonomy) | Favor *Input Randomness* (random spawns to adapt to) over *Output Randomness* (random failure on action). Lean heavily on *Player Unpredictability* in 6-player rooms. |
| **Process & Scope** | Pulsipher | [`foundations/core_lenses_and_principles.md`](foundations/core_lenses_and_principles.md#2-the-process-of-design--scope-discipline-pulsipher) | Gray-box in-engine early. Prune secondary currencies and mechanics that do not serve the core loop. |

### 4.1 The 8-Minute Retention Engine (Beating the T4 Churn Cliff)

T4 maps lose players at 8.1 min: teach one verb in min 0–2 with zero text, add a second verb/obstacle in min 3–5, trigger a room-wide twist or meta hook by min 6–8. → [Details](craftland_retention_and_room_dynamics.md#41-the-8-minute-retention-engine-beating-the-t4-churn-cliff)

### 4.2 Unmatchmade 6-Player Room Dynamics

Novices and veterans share rooms; mandatory guardrails: anchor floors, asymmetric vulnerability for apex rewards, consolation/safe zones. → [Details](craftland_retention_and_room_dynamics.md#42-unmatchmade-6-player-room-dynamics)

---

## 5. Feature Design, GDD, Critique, and Brainstorming

User-segment fit (New/Mid/Late; Primary/Secondary/Not-served), the 8-item feature decision package with explicit pros/cons, GDD order, the 5-point literature critique rubric, brainstorming and feedback formats. → [Details](craftland_feature_design_and_critique.md#5-feature-design-gdd-critique-and-brainstorming)

## 6. Loop Diagramming Conventions

Distinguish core (30 s), progression and lifetime loops; start with the core loop, label arrows with player-perceived causes, mark tension points and server-authoritative logic. → [Details](craftland_feature_design_and_critique.md#6-loop-diagramming-conventions)

## 7. Design Process Notes (Pulsipher)

- Prototype early, ugly, in-engine — a gray-box with real block-script logic reveals feasibility problems a paper design never will.
- Know the audience before designing: SEA mobile casual ≠ hardcore PC — pacing, onboarding, text density should reflect that.
- Treat the first tuning pass as a hypothesis; live data is the experiment.
- Scope is a design decision — overscoping (too many systems/tiers/currencies) is the most common failure mode; cut to what the core loop needs first.


## Related quantitative workflow

For config-driven balance, whole-game player simulation, dev-sync, visualization pages
and recurring balance/playtest checklists, use the [Game Balance & Visualization Knowledge Pack](knowledge-pack/README.md).
Treat the source project as a worked example and retain the platform/context and player-segment
decision rules in this file.
