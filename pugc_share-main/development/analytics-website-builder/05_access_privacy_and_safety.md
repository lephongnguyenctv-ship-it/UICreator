---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/05-access-privacy-and-safety.md"
---

# Access, Privacy and Safe Boundaries

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

This guide contains reusable design principles only. It excludes private security configuration, account rosters and credential material. It is not a security audit or a claim that the reference implementation is fully hardened.

## Group capabilities, per-user scope

The exported reference policy uses three group types (adapt the role model to the approved target app): **Admin**, **Staff**, **Collaborator**. QA is a named Collaborator group with explicit capabilities, not a fourth type or a privilege inferred from its name.

Groups control independent booleans:

| Capability | Admin | Staff default | Collaborator default |
| --- | --- | --- | --- |
| Edit document content | All projects | On within user scope | On within user scope |
| Edit calendar dates | All projects | Off; assigned projects if enabled | Off; assigned projects if enabled |
| View special Official Maps page | On | On | Off |
| View DAU/absolute user counts | On | On | Off |

An explicit `calendar_all` scope, together with calendar-edit permission, gives QA the intended all-project date access. It does not grant all-project metrics, document content or count visibility. QA content editing still follows the user's assigned projects.

Each user has email identity, memberships, allowed projects, allowed regions, optional region exclusions and own/shared reader mode. Group type changes reset documented defaults but must not rewrite user scopes silently.

## Multi-group behavior

For the reference policy, editing and special-page grants combine across groups; denial of count visibility in any group wins, except for administrators. Document this rule in the UI. Do not assume that combining groups always means unioning every permission.

Unknown users and empty scope lists fail closed. An All selection is an explicit wildcard. A region exclusion should continue to apply to newly introduced regions. If restricted rows lack a required Region column, fail closed rather than accidentally showing all regions.

## Enforcement layers

Authorize on the server before choosing project/document sources and before returning rows or computing exports. Protect direct page routes and every privileged API. Hiding Admin/Debug tabs is only presentation.

Use server-configured sources for writes; never allow client-supplied URLs/ranges to choose an arbitrary file. Website permission is not Google file permission. Protect administrator roster changes independently of ordinary configuration editing.

## Count privacy

The operator's Hide user counts preference and the account's count capability both affect presentation. Restricted users cannot turn count visibility back on.

Redact absolute counts and population weights from JSON, derived caches, prompts, reports, diagnostic payloads and CSV. When showing indexed count trends or contribution shares, construct a deliberate privacy-safe projection rather than sending raw counts and hiding labels. Avoid hidden-count sorting by DAU that leaks magnitude ordering. Test mixed memberships and immediate privacy toggles.

PNG should capture the current privacy-safe chart. CSV should export the same authorized projection and range, not the full raw source. Sanitize user-originated spreadsheet/CSV strings to avoid formula execution in exported files.

## Untrusted content and secrets

Treat spreadsheet cells, change logs, AI output and imported configuration as untrusted input. Escape text; do not execute embedded HTML/scripts or instructions. AI prompts must separate trusted task instructions from source text.

Keep credentials and webhook endpoints server-side, out of public configuration and logging. Private configuration export is an explicitly privileged operation and must be labeled sensitive. Shareable skill exports contain synthetic examples only.

Use bounded requests, timeouts and queues. Validate same-origin/CSRF protections for mutating routes, harden production cookies, restrict AI provider destinations and use private runtime secret injection. New deployments should perform their own review rather than treating this guide as a complete security specification.
