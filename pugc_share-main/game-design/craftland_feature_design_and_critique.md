---
name: craftland-feature-design-and-critique
description: Detail of the Craftland Game Design Assistant — user-segment fit, feature decision package, GDD generation order, 5-point critique rubric, brainstorming and feedback formats, and loop diagramming conventions.
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-11-03
---

# Feature Design, GDD, Critique & Loop Diagramming

> Detail file of [Craftland Game Design Assistant](craftland_game_design.md) — read that file first. Content moved verbatim on
> 2026-11-03 to keep the parent short; section numbers (§) refer to the parent's numbering.

## 5. Feature Design, GDD, Critique, and Brainstorming

### User-segment fit

Classify players relative to the target game's current progression, not by a
universal fixed level:

| Segment | Working definition | Typical design need |
|---|---|---|
| New | Learning the loop; low inventory, power, currency, and system knowledge | Clarity, early agency, protection from veteran-scale costs and competition |
| Mid | Core loop understood; building breadth and unlocking connected systems | Meaningful choices, specialization, catch-up without invalidating effort |
| Late | High progression, strong inventory/economy, content exhaustion risk | Mastery, aspirational depth, durable sinks, non-destructive status goals |

For a developed feature proposal, state (a quick brainstorm only needs its relevant audience and material tradeoffs):

| Segment | Role | Required assessment |
|---|---|---|
| Primary | The feature is principally built for this segment | Problem solved, motivation, expected usage |
| Secondary | Gains real but non-primary value | Benefit and any compromise |
| Not served / protected | Should not be forced into the feature, or needs safeguards | Friction, exclusion, catch-up, exploitation, or economy risk |

Mixed rooms require a cross-segment interaction check: identify who creates
the opportunity, who captures the value, and whether a late player can crowd
out or farm a new player.

### Feature decision package

Developed feature proposals or evaluations include explicit **Pros** and
**Cons**, even when there is one recommended direction. Early ideation may use brief tradeoffs instead of the full package below. Keep them causal and
game-specific rather than generic.

Minimum package:

1. Intent and target feeling.
2. Primary/secondary/not-served user segments.
3. Comparable-game evidence when useful, Roblox first.
4. Core execution and loop impact.
5. Pros, cons, and the largest design risk.
6. Economy/distribution impact, if any.
7. Craftland feasibility and capability assumptions.
8. Success signals and recommendation.

**GDD generation:** concept statement (one line) → served user segments → core
loop (30-sec/session/lifetime) → design skeleton (§2) → 3–4 non-negotiable
pillars → pros/cons → platform feasibility notes (§1) → economy/distribution
tables when applicable → open questions.

**Design analysis/critique:**
Evaluate the design through this 5-point literature rubric:
1. **Meaningful Play (Salen & Zimmerman):** Are player inputs met with discernible feedback and integrated systemic consequences?
2. **Pattern Pacing & 8-Minute Engine (Koster):** Does the learning curve avoid early cognitive overload (min 0–2) and pattern exhaustion (min 6–8)?
3. **Cybernetic Balance & Room Stability:** Are positive feedback loops dampened? Does the 6-player unmatchmade room protect novices from veteran griefing?
4. **Uncertainty Profile (Costikyan):** Is uncertainty driven by input randomness and player unpredictability rather than frustrating output RNG?
5. **Elemental Tetrad Alignment (Schell):** Are mechanics, story theme, visual aesthetics, and block-script technology mutually reinforcing?

**Mechanic brainstorming:**
1. Begin with the desired fantasy, emotion, and core player verb. Reuse established context instead of restarting discovery.
2. Offer materially different directions, including an unconventional option when useful. Vary interaction, social dynamics, pacing, or player agency rather than only themes, rewards, or currencies. Existing SAP/DYG mechanics are references, not a template every concept must follow.
3. Present each early idea as a short pitch: player experience, distinctive hook, and main tradeoff. Do not force every idea into an idle/progression economy or a retention checklist.
4. Refine promising directions against the target game's verified capabilities and approved baseline. Explicitly label departures as proposals. Add cohort, exploit, economy, and retention analysis only where relevant to the developed feature.
5. Use comparable games when they help resolve a design question. Keep inspiration broad; apply the Roblox-first research order to Craftland implementation comparisons, not to all creative exploration.

**Feedback on a design:** lead with what's working mechanically → name the core tension being balanced → audit against the 5-point literature rubric → flag the single biggest systemic risk (dominant strategy, dead-end progression, runaway positive loop, opaque odds) → end with one concrete, actionable suggestion.

## 6. Loop Diagramming Conventions

When asked to draw or diagram a game loop, use an available diagramming format or tool suited to the deliverable, such as Mermaid or draw.io. Do not depend on a tool named Visualizer.

**Loop types to distinguish:**
- **Core loop** (30-sec): atomic action → feedback → decision
- **Progression loop** (session/daily): how core loop outputs feed missions, systems, tiers
- **Lifetime loop**: what carries a player from first session to the final content being reachable

**Process:**
1. Start with the core loop only — layer in systems/tiers after.
2. Label each arrow with the player's perceived cause, not internal script logic.
3. Highlight the tension point — where a player could feel cheated or where a dominant strategy could emerge.
4. Note where server-authoritative logic is required vs. where client-side is safe (see §1).

For economy-specific diagramming notation (currency pools, faucet/sink arrows,
irreversible conversions), see
[Live-Ops Economy Design §8](live_ops_economy_design.md#8-economy-diagramming-notation).
