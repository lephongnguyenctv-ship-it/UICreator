---
name: craftland-code-review
description: Read-only Code Review workflow for Craftland projects. It identifies the reviewed project root, selects only registered review packs, and writes one Vietnamese report at that project's root without changing source files. Use for code review, database review, reconnect-spam review, duplicate-reward review, persistence review, or performance review after the corresponding pack is registered.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-10-18
---

# Phase-Based Code Review

This is the shared Code Review contract for the `craftland-pugc` umbrella skill.
Domain-specific rules do not belong in this file; they are supplied only by a
pack registered in [`code-review/packs.json`](code-review/packs.json). The
workflow must not infer correctness from source code or create findings outside
the rules of the selected pack.

## 1. Determine the Reviewed Project Root

The workflow must record how the root was determined in the report. Use the
following order of precedence:

1. Use `RootPath` when it is explicitly provided by the invocation.
2. Use the directory containing the file or directory explicitly provided by
   the user.
3. Starting from that directory, walk up through its ancestors and select the
   nearest ancestor containing `.git` or a project marker appropriate for the
   source under review (for example, a language or workspace build/configuration
   file).
4. If no marker is found, use the starting directory as the root and record
   that this was a fallback.

Do not use the umbrella skill directory (`pugc_share`) as the project root just
because the workflow was loaded from there. If several candidates remain,
prefer `.git`, then the nearest candidate; if the choice is still ambiguous,
record the assumption in the report.

Report paths relative to the reviewed project root whenever possible. Do not
scan outside that root, except for reading a reference pack explicitly allowed
by the manifest.

## 2. Review Execution Contract

- The review is **read-only** for the reviewed project. It may read, list, and
  parse source and required evidence, but must not edit, delete, rename,
  format, generate, migrate, install dependencies, or apply fixes.
- The only output created is one Markdown report at the reviewed project root.
  Never overwrite source files or an earlier report, and never write the report
  into the reference repository.
- Load only packs registered in `packs.json` and applicable to the invocation or
  detected signals. An unregistered pack, missing path, or ambiguous pack ID
  must be reported as unsupported; do not load content outside the manifest.
- An explicitly requested pack always takes precedence over weak signals found
  in source. If the explicit pack is invalid, report it as unsupported and do
  not silently switch to another pack.
- When no pack applies, still create a report, document the scanned scope, and
  clearly state in Vietnamese that no supported pack applies. Do not perform a
  baseline correctness review and do not create findings outside pack rules.
- Findings must retain the rule IDs supplied by their pack. In a later phase
  with a combined report, findings with the same root cause may share one
  description, but every related rule ID must remain visible.

The current reference-pack registry is
[`development/code-review/packs.json`](code-review/packs.json). The registry is
the only source of truth for pack discovery. Pack references are loaded only
after selection and only from the manifest-relative path.

For multiplayer performance requests, the registered
[`performance`](code-review/performance/workflow.md) pack reviews source-verifiable
network, loop, cache, render and HUD paths. The
[`database`](code-review/database/rule.md) pack remains the owner of
persistence safety and quota findings; both may be selected when their
registered signals apply.

## 3. Pack Selection

Selection is read-only and must be recorded in the report:

1. Parse `packs.json` and reject malformed manifests, duplicate pack IDs, and
   packs whose paths do not resolve to a directory.
2. If the prompt explicitly names a registered pack ID or one of its `trigger`
   phrases, select that pack only. Explicit selection wins even when its source
   signals are weak or absent. An unknown or ambiguous explicit request is
   reported as unsupported and does not fall back to another pack.
3. If no pack is explicit, scan only the reviewed project root for the literal
   `applicability_signals` of each registered pack. The scan must be read-only,
   must exclude the generated review report, and must not load pack references
   before selection. A signal is evidence for selection, not a finding.
4. Select every pack with at least one applicable signal. Therefore a project
   containing database and network signals runs both packs in one invocation.
5. If no pack matches, create the shared report with an explicit Vietnamese
   no-supported-pack statement and no findings.

Do not infer a pack from a generic word such as `data`, `manager`, or `event`
unless that exact value is registered as a signal. Weak signals may select a
pack, but they never override an explicit pack request.

## 4. Combined Report

Every invocation creates exactly one report, regardless of how many packs are
selected. For a multi-pack review:

