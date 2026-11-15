---
name: craftland-product-lifecycle-dev-forge
description: PUGC VN product development lifecycle ("the development forge") covering the Prototype and sequential Demo milestones, and the genre-specific development-time matrix (Simple/Complex Shooting, Simple/Complex Creative). Use to understand how long a map takes to build and what each milestone gate means.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-06-25
source: "[C3][FF][Craftland] PUGC VN Introduction — Working Flow › Product Lifecycle & Game type matrix"
---

# Product Lifecycle — The Development Forge

> The development cycle is structured around key milestones: **Prototype** and
> **sequential Demos**. Each phase is a **decision point** to either scale the
> project or terminate it in favor of more promising ideas — ensuring efficient
> **sunk-cost management**.

## 1. Milestones

> Total build window ≈ **1 month** (logic-first → polished testable version).

| Milestone | Duration | Goal |
|---|---|---|
| **Prototype** | 2–3 weeks | Build a fast, playable demo focused on the **main core loop** of the gameplay. |
| **Demo 1** | (within ~1 month total) | Core gameplay process running smoothly; content display can be missing; **prioritize completing gameplay logic**. |
| **Demo 2** | 2–3 weeks | Design content basically completed; integrate related **Level Design, UI, UIFX** resources. |
| **Demo 3** | 2–3 weeks | All design content completed; function optimization + display improvement; **polished to a testable version**. |

> Each milestone acts as a go/terminate gate. A project that fails to show
> promise is dropped in favor of more promising ideas.

## 2. Game Type × Development-Time Matrix

> Genre-specific **soft deadlines** used as references to manage development
> time and avoid excessive sunk costs on underperforming projects.

| Game Type | Timeline | Prototype within | Details |
|---|---|---|---|
| **Simple Shooting** | 10–30 working days | 1 week | Maps with simple shooting rules (FFA, Solo modes). |
| **Complex Shooting** | 20–45 working days | 2 weeks | Complex shooting rules (Bermuda Duo Squad, complex mechanisms). |
| **Simple Creative** | 30–40 working days | 2–3 weeks | Non-shooting games with basic gameplay (Social Island, Hide & Seek, etc.). |
| **Complex Creative** | 40–60 working days | 2–3 weeks | Creative game with complex & long-term gameplay & content. |

## 3. Notes

- These are **soft deadlines / references**, not hard limits — based on past
  experience per genre.
- The forge (Prototype → Demos) feeds into the broader QA → launch pipeline in
  [`development_lifecycle_stages.md`](development_lifecycle_stages.md).
- Post-release scaling/drop decisions use R2 targets defined in
  [`../publishing/release_pipeline_decision_making.md`](../publishing/release_pipeline_decision_making.md)
  and ranks in [`../general-knowledge/tier_list_definition.md`](../general-knowledge/tier_list_definition.md).
