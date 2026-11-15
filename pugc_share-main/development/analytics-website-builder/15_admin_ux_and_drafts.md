---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/15-admin-ux-and-drafts.md"
---

# Admin UX and Draft Management

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

## Shared layout

Apply the same compact list/detail pattern to project sources, User Access, Group Project Access and SeaTalk configuration:

- Left: searchable one-line items, selection state and Add; reorder controls where relevant.
- Right: one visible detail editor with explicit Duplicate/Remove actions.
- Responsive: stack the panels rather than causing horizontal overflow.
- Clear no-match and no-record states, without removing actual records.

Users show email plus group badges on the same line. Groups show name plus type/member count. Long text truncates with accessible full titles. Limit visible badges and use +N for extra memberships. Stable group colors are visual cues, not authorization rules.

## Project sources

Use a selectable numbered reorder list with Up/Down and drag/drop insertion cues. Keep disabled/document-only projects reorderable. Selecting a project opens the configuration beside the list; remove the duplicated full sheet list below.

Group detail fields into identity, data source, fallback and Document. Keep fallback and Document visible; do not hide important source settings inside unnecessary nested accordions.

For long Google Sheet links, use a compact chip showing purpose and short ID suffix. Click reveals the full editable URL, with safe Open/Done controls. Restrict Open to validated supported HTTPS destinations; do not turn arbitrary typed input into an executable/link target. Only one link editor needs to be open at a time.

Use a slightly different background/border for the active expanded sheet as a whole, reverting when collapsed. Avoid painting every inner section a loud different color.

## Draft strategy

Choose one explicit approach:

1. Keep every record's editor in DOM and hide inactive records; collectors include hidden records. Suitable for moderate User/Group/SeaTalk lists.
2. Render one editor at a time but synchronize its draft to a central draft store before switching/reordering. Suitable for project source editors.

Do not mix partial collectors with a full-config Save endpoint. A search filter must not erase hidden records. Reordering must preserve drafts and identities, not swap field values by index accidentally.

Update sidebar labels from the draft without replacing the focused form on every keystroke. New/duplicate items become selected, relevant search clears, and the editable identity field gets focus where useful. Never auto-save because an item was selected.

## Permission controls

All projects/All regions are deliberate convenience toggles: checking selects all children and disables individual edits; unchecking clears children and enables individual selection. Treat the cleared selection as no access. Handle region exclusions consistently.

Use small explicit checkbox dimensions (the reference uses 14px) so global input styling cannot inflate them. Put brief guidance beside the relevant label, not several full-width instruction paragraphs.

Group creation/type changes use documented capability defaults. Primary-admin safeguards remain effective on both browser controls and server validation. Duplicate user copies settings but starts with blank email; duplicate permission group copies capabilities but not members.

## Interaction gates

Group/type/color/source changes remain drafts until Save. Import is review-first. Cancel preserves or discards predictably. Keep Delete/Remove and Debug Send visually distinct from ordinary selection; do not invoke consequential actions while testing layout.

Use restrained icons in major headers, subtle accents and short labels. Avoid loading a large icon framework for a few navigation symbols. Verify one-line rows, input focus and drafts at both desktop and narrow widths.
