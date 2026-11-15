---
name: craftland-platform-primer
description: Detail of the Craftland Game Design Assistant — platform constraints and their design implications (scripts, server-side value, persistence, 6-player rooms, distribution) plus the unmatchmade room model and mixed-progression design tools.
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-11-03
---

# Craftland Platform Primer & Room Model

> Detail file of [Craftland Game Design Assistant](craftland_game_design.md) — read that file first. Content moved verbatim on
> 2026-11-03 to keep the parent short; section numbers (§) refer to the parent's numbering.

## 1. Craftland Platform Primer

The table records Craftland context and its design implications. Distinguish technical limits from audience assumptions and recommendations using the entrypoint's context rules. Check source/version when a capability or limit determines feasibility; this reference alone does not establish that every platform claim is current. Apply only to Craftland projects.

| Constraint | Why it matters |
|---|---|
| No custom 3D art pipeline — terrain tools + 4 reused asset categories (objects, buildings, structures, decorations) | Visual differentiation comes from spatial composition, lighting/FX, and logic-driven presentation — not new assets. |
| Logic layer: visual block-script editor (Event → Conditions → Behavior → Modules → Data → Variables → Function → External Call) + a text-based UGC code language (VS Code plugin available) | Anything beyond terrain is scripted — mechanics, modes, and economies all live here. |
| Global scripts (match/event-wide state) vs. Player scripts (per-player state) | Shop rotation timers and event-wide currency pools are global; a player's gem balance, inventory, or pity counter is per-player. Mixing these up is the most common source of exploitable bugs. |
| Server- vs. client-side tags | Anything gating fairness or value (currency grants, drop rolls, shop stock, match outcomes) **must** run server-side. Client-side logic for anything valuable is a dupe/cheat vector. |
| `DispatchEvent` custom events | How cross-system triggers get wired, e.g. "on match end → grant reward → check shop eligibility." |
| Persistent state | Anything meant to survive across sessions (gem balance, unlock progress) requires deliberate save/load handling — don't assume variables persist by default. |
| Base mode: same core engine/controls as standard Free Fire; Clash Squad is the only native ruleset | Anything else is fully custom-built via scripts on top of that base. |
| Room cap = 6 players | Design pacing, team composition, and shared systems (loot contention, shared objectives) around this ceiling, not BR-scale player counts. |
| Distribution: region-locked map codes, public/private visibility, like/subscribe signals; Creation Workshop Card (100 diamonds, 5 free slots) required to create | A precedent for how Garena already gates creation behind a soft paywall — useful when designing a mode's own access/paywall tiers. |
| Creator Program ranking rewards "meaningful updates" (new gameplay, big fixes/redesigns, fresh seasonal content), not just live status | Stale content loses both players and platform visibility — factor this into any post-launch update cadence. |
| Session constraints: mobile SEA audience, short interruptible sessions, 6-player room cap, casual/kid-friendly localization norms (simple VN/ID copy, icon-forward UI) | Pace and onboard for short sessions and small-group dynamics, not BR-scale or desktop-length play. |

### 1.1 Room model and contextual design recommendations

Craftland games are **session-based** (~1 hour rooms, typically 2–6 players)
with **no matchmaking system**. Any player mix can share a room — a day-1
player next to a max-progression veteran. Design implications for every
shared-world feature:

- **Shared-world state needs explicit resolution rules.** Separate room-wide spawns and outcomes from per-player eligibility and rewards where supported. For shared pools, consider *room composition* — enumerate the
  composition states and define behavior per state explicitly (reference
  pattern: SAP's S1–S7 spawn pool states, see
  [`../games/steal-a-pet/systems_reference.md`](../games/steal-a-pet/systems_reference.md)).
- **New/veteran balance is a design problem, not a matchmaking problem.**
  Standard tools:
  - *Anchor floors* — guarantee new players a fixed share of shared
    resources whenever present (e.g. new-player pool anchored at 50% spawn
    share).
  - *Relative participation gates* — eligibility thresholds scale to each
    player's own ceiling (e.g. 30% of own DPS ceiling), never absolute
    values a new player can't reach.
  - *Progression-gated exposure* — adversarial mechanics need protection
    curves for low-progression players inside mixed rooms (e.g. rarity
    ceilings by prestige level).
- **Design recommendation:** winner-take-all rewards can frustrate mixed-progression rooms. Evaluate stakes, consent, consolation rewards, and repeat participation. They may fit a deliberately competitive concept; any game-specific rejection remains part of that game's baseline.
- Room-size neutrality is a design property to verify, not assume: if a
  shared pool scales per head (e.g. HP += 40/player), per-player income is
  room-size-neutral; if it doesn't, room size becomes a hidden multiplier.
