---
name: craftland-pugc-team-onboarding
description: >
  Start-here onboarding guide for new members of the Craftland/PUGC VN team.
  Covers team context, role expectations, source-of-truth locations, first-day
  and first-week setup, working cadence, high-level product lifecycle, and
  links to the team tooling reference. Use when onboarding a teammate or
  explaining how to begin contributing.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-09-08
source: >
  [C3][FF][Craftland] Onboarding Document (PUGC VN) and
  [C3][FF][Craftland] PUGC Common Questions
---

# Team Onboarding — Craftland/PUGC VN

> Start here when joining the Craftland/PUGC VN team. This is an orientation
> layer: detailed procedures and canonical thresholds remain in the linked
> development, publishing, and general-knowledge files.

## 1. Team context

- **Product:** Craftland, a Free Fire UGC platform and map ecosystem.
- **Target:** Global players, with the team operating from the VN PUGC setup.
- **Operating mode:** Live Ops; current priorities and project status belong in
  the current team planning sheet rather than this static guide.

The team is expected to contribute beyond assigned tasks. Surface bugs,
propose improvements, and evaluate decisions against the player experience.

## 2. First-day checklist

- Confirm the role track and the person or group that will review the first task.
- Request access to the team-wide [VN PUGC Master Sheet](https://docs.google.com/spreadsheets/d/1BzR0KXRKPnJE1KhOjMdY6rmM3pMqXRxpO9a0LlApve8/edit?gid=1068671707#gid=1068671707).
- Request membership in the required [FF-OGC GitHub organization](https://github.com/FF-OGC).
- Join the relevant SeaTalk groups listed in
  [`team_tooling_reference.md`](team_tooling_reference.md).
- Install or locate the editor and packaging tools by following
  [`team_tooling_reference.md`](team_tooling_reference.md).
- Find the current project GDD, Master Data, package, asset, bug, and feedback
  locations before starting implementation.

Do not put passwords, tokens, or other credentials into this repository. Shared
publishing-account access must follow the team's approved internal credential
process.

## 3. First-week path

1. Attend the recurring team activities described in
   [`team_workflow.md`](team_workflow.md): daily stand-up, weekly update,
   Thursday playtest, and monthly brainstorming.
2. Read the lifecycle orientation in the next section, then use the canonical
   milestone and stage documents for the project currently assigned to you.
3. Create or update the first task in the VN PUGC Master Sheet, including owner,
   status, next action, and relevant links.
4. Complete one small, reviewable contribution: a design change, code change,
   test result, asset update, or documented issue.
5. Join a playtest or review, record actionable feedback, and close the loop
   with the task owner.

## 4. Product lifecycle — high-level orientation

The team flow is:

```text
Concept / spec
  → Prototype and Demo milestones
  → Gameplay playtest and feedback
  → Production and feature expansion
  → Stabilization: performance testing plus development polish
  → QA
  → Publishing / release
```

This diagram is intentionally high-level. Use the canonical references for
details:

- Milestone names, soft timelines, and Demo 1/2/3 expectations:
  [`product_lifecycle_dev_forge.md`](product_lifecycle_dev_forge.md)
- Stage-by-stage status and PIC ownership:
  [`development_lifecycle_stages.md`](development_lifecycle_stages.md)
- Pre-release performance and release checklists:
  [`client_performance_test.md`](client_performance_test.md),
  [`server_performance_test.md`](server_performance_test.md), and
  [`release_guideline.md`](release_guideline.md)
- Post-release exposure and scale/drop decisions:
  [`../publishing/release_pipeline_decision_making.md`](../publishing/release_pipeline_decision_making.md)

Do not define Tier targets or retention thresholds in this onboarding file.
Use the canonical [Tier List Definition](../general-knowledge/tier_list_definition.md)
when performance ranks are discussed.

## 5. Role tracks

The role map below avoids embedding an individual member list, which can become
stale. A project may assign more than one track to the same person.

| Role track | First focus | Read next |
|---|---|---|
| Product / project coordination | Priority, timeline, resources, and task visibility | [`team_workflow.md`](team_workflow.md), [`development_lifecycle_stages.md`](development_lifecycle_stages.md) |
| Game design | Core loop, gameplay spec, balance, and playtest feedback | [`../game-design/craftland_game_design.md`](../game-design/craftland_game_design.md), [`product_lifecycle_dev_forge.md`](product_lifecycle_dev_forge.md) |
| Development / scripting | Editor setup, source control, packaging, client/server logic | [`team_tooling_reference.md`](team_tooling_reference.md), [`auto_save_format.md`](auto_save_format.md) |
| QA | Gameplay acceptance, bug reporting, and client/server performance checks | [`client_performance_test.md`](client_performance_test.md), [`server_performance_test.md`](server_performance_test.md) |
| Publishing / configuration | Region configuration, release accounts, package handoff, and release checklist | [`team_tooling_reference.md`](team_tooling_reference.md), [`release_guideline.md`](release_guideline.md) |
| Promotion / assets | Promotion materials, asset locations, licensing evidence, and feedback loop | [`team_tooling_reference.md`](team_tooling_reference.md), [`release_guideline.md`](release_guideline.md) |

## 6. Source-of-truth map

| Need | Current source |
|---|---|
| Team-wide tasks and project tracking | [VN PUGC Master Sheet](https://docs.google.com/spreadsheets/d/1BzR0KXRKPnJE1KhOjMdY6rmM3pMqXRxpO9a0LlApve8/edit?gid=1068671707#gid=1068671707) |
| Source code and shared repositories | [FF-OGC GitHub organization](https://github.com/FF-OGC) |
| Tool links, SeaTalk groups/bots, account setup, reports, and assets | [`team_tooling_reference.md`](team_tooling_reference.md) |
| Team cadence | [`team_workflow.md`](team_workflow.md) |
| Development milestones and stage ownership | [`product_lifecycle_dev_forge.md`](product_lifecycle_dev_forge.md) and [`development_lifecycle_stages.md`](development_lifecycle_stages.md) |
| Pre-release and publishing checks | [`release_guideline.md`](release_guideline.md), [`client_performance_test.md`](client_performance_test.md), and [`server_performance_test.md`](server_performance_test.md) |

## 7. Completion criteria

A new member is ready for normal team contribution when they can:

- find the team task sheet, GitHub organization, relevant SeaTalk groups, and
  project resources;
- open or install the tools required for their role, or identify the correct
  support path;
- explain the high-level lifecycle and identify the canonical document for the
  current stage;
- complete one small reviewable task and record its status; and
- participate in playtest, QA, or review feedback relevant to their role.

## Related sources

- [Onboarding Document (PUGC VN)](https://docs.google.com/document/d/1lK851slLm2JiJG6pxBYIX9D4k9BkqfQNy1MqT6ofwc4/edit?tab=t.0#heading=h.lsszcw32pfuv)
- [PUGC Common Questions](https://docs.google.com/document/d/1h_oT9XMDi5Q8BiBxOuABYCPYN--mNV7PWM1D6X5h3jc/edit?pli=1&tab=t.0#heading=h.e7cdnkspu8w0)
