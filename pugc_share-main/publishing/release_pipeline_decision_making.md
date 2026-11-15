---
name: craftland-release-pipeline-decision-making
description: PUGC VN release pipeline and performance-driven decision-making (fast-fail strategy). Defines exposure phases (initial low-exposure → short-term iteration → scaling → legacy), the R2 retention criteria and timing for update/scale/drop decisions, and how maps graduate or get dropped. Use to decide what to do with a map after it launches.
type: publishing-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.2
last_updated: 2026-09-19
source: "[C3][FF][Craftland] PUGC VN Introduction — Working Flow › Release Pipeline & Decision Making"
---

# Release Pipeline & Decision Making

> To optimize development resources and improve decision-making efficiency, PUGC
> VN applies a **fast-fail, performance-driven** release strategy. Decisions are
> gated on **Day-2 Retention (R2)** at fixed time checkpoints, with exposure
> increasing only as a map proves itself.

## 1. Decision Timeline (summary)

| Checkpoint | Target R2 | Tier ref | Focus |
|---|---|---|---|
| **First release** | > 25% | — | D1–D2 content; enhance onboarding. Low-traffic slots (e.g. Community Tab) to test the waters. |
| **After 1 month** | > 30% | Tier 1- | Optimize D2 retention by expanding short-term content and enriching core gameplay. |
| **After 2 months** | > 40% | Tier 1 | Continue optimizing R2 while expanding long-term gameplay depth to sustain engagement. |

> R2 ranks (T0–T4) are defined canonically in
> [`../general-knowledge/tier_list_definition.md`](../general-knowledge/tier_list_definition.md).

## 2. Phases

### Phase 1 — Initial Release
New maps release in **low-exposure channels** (e.g. Community Tab) to validate
early performance with limited traffic risk. Focus: D1–D2 onboarding, early
retention (especially R2), initial gameplay appeal.

| Initial Success Criteria | Decision |
|---|---|
| Potential retention **R2 > 20–25%** | Continue active updates & content iteration |
| Average retention **R2 ~15–20%** | Keep observing; decide update vs. stop |
| Low retention **R2 < 15%** | Stop investing; discontinue development |

### Phase 2 — Short-Term Iteration (within 1 month)
Promising maps enter a **weekly or bi-weekly** update cycle. Focus: expand
short-term content, improve onboarding, increase replayability, optimize retention.

| Success Criteria | Decision |
|---|---|
| **R2 > 30%** | Increase exposure; push to larger traffic channels |
| **R2 ~20%** | Re-evaluate after 1 month; continue or stop |

### Phase 3 — Scaling (after 1–2 months)
Strong-retention maps move to **higher exposure tiers**. Focus: long-term
gameplay depth, engagement systems, sustainable retention.

| Scaling Criteria | Decision |
|---|---|
| **R2 > 40%** | Move to highest exposure tier; long-term support |
| **R2 ~30%** | Choose: continue updating / maintain as-is / transition to legacy |

### Phase 4 — Legacy Strategy (Fast-Fail Principle)
If a map fails to achieve strong retention or growth potential:
- Map enters **legacy status**.
- Only **minor maintenance** and lightweight content updates.
- Existing players still supported.
- Main development resources redirected toward higher-potential projects.

**Benefits:** reduce wasted investment, quickly identify scalable projects, and
focus resources on maps with proven retention and growth.

## 3. Exposure & Retention Ladder (at a glance)

```
First Release (low exposure, Community Tab)
   │  R2 > 20%  ── update cycle: weekly / bi-weekly
   ▼
After 1 month → higher exposure if R2 > 30%   (else R2 ~20% → re-evaluate / drop)
   │
   ▼
After 2 months → highest exposure if R2 > 40% (R2 ~30% → update / hold / legacy)
   │
   ▼
R2 < 15% at any gate → drop / legacy (fast-fail)
```

## 4. Related

- Pre-launch build milestones → [`../development/product_lifecycle_dev_forge.md`](../development/product_lifecycle_dev_forge.md)
- Full status pipeline (QA → Launch) → [`../development/development_lifecycle_stages.md`](../development/development_lifecycle_stages.md)
- Operational release/hotfix flow, readiness, room/version observation, and bug containment → [`../development/release_guideline.md`](../development/release_guideline.md)
- Post-launch grading (ranks) → [`../general-knowledge/tier_list_definition.md`](../general-knowledge/tier_list_definition.md)
- Performance reading per region → [`game_performance_evaluation.md`](game_performance_evaluation.md)
