---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/19-provenance-and-limitations.md"
---

# Provenance and Limitations

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

## What was extracted

This package consolidates website-specific knowledge from:

- `README.md` and `RECENT_CHANGES.md` for product intent, operations and chronological decisions.
- Focused documents for cohort schema, Google OAuth, access, timeline editing, product analysis, diagnostics and chart performance.
- `server.js`, `run_server.js`, `lib/` and the HTML/CSS/JavaScript frontend for current behavior.
- Split configuration structures, `config/skills/analysis_rules.json`, the game-performance reader skill and specialized analyst prompts.

The source names above identify engineering areas, not dependencies needed to read this package. The original export was self-contained. This integrated module also links to canonical references elsewhere in the same umbrella; there are no required private attachments or external workspace files.

## Intentional exclusions

No secret files/token stores were copied. No live provider key, encryption material, OAuth client value, session identifier, message webhook, spreadsheet/document ID, user roster, business metric extract, production URL, platform/workspace identity, internal deployment connector or machine-specific runtime path is part of the export.

Only general authorization/privacy/safe-editing practices are retained because another agent cannot responsibly recreate login and document editing without them. This is not an export of the current installation's private security posture or a comprehensive security audit.

## Precedence when source descriptions disagree

Current code/config plus recent focused documentation take precedence over older README examples. Important reconciliations:

- The website now has Timeline/Performance/AI/Admin/Debug areas; older single-row tab descriptions are historical.
- Access version 2 uses group capabilities and per-email project/region scope; old presets/owner grants are migration history.
- QA is a Collaborator group with explicit global calendar scope, not a fourth group type.
- Map/document caches use scheduled lazy expiry, not the old five-minute-per-user policy.
- Zero retention is retained; the former whole-date low-R2 heuristic is retired.
- Shared tier/grade values route to the umbrella's canonical references. The source website's no-DAU minimum-threshold quality screen is not automatically equivalent to canonical rank eligibility; see chapter 12.
- Activeness charts display active days rather than percent.
- Release goals are removed; update comparison uses 7/14/28-day horizons.
- Chart Compare currently summarizes arithmetic prior-row changes; it is not a full overlay or the weighted fixed-calendar analysis engine.
- Consolidated documents are read sources; original documents remain write targets.

## Known deployment limits

The reference has process-local data caches, quota queues, diagnostics, scheduler work and document locks. Local JSON credential/config storage does not provide distributed coordination. A new multi-instance deployment must design shared persistence, routing and job/write ownership deliberately.

Availability masking currently covers R2/R7/R14/R30/C2/C7; other fields need verified extension. Observation age is not upstream completion. Percentile aggregation, arithmetic fallbacks and previous-period chart sampling need explicit semantics.

Generic production hardening, safe artifact allowlisting and stable cross-replica reader coordination in these guides are recommendations, not assertions that every safeguard already exists in the source.

## Export validation scope

Validate this package's Markdown links, synthetic JSON blocks, file inventory and redaction patterns before sharing. That validates the documentation export, not a newly built website. External deployment/login/provider/message/document-write flows must be tested separately with the new operator's authorized environment.

When extending the package, keep identifiers synthetic, keep the index complete, and record whether guidance describes verified behavior or a recommended design. Never paste live debug logs or private configuration into a reusable skill.
