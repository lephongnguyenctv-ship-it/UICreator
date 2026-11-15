# Code Review Pack Authoring Guide

This guide defines how to add a future Code Review pack to the `craftland-pugc`
umbrella. It replaces the legacy standalone-skill creation prompt from
`ReviewCode/prompts/CREATE_PROMPT.md`.

## Scope and references

Before authoring a pack, read the shared contract in
[`../code_review.md`](../code_review.md), the current registry in
[`packs.json`](packs.json), and the closest existing pack. Read all
four files of that reference pack: `workflow.md`, `api.md`, `rule.md`, and
`standard.md`.

Use the closest pack as a structure and detail reference only. Do not copy
domain-specific rules into a new topic. Keep the reviewed project read-only;
the pack may create only the report required by the shared contract.

## Required pack structure

Create one kebab-case directory under `development/code-review/`:

```text
development/code-review/{pack-id}/
├── workflow.md
├── api.md
├── rule.md
└── standard.md
```

Every pack must contain exactly these four direct files. Do not create a
pack-level `SKILL.md`, README, changelog, quick reference, or standalone skill
directory. The umbrella owns discovery, report output, and installation.

### `workflow.md`

Write the pack-specific workflow in English. It must:

- state the explicit invocation phrases and the source domain it covers;
- reuse the shared project-root and read-only rules by linking to
  `../../code_review.md`;
- instruct the reviewer to read `api.md`, `rule.md`, and `standard.md` first;
- define the domain-specific inventory/map and evidence to extract;
- require only this pack's rule IDs in findings; and
- use the shared single Vietnamese report, naming, collision, and inline
  fallback contract instead of creating an independent output format.

### `api.md`

List verified APIs, commands, configuration keys, lifecycle hooks, code
patterns, and detection signals for the topic. Group them by purpose. Mark
deprecated or unsafe patterns clearly. If a signature or runtime guarantee is
unknown, add a `TODO: Verify with ...` item instead of inventing it.

### `rule.md`

Define checkable rules in English. Each rule must have a unique ID using the
manifest's uppercase `rule_prefix` followed by a three-digit number, such as
`NET-001`. Describe the violation, check, severity, and valid exception where
applicable. Separate confirmed requirements from assumptions and record
unverified platform behavior under a TODO or assumption.

### `standard.md`

Provide actionable design requirements, anti-patterns, a review checklist,
remediation guidance, and targeted test scenarios. Add a Mermaid flowchart when
the main remediation flow has multiple branches. Recommendations must be safe
to apply without the reviewer editing source automatically.

## Manifest registration

Register every pack in [`packs.json`](packs.json):

```json
{
  "id": "example-pack",
  "trigger": ["example review"],
  "applicability_signals": ["VerifiedApiName"],
  "rule_prefix": "EX",
  "path": "example-pack"
}
```

Rules for registration:

- `id` and `path` are unique lowercase kebab-case values;
- `path` is a single directory name relative to `development/code-review/`;
- `rule_prefix` is unique, uppercase, and matches every rule ID in `rule.md`;
- `trigger` contains clear explicit user phrases or pack IDs; and
- `applicability_signals` contains literal source tokens that can select the
  pack without loading unselected pack references.

The manifest is the only discovery source. Do not implement automatic
selection in a pack workflow. Explicit pack selection takes precedence over
signals; otherwise every pack with at least one matching signal is selected and
all selected packs contribute to one combined report.

## Validation and completion checklist

Run the validator from the umbrella root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "scripts\validate_code_review_packs.ps1"
```

Use `-RootPath` to validate another umbrella-shaped fixture or checkout. The
validator must pass the current packs and fail when a fixture has malformed
JSON, a missing required file, an unregistered pack directory, a nested
`SKILL.md`, a duplicate rule ID, or a rule ID with the wrong prefix.

Before handing off the pack, confirm:

- all four files are English and internally consistent;
- every relative link resolves;
- no source project or legacy `ReviewCode` repository was changed;
- the pack is registered exactly once; and
- the shared report contract remains the only output contract.
