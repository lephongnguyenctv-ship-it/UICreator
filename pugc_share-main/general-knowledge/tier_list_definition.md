---
name: craftland-tier-list-definition
description: Canonical definition of the Craftland/UGC game performance Tier List. Defines how each mode/region/game is classified into ranks (T0–T4) based on Min Survival Time, R2 range (Min/Max), and Min DAU, with the canonical mode examples and recommended action per rank. Single source of truth referenced by other skills (e.g. game_performance_evaluation).
type: general-knowledge
domain: craftland-ugc
status: authoritative
version: 2.0.1
last_updated: 2026-10-14
---

# Craftland Tier List — Definition

> **Single source of truth** for the Craftland/UGC performance tier (rank) system.
> Any skill that assigns a rank (e.g.
> [`game_performance_evaluation`](../publishing/game_performance_evaluation.md)) **MUST**
> reference this file rather than redefining ranks locally.

## 1. Classification Inputs

A rank is assigned using these metrics:

| Metric | Meaning |
|---|---|
| **Min Survival Time (minutes)** | Minimum average survival / session time per match required for the rank. |
| **R2 (Min–Max)** | Day-2 retention rate over **all users**, expressed as a range `[Min R2, Max R2)`. (Not `Avg R2 New`, which covers new users only and is **not** used for ranking.) |
| **Min DAU** | Minimum Daily Active Users required (10,000 across all ranks). |

> `Avg Match Count` and other metrics are **NOT** used to assign the rank. They
> are used for interpretation/diagnosis only.

## 2. Tier (Rank) Table

Ranks are bounded by an **R2 range**: `Min R2 <= R2 < Max R2`. Evaluate together
with **Min Survival Time** and **Min DAU**. All ranks require **Min DAU = 10,000**.

| Rank | Min Survival Time (min) | Min R2 | Max R2 | Min DAU | Example Modes | Note |
| :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **T0**  | 20 | 50%  | 100% | 10,000 | BR Rank, CS Rank | Core mode |
| **T1**  | 20 | 40%  | 50%  | 10,000 | LW / training island / PVE 2.0; Unlimited Gloo Wars | Has the potential to become a permanent core mode. Can focus on promotion to increase participation rate. Worth continuing to optimize. |
| **T1-** | 12 | 30%  | 40%  | 10,000 | PVE 2.0; Squid Challenge | Can be opened on regular rotation (monthly recommended). |
| **T2**  | 12 | 25%  | 30%  | 10,000 | Social Island / PVE / big head / duo active skill; CS / gunking; Nightmare Escape | Regular publicity can be carried out each time it is opened. Consider timing for secondary optimization. |
| **T2-** | 8  | 20%  | 25%  | 10,000 | Bermuda Duo Squad; Zombie Uprising | Open on low-frequency rotation. Consider timing for secondary optimization. |
| **T3**  | 6  | 15%  | 20%  | 10,000 | Mystery Town | Open on low-frequency rotation. No additional resources will be invested. |
| **T4**  | 6  | 0%   | 15%  | 10,000 | Ludo | Failed attempt. If there are no special needs, resources can be removed directly. |

### Reading the table
- **R2 is a half-open range:** a rank applies when `Min R2 <= R2 < Max R2`.
  E.g. R2 = 50% → **T0** (not T1, since T1 Max R2 is 50%).
- **Survival time + R2 both matter:** match the rank whose Min Survival Time is
  met **and** whose R2 range contains the value. When survival time and R2 point
  to different ranks, treat it as a diagnosis signal (see
  [`game_performance_evaluation`](../publishing/game_performance_evaluation.md)).
- **DAU gate:** all ranks assume Min DAU = 10,000.

## 3. Recommended Action by Rank

| Rank | Meaning | Suggested Action |
| :---: | :--- | :--- |
| **T0**  | Core mode — excellent performance | Treat as core; prioritize high exposure and continue frequent updates. |
| **T1**  | Strong — potential core mode | Focus on promotion to increase participation; keep optimizing. |
| **T1-** | Promising | Open on regular rotation (monthly recommended). |
| **T2**  | Average but viable | Publicize each opening; consider timing for secondary optimization. |
| **T2-** | Weak but has potential | Open on low-frequency rotation; consider secondary optimization. |
| **T3**  | Low performance | Open on low-frequency rotation; do not invest additional resources. |
| **T4**  | Failed attempt | Remove resources directly unless there are special needs. |