- Keep one shared metadata block and list every selected pack.
- Include each selected pack's domain map (`Data Storage Map`, `Network and
  Action Map`, or its equivalent) in the same report.
- Merge all findings into one `Potential Issues` section. Group findings only
  when they share the same root cause and remediation pattern; retain every
  affected flow, evidence location, and rule ID in the grouped card.
- Use the highest applicable severity for a grouped card and list all related
  rule IDs in `Violated rules`. Do not hide a lower-severity rule or collapse
  distinct root causes merely because they affect the same file.
- Keep pack-specific recommendations under the shared `Recommendations`
  section, deduplicating only identical remediation guidance.

The database-only, network-only, mixed, no-signal, and explicit-pack cases must
all follow this selection/report contract. Pack references that were not
selected must not contribute rules, findings, or recommendations.

## 5. Report Naming and Writing

Each successful invocation must create exactly one file at the reviewed project
root using the machine's local time:

```text
code_review_{yyyyMMdd_HHmmss}_vi.md
```

For example: `code_review_20260830_143015_vi.md`.

Before writing, check for a collision. If the base name already exists, try
`_02`, `_03`, and so on immediately before `_vi.md`:

```text
code_review_20260830_143015_02_vi.md
code_review_20260830_143015_03_vi.md
```

Never overwrite an existing report. Choose the collision suffix in the same
project root and record it in the report metadata.

If the report cannot be written because of permissions, an invalid path, or an
I/O error, do not claim that a file was created. Return the complete report
inline using the format below, together with the intended path and the reason
writing failed. The inline fallback must remain read-only and must not create a
temporary file in the project.

## 6. Vietnamese Report Format

The report body, headings, field labels, findings, and conclusion must be
written in Vietnamese. The following structure is the minimum contract; use a
clear Vietnamese equivalent of "not available" for fields without data.

- A title identifying the document as a Code Review report.
- Metadata containing the timestamp and timezone, absolute project root, root
  detection method, scanned paths and limits, selected pack IDs (or none), and
  the report filename or inline-fallback status.
- A conclusion summarizing the result. When no pack applies, explicitly state
  that no supported pack applies.
- A Findings section. Each finding must include its rule ID, severity, relative
  location (line or symbol where available), verifiable evidence, impact, and a
  recommended fix that the workflow does not apply.
- An Evidence and Tests section listing each command, fixture, or observation
  and its result.
- A Review Limits section listing anything not checked, unsupported pack
  coverage, and assumptions.

### Shared Report Skeleton

The following is the concrete output template. All headings, field labels,
findings, and prose in the generated report must be rendered in Vietnamese,
while the structural fields remain unchanged:

```markdown
# Code Review Report

- Skill: code-review
- Generated at: {yyyy-MM-dd HH:mm:ss and timezone}
- Project root: {absolute path}
- Root detection: {explicit / marker / fallback}
- Scanned scope: {paths and limits}
- Selected packs: {pack IDs or None}
- Report file: {filename or inline fallback}

## Executive Summary

{Two or three short sentences summarizing the result and finding counts.}

## Finding Overview

| ID | Severity | Affected flow | Root cause | Impact | Fix priority |
|---|---|---|---|---|---|
| {RULE-ID} | {Critical/High/Medium/Low/Info} | {flow} | {cause} | {impact} | {priority} |

## Scope and Evidence

{Commands, fixtures, observations, and their results.}

## Potential Issues

### {RULE-ID} — {short title}

- **Severity:** {severity}
- **Violated rules:** {all related rule IDs}
- **Impact:** {concrete impact}
- **Root cause:** {root cause}
- **Affected flow:** {table/key or network action}

| Location | Evidence |
|---|---|
| `{relative/path:line}` | {verifiable fact} |

**Failure or attack timeline**

1. {First observable step.}
2. {Interleaving or failure condition.}
3. {Resulting impact.}

**Fix:** {Recommended remediation; do not apply it during review.}

**Invariant:** {Required safety property.}

## Recommendations

{One remediation pattern per shared root-cause group, followed by exceptions.}

## Unknowns / Assumptions

{Unverified platform guarantees, missing source evidence, and test limits.}
```

Use the Findings section only for rule IDs supplied by a selected pack. Do not
turn tooling warnings, style preferences, or speculation into findings without
an applicable rule.

## 7. Review Gate

Each phase adds only one small capability, runs its own tests, and stops after a
verifiable result is produced. Before the next phase begins, record the changed
files, test results, and a separate commit for review. Provisioning to Codex or
Claude Code occurs only in the final rollout phase, after all functionality has
been approved.
