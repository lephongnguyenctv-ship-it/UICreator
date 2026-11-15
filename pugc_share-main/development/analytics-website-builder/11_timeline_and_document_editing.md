---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/11-timeline-and-document-editing.md"
---

# Timeline and Document Editing

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Access policy](05_access_privacy_and_safety.md)

## Read source versus write source

Use a consolidated document spreadsheet with one tab per project to simplify reads. Default the tab to the configured project name, with an explicit override if needed. Reuse document results across Timeline, Calendar, Overview, update markers and analysis.

Every project retains its **original document** as the only write target. Never write to the consolidated read index. If a project's consolidated tab is absent, fall back to its original document; a source permission/error is not automatically the same as an absent tab.

After a write, invalidate both original/index document caches and relevant local analysis/markers. Show the original-document result immediately. A consolidated formula/import may synchronize later; disclose this instead of claiming the index was updated atomically.

## Project Details

Load all applicable timelines progressively and reuse them when the project changes. Start in configured order; a selection during loading prioritizes that pending project. Show the active project, loaded/total count, source/cache timestamp and partial failures in both Details and Calendar.

Current changes are **WIP**; next changes are **Confirmed**. Show release date, QA date, type, status and content. Completed Done entries supply historical release context/analysis. Do not redefine current changes as only this week's release dates if the status contract says WIP.

Keep the view read-only until Edit change logs is clicked. Authorization determines which content/date controls appear and which fields the server accepts.

## Calendar layout

- Stack current and next month vertically, not side-by-side cramped grids.
- Limit overall width sensibly while preserving usable seven-day columns.
- Render weekends with a slightly darker background.
- Use compact event cards with modest height and spacing; avoid per-day scrollbar boxes.
- Release entries omit redundant `Release` text; QA entries begin with `QA ·`.
- Keep blue release and yellow QA as primary colors; subtle project variants help distinguish projects.
- A clicked entry shows one contextual detail/editor card, replacing the previous one.

Favor date-first editing in Calendar: QA card focuses QA date; release card focuses release date. Retain a read-only popup for users who cannot edit. Show all important content without making every calendar card tall.

## Safe editing workflow

1. Explicitly enter edit mode. No auto-save on date selection.
2. Preserve the draft on errors; prompt before discarding a dirty draft.
3. Resolve source location from server configuration, not a submitted URL.
4. Check content and calendar capabilities independently and require the editor's own Google authorization.
5. Re-read original headers/rows before saving. Match one exact original entry when editing from the consolidated view.
6. Verify a source/version fingerprint so inserted/reordered rows become a conflict, not a wrong-row update.
7. Reject formula cells, require unique recognized writable headers and touch changed cells only.
8. Write content as explicit string values; write dates as native date cells with a clear ISO display format.
9. Reload/invalidate affected document views without clearing unrelated map data.

Only content, release date and QA date are editable in the reference; type/status and unrelated columns stay unchanged. Blank date means TBD. QA after release is a warning for review, not a forced business rule.

## Concurrency and uncertain outcomes

The reference serializes same-document writes in one process and issues one batch update. This is not an atomic cross-server compare-and-swap. A direct Sheets edit can still race after the fresh read. Strong multi-writer installations need additional coordination.

Never automatically retry an uncertain write. Explain that it might have succeeded, retain the draft and require reload/reconciliation. Missing/duplicate consolidated-to-original matches fail closed. Test with isolated fixtures or a sandbox document, not live project content.
