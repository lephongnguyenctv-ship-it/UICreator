---
name: craftland-development-lifecycle-stages
description: Canonical Craftland/UGC development lifecycle. Defines every project stage (Current Status) from Requirement Analysis to Launch, the PIC (person/role in charge) for each stage, and what happens in it. Use this to know which stage a gameplay/map is in, who owns it, and what the next step is.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-06-25
---

# Craftland Development Lifecycle — Stages

> **Single source of truth** for the stage-by-stage development process of a
> Craftland/UGC gameplay/map, from requirement to launch. Each stage has a
> **Current Status** label, a **PIC** (person/role in charge), and a description
> of the work done in that stage.

## 1. PIC Roles (glossary)

| PIC | Meaning |
|---|---|
| **Requirement Initiator** | The party that raised the requirement; owns acceptance, PT, and post-launch grading. |
| **Requirement Receiver** | The party that implements the requirement (planner / outsourcing vendor / dev). |
| **Procurement Team** | Handles outsourcing evaluation and negotiation. |
| **SH-QA** | QA team responsible for full testing, performance testing, and configuration smoke testing. |
| **Development Follow-up Personnel** | Owns hand-off states (awaiting launch / paused). |

## 2. Lifecycle Stages

Stages run top to bottom. The final two rows are **terminal outcomes** (mutually
exclusive): **Launched** (success) or **Completed, Not to be Launched** (paused).

| # | Current Status | PIC | Description |
|---|---|---|---|
| 1 | **Requirement Analysis** | Requirement Initiator / Receiver | After the requirement discussion meeting, the planner outputs the content and requirements to be implemented in this version. |
| 2 | **Outsourcing Process** | Procurement Team | The procurement group initiates the outsourcing evaluation and negotiation process. |
| 3 | **Document Writing / Adjustment** | Requirement Receiver | Planner designs gameplay + document writing; outsourcing vendor designs gameplay + document writing. |
| 4 | **Gameplay Production** | Requirement Receiver | Development of mode-related art assets / function support (for complex gameplay that requires demo validation first, this stage is also applicable). |
| 5 | **Demo1** | Requirement Receiver | Core gameplay process is running smoothly; content display can be missing; prioritize completing gameplay logic. |
| 6 | **Demo2** | Requirement Receiver | Design content is basically completed; integrate related Level Design, UI, UIFX resources. |
| 7 | **Demo3** | Requirement Receiver | All design content is completed; function optimization + display improvement; polished to a testable version. |
| 8 | **Gameplay Acceptance PT** | Requirement Initiator | After the creator completes the gameplay, the PUGC team conducts gameplay PT, acceptance & feedback. |
| 9 | **Routine PT, Awaiting Final Package** | Requirement Initiator | After R&D acceptance, adjust based on routine PT and confirm the final version. |
| 10 | **QA Full Testing** | SH-QA | QA conducts full testing of the gameplay based on test cases and reports bugs. |
| 11 | **Client & GS Testing** | SH-QA | Client and server performance testing to ensure standards are met. |
| 12 | **Bug Fixing / Performance Optimization** | Requirement Receiver | Bug fixing and performance optimization based on QA test reports. |
| 13 | **Completed, Awaiting Launch** | Development Follow-up Personnel | Testing passed, fixes completed, waiting for operations to arrange a specific launch time. |
| 14 | **Configuration Testing** | SH-QA | Formal configuration before launch; mode smoke testing. |
| 15 | **Launched** ✅ | Requirement Initiator | Gameplay update is launched; players can experience it in the game; the requirement party observes online performance and confirms post-launch grading. |
| — | **Completed, Not to be Launched** ⛔ | Development Follow-up Personnel | Not to be launched and development paused. Reasons include: gameplay acceptance failed, performance testing failed, stress testing failed, or gameplay map development terminated. |

## 3. Flow

```
Requirement Analysis
        │
        ▼
Outsourcing Process            (when outsourced)
        │
        ▼
Document Writing / Adjustment
        │
        ▼
Gameplay Production
        │
        ▼
   Demo1 ──► Demo2 ──► Demo3
        │
        ▼
Gameplay Acceptance PT  ──(acceptance failed)──┐
        │                                       │
        ▼                                       │
Routine PT, Awaiting Final Package              │
        │                                       │
        ▼                                       │
QA Full Testing                                 │
        │                                       │
        ▼                                       │
Client & GS Testing ──(perf/stress failed)──────┤
        │                                       │
        ▼                                       │
Bug Fixing / Performance Optimization           │
        │                                       │
        ▼                                       ▼
Completed, Awaiting Launch          Completed, Not to be Launched ⛔
        │
        ▼
Configuration Testing
        │
        ▼
   Launched ✅  ──► post-launch grading (see Tier List Definition)
```

## 4. Notes

- **Demo1 → Demo2 → Demo3** are progressive maturity gates of the same build
  (logic-first → integrated resources → polished testable version).
- **Terminal split:** any acceptance/testing failure can route the project to
  **Completed, Not to be Launched** instead of continuing toward Launch.
- **Post-launch grading** at the **Launched** stage uses the
  [Tier List Definition](../general-knowledge/tier_list_definition.md)
  (survival time, R2 range, DAU) to rank the mode.
- **Outsourcing Process** applies only when the gameplay is outsourced;
  in-house requirements skip it.
