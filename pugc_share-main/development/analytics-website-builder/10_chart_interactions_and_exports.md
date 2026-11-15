---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/10-chart-interactions-and-exports.md"
---

# Chart Interactions and Exports

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md)

## Two compact control rows

**Zoom**: `7D · 14D · 1M · 2M · 3M · All · Reset`.

**Action**: `Compare · PNG · CSV · Drag · Show Update · Expand`.

Give both row labels the same width, align button starts and use accessible pressed states for toggles. Short labels need informative tooltips. Show Update defaults off; it belongs between Drag and Expand.

## Parent Display Range versus chart zoom

The page's Display Range supports 7D, 14D, Last 1M, Last 2M, Last 3M, All and Custom. Changing/applying it synchronizes the charts' initial view and turns update markers off.

Each chart can subsequently zoom independently using full authorized history. Do not truncate its backing dataset to the initial page range. **Reset returns to the currently applied parent Display Range**, including exact custom bounds; it does not mean All.

Keep internal preset values separate from display labels. Do not parse `2M` by extracting its first digit and accidentally show two days. Specify month semantics consistently and test end-of-month/leap-day boundaries.

Data selection controls should not lose focus when background documents, cached results, scrolling or resize updates arrive. Patch charts/result sections without recreating the filter DOM.

## Update annotations

Retain both Minor and Big markers, using distinct labeled styles. Both vertical lines are dashed. Tooltip content on an update date contains only its type, not a full change-log paragraph.

Clicking a marker opens detail in one contextual popup. When a chart is expanded, that popup must sit above the expanded modal. Selecting another update closes/replaces the previous popup; provide keyboard dismissal.

Turning Show Update off hides visual markers/lines only. Date hover still reports available Big/Minor update types because annotations remain in the backing data. Late document loading should not reset interaction state.

## Legend focus and crosshair

Legend click toggles a line/bar without deleting the series or changing calculation data. Maintain predictable axis rescaling and corresponding toggle state in expanded charts.

Synchronize hover by canonical date across charts in the same section, not by array index. A different zoom or missing date must not highlight the wrong day. Clear stale highlights on mouse leave, range changes and page changes.

## Drag selection

Drag mode starts only after the Drag toggle is enabled. Show a translucent range band and readable From–To dates while moving. Clamp to plot bounds, support reverse-direction selection and cancel on Escape/pointer cancellation. Preserve ordinary hover when Drag is off.

On completion, apply custom bounds to that chart. Reject accidental tiny drags, retain the full data, and let Reset restore the parent range. Pointer/keyboard/touch affordances should not interfere with scrolling on mobile.

## Previous-period comparison

The reference Compare control displays a delta summary, not a full overlay. Its current implementation takes preceding rows and arithmetic series means, so missing dates and weekly/monthly buckets require special care. Do not present it as the weighted product-analysis comparison.

For a stronger recreation, define equal calendar windows, weekday alignment where intended, aggregation weights and coverage explicitly; label exact windows and missing evidence. If implementing an overlay, use a muted/dashed previous series with aligned relative day offsets. Rate change uses pp; other relative deltas are undefined at zero baseline.

## Exports

PNG exports the rendered, privacy-safe chart. CSV exports the selected range and chart series after the same privacy/unit transformation used by the renderer. Escape commas/quotes/newlines and neutralize formula-like untrusted strings. Revoking temporary object URLs must not prevent download completion.

Reports must preserve dashboard state. Explain whether legend-hidden series are included; never silently export every raw column. Test hidden-count exports, indexed series, custom dates, nulls and zero-baseline comparisons separately.
