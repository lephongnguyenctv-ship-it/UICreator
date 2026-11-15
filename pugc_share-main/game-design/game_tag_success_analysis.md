---
name: craftland-game-tag-success-analysis
description: Data-driven analysis of which game tags/genres succeed or fail in Craftland PUGC, based on 210 released games (2024–2025). Covers success rates, average R2, survival time, failure patterns, and winning formulas per tag. Use when deciding what game mode to build, evaluating a concept's viability, or advising a team on genre risk.
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-11-03
data_source: "[C3][FF][Craftland] PUGC All Game.xlsx — 210 games, 2024–2025"
---

# Craftland Game Tag Success Analysis

> **Data source:** 210 released PUGC games (2024–2025).
> Tier definitions follow the canonical
> [Tier List Definition](../general-knowledge/tier_list_definition.md).
> Tags are multi-valued per game; success/fail rates reflect how often a game
> carrying that tag reaches each tier.

## 1. Overall Difficulty

| Tier | Count | % of Total |
|:---:|---:|---:|
| T0 | 2 | 1% |
| T1 | 2 | 1% |
| T1- | 16 | 8% |
| T2 | 23 | 11% |
| T2- | 32 | 15% |
| T3 | 29 | 14% |
| **T4** | **106** | **50%** |

**Half of all released games are T4 failures.** Survival time is the most
reliable early proxy for eventual tier: T4 games average **8.1 min**; T1-
games average **21 min**. Any design that cannot hold players past 10–12
minutes is on a T4 trajectory.

---

## 2. Tag Reference Table

Sorted by average R2 (minimum 3 games). Success % = T0+T1+T1-. Fail % = T3+T4.

| Tag | n | Avg R2 | Success % | Fail % | Tier Cluster |
|---|---:|---:|---:|---:|---|
| Tycoon | 6 | 37.9% | 66.7% | 0% | T0–T1- dominant |
| FFA | 5 | 31.0% | 40.0% | 20% | T1- dominant |
| Unlimited Gloowall | 10 | 29.9% | 50.0% | 20% | T1–T1- dominant |
| BR-like | 5 | 29.3% | 40.0% | 20% | T1- dominant |
| Clash Squad | 12 | 29.1% | 33.3% | 8.3% | T1–T2 dominant |
| Sniper | 4 | 28.1% | 0% | 0% | T2 cluster |
| Solo | 3 | 27.6% | 66.7% | 33% | Small sample |
| Squad Battle | 4 | 27.4% | 50.0% | 25% | T1- dominant |
| Headshot only | 7 | 27.3% | 57.1% | 28.6% | T1- dominant |
| Deathmatch | 12 | 27.1% | 8.3% | 8.3% | T2 cluster |
| FPS | 3 | 24.1% | 0% | 33% | T2–T2- |
| Simulation | 20 | 21.3% | 20.0% | 50% | Wide spread |
| Horror | 15 | 21.2% | 20.0% | 26.7% | T2 cluster |
| Zombie | 9 | 20.0% | 0% | 33.3% | T2 cluster |
| Hide & Seek | 11 | 20.0% | 0% | 27.3% | T2- cluster |
| Social Interaction | 33 | 19.9% | 12.1% | 48.5% | Bimodal (T0 or T4) |
| Shooting | 97 | 19.3% | 12.4% | 57.7% | T4 dominant |
| Party Game | 36 | 18.7% | 11.1% | 50% | T4 dominant |
| Parkour | 7 | 17.2% | 0% | 57.1% | T4 dominant |
| Trending | 7 | 16.9% | 0% | 57.1% | T4 dominant |
| IP | 12 | 16.8% | 8.3% | 66.7% | T4 dominant |
| Music | 9 | 15.5% | 0% | 55.6% | T4 dominant |
| Racing | 3 | 12.7% | 0% | 100% | T4 only |
| Casual | 29 | 6.9% | 0% | 100% | T4 only |
| Farm | 2 | — | 100% | 0% | T0–T1- (small n) |

