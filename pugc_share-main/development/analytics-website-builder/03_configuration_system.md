---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/03-configuration-system.md"
---

# Configuration System

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Safe examples](18_safe_configuration_examples.md)

## Split configuration by responsibility

Use a thin manifest that resolves local `$include` files into one runtime config. The reference separates:

- Global authentication, reporting lag, metric availability and AI mappings.
- Project/admin sources, users, groups and capability records.
- Regional performance metrics, groups and table definitions.
- Overview comparison cards, tables and charts.
- Daily/weekly metric definitions and charts.
- Official Maps source, aliases/fields and chart setup.
- Deterministic analysis rules and English Markdown prompt/skill files.
- Separate private messaging configuration and encrypted credential stores.

Define merge semantics explicitly. In the reference, nested objects merge while arrays are replaced, not concatenated. Validate include paths, reject cycles and keep includes inside the intended configuration root.

Do not put live credentials in ordinary exported config. Configuration import/export and a shareable skill export are different products.

## Project record

Fields used by the reference:

- `name`: user-facing project name.
- `latte_key`: upstream map identifier; may differ from `name`.
- `enabled`: missing defaults to true; disabled projects remain editable in Admin.
- `read_mode`: `legacy` or `cohort_tabs`.
- `url`, `tab`, `header_row`: legacy data source or optional fallback.
- `cohort_tabs.url`, `.header_row`, `.tabs`: cohort spreadsheet and four tab mappings.
- `document.url`, `.tab`, `.header_row`: original source for document writes.
- `document.timeline_tab`: optional tab-name override in the consolidated reader.
- Global `timeline_document_source`: read-only consolidated document source.

Allow document-only projects while they are in development. Require at least an active data source or a document, not both. Performance selectors include only readable data projects; Timeline can include document-only projects. Missing map metrics should show no data, not an invalid blank URL error.

## Order and aliases

The `sheets` array is the authoritative project display/loading order. Apply it consistently to selectors, sequential loading, Admin lists and matching Official Maps options. A user's new selection can reprioritize pending work, not arbitrarily reorder the configuration.

Official Maps should keep raw upstream keys as option values while showing configured names. Match via normalized `latte_key` (or project name where no alias exists). Build options from authorized available rows, not every configured project. Keep unmapped authorized maps at the end with a predictable order.

Number visible project options without changing their submitted values. Leave `All maps` unnumbered. Renames, aliases and numbers must not break API filters, document matching or CSV values.

## Validation

Validate unique project/user/group identities, supported reader/type enums, positive integer header rows, source IDs/tab names and valid capability references. Invalid optional sources are still errors if provided. Treat empty project/region arrays as no access, never as wildcard access.

Validate capability schema versions to reject stale clients that would erase newer access fields. Protect administrator identity changes server-side. Group renaming must update references transactionally; deletion must not strand a user without any group.

Validate every included JSON file before deployment. Configuration migrations should be deterministic and idempotent, preserve effective permissions, and create a private recoverable backup. Do not export that backup with this skill.

## Editing and persistence

UI drafts are not automatically live config. Collect all records, including hidden editors, and save explicitly. An import loads a reviewable draft first. Show whether reorder/add/edit changes are unsaved. Change asset versions when shipping frontend fixes so stale clients do not retain incompatible controls.
