---
name: pure-game-design-rules-emergence-information
description: Detail of Systems, Rules & Cybernetics (Salen & Zimmerman) — the three levels of rules, emergent vs. scripted design with heuristics, and information structures.
type: game-design-foundations
domain: game-design-theory
status: authoritative
version: 1.0.0
last_updated: 2026-11-03
---

# Rules Levels, Emergence & Information Structures

> Detail file of [Systems, Rules & Cybernetics](systems_and_cybernetics.md) — read that file first. Content moved verbatim on
> 2026-11-03 to keep the parent short; section numbers (§) refer to the parent's numbering.

## 2. The Three Levels of Rules

Every game possesses three distinct layers of rules. Confusion between these layers causes major bugs, player disputes, and balance collapses.

```
┌────────────────────────────────────────────────────────┐
│   IMPLICIT RULES (Unwritten social etiquette, honor)   │
│  ┌──────────────────────────────────────────────────┐  │
│  │   OPERATIONAL RULES (Player-facing instructions) │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ CONSTITUTIVE RULES (Mathematical logic)    │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

| Rule Layer | Nature | Examples | Design Risk |
|---|---|---|---|
| **Constitutive Rules** | The underlying formal, mathematical, and logical structure of the game. Abstract state transitions. | The exact formulas: $\text{Damage} = (\text{ATK} \times 1.5) - \text{DEF}$; state tree in Tic-Tac-Toe. | Numerical overflow, infinite loops, divide-by-zero, unintended edge cases. |
| **Operational Rules** | The guidelines presented directly to the player. How to play, turn order, physical card text, HUD instructions. | "Roll 2 dice and move that many spaces"; "Press R to reload"; "First to 10 points wins." | Ambiguous phrasing, contradictory rules text, excessive cognitive density. |
| **Implicit Rules** | The unwritten social contract, sportsmanship, and behavioral conventions. | Not screen-peeking in split-screen; not rage-quitting when losing; waiting your turn politely. | Griefing, toxic behavior, exploiting loopholes that violate the spirit of play. |

## 4. Emergent Systems vs. Scripted Design

Salen & Zimmerman contrast two approaches to game creation:

1. **Embedded / Scripted Systems:**
   - Every state and event is pre-authored by the designer (cutscenes, scripted QTEs, rigid puzzle solutions).
   - High initial spectacle, zero systemic replayability.

2. **Emergent Systems:**
   - Simple rules govern primitive objects, allowing unexpected, unscripted behaviors and strategies to emerge from player interaction.
   - Example: Chess has only 6 piece types, yet yields infinite distinct games.
   - Example: Physics-based sandboxes where fire spreads, water conducts electricity, and wind pushes objects.

### Heuristics for Generating Emergence:
- **Coupled Variables:** Avoid isolated variables. If variable A changes, let it influence variables B and C.
- **Orthogonal Verbs:** Give players verbs that operate across different dimensions (e.g., *push*, *freeze*, *magnetize*) rather than narrow verbs (e.g., *open door with key #3*).
- **Symmetric Application:** Ensure game rules apply to players and NPCs alike. If fire burns the player, fire must also burn the enemy and the wooden environment.

## 6. Information Structures

How information is distributed across players dictates strategy, paranoia, bluffing, and risk management.

```
                     ┌───────────────────────────────┐
                     │      INFORMATION HORIZON      │
                     └───────────────┬───────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌─────────────────────┐                             ┌─────────────────────┐
│ Perfect Information │                             │Imperfect Information│
│ (All state visible) │                             │ (Hidden state/fog)  │
│  e.g., Chess, Go    │                             │ e.g., Poker, Starcraft
└─────────────────────┘                             └─────────────────────┘
```

1. **Perfect & Complete Information:**
   - Every player sees the entire game state at all times (e.g., Chess, Checkers).
   - *Gameplay focus:* Pure calculation, foresight, pattern recognition, and tactical execution.
2. **Imperfect Information (Hidden State):**
   - Portions of the game state are hidden from some or all players (e.g., fog of war, facedown cards, secret objectives).
   - *Gameplay focus:* Deduction, risk estimation, scouting, bluffing, and psychological warfare.
3. **Asymmetric Information:**
   - Player A knows information that Player B does not, and vice versa.
   - *Gameplay focus:* Social deduction, trading, negotiation, and asymmetric counter-play.