---

## 3. High-Success Tags (Invest With Confidence)

Evidence for Tycoon + Farm + Simulation, Unlimited Gloowall + Clash Squad, Headshot Only, FFA + BR-like. → [Details](game_tag_evidence_by_tag.md#3-high-success-tags-invest-with-confidence)

---

## 4. Middle-Tier Tags (Reliable Rotation, Low Ceiling)

Evidence for Deathmatch + Sniper, Horror + Zombie, Hide & Seek + Party Game. → [Details](game_tag_evidence_by_tag.md#4-middle-tier-tags-reliable-rotation-low-ceiling)

---

## 5. High-Risk Tags (Strong Evidence of Failure)

Evidence for Casual, IP/Trending, Music/Concert, Parkour, Racing. → [Details](game_tag_evidence_by_tag.md#5-high-risk-tags-strong-evidence-of-failure)

---

## 6. The Social Interaction Paradox

Why Social Interaction games split bimodally between T0 and T4. → [Details](game_tag_evidence_by_tag.md#6-the-social-interaction-paradox)

---

## 7. The Shooting Tag Problem

Why the most common tag (Shooting, 97 games) is T4-dominant and what separates its winners. → [Details](game_tag_evidence_by_tag.md#7-the-shooting-tag-problem)

---

## 8. Winning Formulas (Evidence-Based)

Five design patterns with T1 or better outcomes in the dataset:

| Formula | Example | Tier | Key Ingredients |
|---|---|:---:|---|
| Tycoon loop + Social layer | FreeGarden, StealAPet | T0 | Compulsion loop, progression, multiplayer competition |
| Known CS mechanic + 1 dramatic twist | OldPeakRamadan, GlooWar | T1 | Low friction entry, strategy-changing rule |
| Structured shooting (FFA/BR) on familiar map | HarborTown, BermudaDuosquad | T1- | Clear arc per session, tension, replay |
| Horror/Escape with clear objective | NightmareEscape, EscapeHorrorTown | T1- | Narrative tension + puzzle/escape loop |
| IP + deep gameplay system | SquidGameVN | T1- | IP as theme only; mini-game system does the work |

---

## 9. Failure Anti-Patterns (Avoid These)

| Anti-Pattern | Data Signal | Verdict |
|---|---|---|
| Pure Casual (puzzle, idle, mini-game) | 28/29 T4, avg R2 6.9% | Never. Context mismatch is fundamental. |
| Trending/IP without gameplay depth | Brainrot/Toilet pattern, 66% T4 | Novelty ≠ retention. IP is a skin, not a game. |
| Generic Shooting (no hook) | 39 T4 Shooting games | Needs an explicit differentiating mechanic. |
| Social/Concert as core mechanic | 12 T4 Social games | Passive experience = 1 session and done. |
| Racing | 100% T3/T4 | Engine mismatch. |
| Music/Karaoke (non-localized) | 100% T4 outside local audience | Passive + novelty fades in 1 session. |
| Horror as walking sim (no objective) | Door T4, FourFriends T4 | Atmosphere alone cannot retain players. |

---

## 10. Quick Concept Evaluation Checklist

Use this before committing to a concept:

- [ ] **Replay loop:** Can a player articulate why they'd open this game again tomorrow?
- [ ] **Session length target:** Does the design naturally produce 12+ min sessions?
- [ ] **Mechanic hook:** If it's a Shooting game, what is the explicit twist?
- [ ] **IP check:** If using IP/Trending, would the game stand alone without the IP?
- [ ] **Tag red flags:** Does the concept rely primarily on Casual, Music, or Racing?
- [ ] **Social check:** Is Social Interaction a multiplier on a real loop, or the only feature?
- [ ] **Context fit:** Does this feel natural to a player who just left a Free Fire BR match?
