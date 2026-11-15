---
folder: Game Design / Foundations
title: Pure Game Design Foundations — Literature & Systems
domain: game-design-theory
status: authoritative
version: 1.1.0
last_updated: 2026-11-03
source_of_truth: true
parsing_notes: >
  This directory holds 100% platform-agnostic, canonical game design knowledge
  synthesized directly from authoritative literature (Jesse Schell, Katie Salen &
  Eric Zimmerman, Raph Koster, Greg Costikyan, Lewis Pulsipher). It contains NO
  platform-specific constraints (no Free Fire, Craftland, or mobile assumptions)
  and can be used for any game: board game, tabletop, PC indie, console, mobile,
  or multi-agent simulation.
---

# Pure Game Design Foundations

> **Platform-Agnostic Game Design Knowledge Base**
> Synthesized from canonical game design literature for professional game designers, system architects, and AI design agents.

## Scope & Purpose

This module provides **pure, author-backed game design frameworks, lenses, and systems theory**. It deliberately avoids platform-specific assumptions:
- **No platform lock-in**: Valid for tabletop games, PC strategy/RPGs, console action games, mobile casual titles, or UGC virtual worlds.
- **Authoritative sources**: Directly distill principles from five classic game design texts:
  1. **Jesse Schell** — *The Art of Game Design: A Book of Lenses (2nd Edition)*
  2. **Katie Salen Tekinbaş & Eric Zimmerman** — *Rules of Play: Game Design Fundamentals*
  3. **Raph Koster** — *A Theory of Fun for Game Design*
  4. **Greg Costikyan** — *Uncertainty in Games*
  5. **Lewis Pulsipher** — *Game Design: How to Create Video and Tabletop Games, Start to Finish*
- **Actionable & Practitioner-Grade**: Every theory is structured into operational checklists, diagnostic rubrics, and concrete structural patterns—never academic filler.

---

## Architecture: Two-Layer Design Model

This module represents **Layer 1 (Pure Foundations)** of the broader game design architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│           LAYER 1: PURE GAME DESIGN FOUNDATIONS (THIS DIRECTORY)       │
│                                                                        │
│   • Schell's Lenses & Elemental Tetrad                                 │
│   • Salen & Zimmerman's Cybernetic Feedback Loops & Rules Levels       │
│   • Koster's Pattern Grokking, Chunking & Fun Engine                   │
│   • Costikyan's 10 Sources of Uncertainty                              │
│   • Pulsipher's Iterative Prototyping & Scope Discipline               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Specialized & adapted by
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│          LAYER 2: DOMAIN ADAPTER (CRAFTLAND / UGC / LIVE-OPS)          │
│                                                                        │
│   • craftland_game_design.md (6-player rooms, 8.1m cliff, block-scripts)│
│   • live_ops_economy_design.md (currency layers, shops, Monte Carlo)   │
│   • feature_burn_rate_balancing.md (fastest-burner math, time-to-exhaust)│
└────────────────────────────────────────────────────────────────────────┘
```

When designing a game:
- Use **Layer 1 (Foundations)** when you need universal design principles, mechanic ideation, system stability analysis, feedback loop auditing, or cognitive pacing for **any game platform**.
- Use **Layer 2 (Craftland Assistant)** when building specifically within Free Fire Craftland UGC, respecting room caps, visual logic constraints, and SEA mobile live-ops.

---

## Contents

| Document | Source Literature | Primary Focus & Deliverables |
|---|---|---|
| [`core_lenses_and_principles.md`](core_lenses_and_principles.md) | Jesse Schell & Lewis Pulsipher | The Elemental Tetrad; Curated Top 35 Interactive Design Lenses with deep diagnostic cards; Complete 112 Lenses Master Index; Pulsipher's prototyping heuristics, hypothesis-driven playtesting, and scope discipline. |
| ↳ [`schell_112_lenses_master_index.md`](schell_112_lenses_master_index.md) | Jesse Schell | Lookup table of all 112 lenses (number, name, core question); detail of the core lenses file. |
| [`systems_and_cybernetics.md`](systems_and_cybernetics.md) | Katie Salen & Eric Zimmerman | Meaningful Play (discernible & integrated outcomes); Operational, Constitutive, and Implicit rules; Positive (amplifying/snowball) vs. Negative (stabilizing/catch-up) feedback loops; Emergence vs. Scripting; Information space (perfect, imperfect, asymmetric). |
| ↳ [`rules_emergence_and_information.md`](rules_emergence_and_information.md) | Katie Salen & Eric Zimmerman | Three levels of rules, emergent vs. scripted design, information structures; detail of the systems file. |
| [`fun_and_cognitive_pacing.md`](fun_and_cognitive_pacing.md) | Raph Koster | Fun as pattern recognition, chunking, and mastery; The anatomy of player failure (boredom from pattern exhaustion vs. frustration from noise/obscurity); Cognitive load pacing; Visceral, social, and intellectual fun. |
| [`uncertainty_and_tension.md`](uncertainty_and_tension.md) | Greg Costikyan | Uncertainty as the engine of agency and drama; The 10 canonical sources of uncertainty (performative, solver, player unpredictability, randomness, analytic complexity, hidden info, etc.); Balancing luck vs. skill; Avoiding arbitrary punishment. |

---

## Navigation & Routing

- For **mechanic brainstorming, player perspective shifts, or game feel review** $\to$ read [`core_lenses_and_principles.md`](core_lenses_and_principles.md).
- For **economy balance, runaway leader prevention, catch-up mechanics, or rules architecture** $\to$ read [`systems_and_cybernetics.md`](systems_and_cybernetics.md).
- For **early player onboarding, difficulty pacing, engagement drops, or player boredom** $\to$ read [`fun_and_cognitive_pacing.md`](fun_and_cognitive_pacing.md).
- For **tension design, randomness vs. skill tuning, PvP mind games, or information fog** $\to$ read [`uncertainty_and_tension.md`](uncertainty_and_tension.md).
- For **Craftland-specific implementation and constraints** $\to$ return to parent [`../craftland_game_design.md`](../craftland_game_design.md).
