---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.1
last_updated: 2026-11-03
source: "plant-vs-zombie/GDD/design/29-agent-handbook.md, 30-balance-facts.md (2026-10-23)"
---

# Playbook 04 — Documentation another agent can take over

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

**Goal:** a new person or AI agent, reading only the repository, continues balance / pacing / progression work
without the original conversation. Run this when a project has many decisions, after a large balance pass,
or before handing the project over.

## 1. Classify every design document
Put one status line under each title:
- **Current** — usable as is (handbook, generated facts, decision log, dev action items, changelog, one-page GDD).
- **Concept** — rules/ideas still valid, numbers may be old; add 1–3 lines "changed since: …" with decision IDs.
- **History** — snapshot (old audits, reviews, superseded plans); never use its numbers.
Rewrite the root README as an index table with these statuses, a correct high concept and glossary.

## 2. Write a handbook (one file)
Sections that proved necessary:
1. Context in ten lines; who decides; what we may and may not change (config vs code).
2. **Trust order** when sources disagree: game repo → config mirror (proposal) → engine constants → generated facts → decision log → other docs.
3. Folder/path map, including sandbox limits (time per call, mounts that cannot delete).
4. One table **system → config tables → levers → how it is measured → page → decision IDs**.
5. Formulas verified against code (damage, cost, HP, income, spawn, skill triggers), with table indexing (1-based!).
6. Procedures with exact commands: dev sync, change a number, new feature; a script table marking one-off
   scripts that must **not** be re-run.
7. Simulator scope and known biases.
8. Pitfalls already hit, each with how to avoid it.
9. Open items: waiting for designer / waiting for dev.
10. Glossary in the team language ↔ English ↔ code identifiers.

## 3. Generate the numbers, do not write them
A script (`balance-facts.js` in the source) regenerates a facts document from config + simulator outputs:
pacing (proposal / dev / target), target audit, unlock schedule with gate keys, shop table, boss/loot per level,
charge/HP levers, skill EV per row, special-enemy and director parameters, onboarding chain, engine constants.
It ends with **automatic checks** (pacing outside targets, onboarding step that requires a locked item, skills
off target outside the declared exceptions). Run it last after every change; never edit its output by hand.

## 4. Index the decision log
At the top of the log: a table D# → system → one-line summary → status (current / partly superseded / fully
superseded / history) → superseded by. Add a second table for **contradictions** between old entries with the
value verified in config/code today. Fix headings that mislead (a "VOID" heading above still-current entries).
Reading 2,500 lines is a good job for a sub-agent; verify its contradictions against config before publishing.

## 5. Cold-read test (the acceptance test)
Spawn a fresh agent with no context and only read access. Ask 8–10 concrete questions:
where a specific unlock level is stored; a formula; the tier target of a skill; the exact steps to slow late
pacing and which documents to update; which values need a code change vs a CSV copy; first command after a dev
push; which docs not to trust; two pitfalls; what is still confusing. Fix every gap it reports (in the source
run: ambiguous lever location, undocumented script arguments, a stale status date, files missing from the index,
stray test files), regenerate facts, commit.

## 6. Keep it alive
- Changelog header: "what changed lives here; current values live in the facts document".
- Runbook for the agent (e.g. `CLAUDE.md`) points to handbook + facts first.
- Every balance change: decision entry + changelog + dev action items + regenerate facts.
- Day-to-day session habits (entry file + routing table, one task per session, prompt templates,
  verification gates): [AI Agent Session Workflow](../../../ai-skills/ai_agent_session_workflow.md).
