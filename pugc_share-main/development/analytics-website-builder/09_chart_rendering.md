---
doc_type: development_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
source: "pugc_tracking/exports/analytics-website-builder/09-chart-rendering.md"
---

# Chart Rendering

> Imported reference snapshot (2026-10-14): product-specific defaults and implementation
> limitations require validation for the target app. See [integration and canonical owners](README.md#integration-and-canonical-owners).

[Skill index](README.md) · [Interactions](10_chart_interactions_and_exports.md)

## Config-driven renderer

Use reusable chart definitions: stable ID, title/subtitle, dimensions, type, axes, series, formats, colors, units and optional annotations. A series identifies its data column, line/bar type and left/right axis. Hide unavailable charts deliberately or show a useful empty state; do not manufacture zeros.

The reference uses custom canvas rendering. A chart library is acceptable if it preserves the same data/privacy/interaction contracts. Keep non-chart controls and descriptions in semantic DOM, not only in canvas pixels.

## Overview chart families

- Headline: DAU & DNU; R2/R7/R30; WAU & MAU; survival/playtime & match count.
- Cohort quality: DAU & R2; New Users & New R2; Revival Users & Revival R2; Core Users & Core R2.
- Cohort comparisons: R2 by User Group; survival by User Group; match count by User Group; user source mix; C2 by User Group before R7 by User Group where configured.
- Regions: Top Region contributions for Total, Core, New and Revival, with contextual matching retention.
- Engagement distribution: survival percentiles and three activeness charts measured in active days.

Group like charts in consistent four-card desktop rows where practical. Use matched title conventions, not dozens of unrelated variants. At smaller widths move to two columns, then one.

## Official Maps trends

Render beneath its data section:

1. DAU bars & Overall R2 line.
2. Average Survival Time line & Average Match Count bars.
3. New Users bars & New R2 line.
4. Revival Users bars & Revival R2 line.

Load map data first. Enrich already rendered charts with document events after the document read. Preserve current zoom, legend focus and privacy state while patching.

## Honest axes

Use zero baselines for bars. Lines may use padded local min/max to make trends legible, but label axes clearly. The reference's combined survival/match chart explicitly uses zero baselines on both axes to avoid misleading plotted heights.

Use human-friendly tick steps without excessive headroom. Preserve decimals for small match-count ranges. Percent axes should use percent-friendly steps and normally cap at 100%; configure exceptions explicitly. Label units on both axes of a dual-axis chart.

Never imply that dual-axis curves sharing visual height have equal numerical magnitude. Avoid excessive marker labels/line weights that obscure the underlying data.

## Visual and performance rules

- Draw missing/pending line observations as gaps; preserve real zero values.
- Scale canvas backing dimensions for device pixel ratio with a reasonable cap.
- Debounce resize rendering, and do not replace active filter inputs on scroll/resize.
- Reuse one renderer for normal and expanded charts.
- Use subtle cards, readable contrast and short descriptions rather than bright dense tables.
- Use one small icon per major section, not one per metric/control. Prefer text/inline assets over remote icon downloads.
- Use color plus labels/arrows/line style, not color alone.

Include region contribution's Top N plus Other where appropriate. Respect hidden-count mode: shares/index values can be shown only through an intentional privacy-safe projection. Restricted clients must not receive raw populations merely to calculate bars locally.

## Acceptance checks

Test narrow/wide viewports, high-DPI displays, decimal ticks, zero/pending gaps, percent bounds, dual-axis labels, empty datasets, missing cohort match fields, live document enrichment and normal/expanded parity. The renderer must not mutate the underlying analytical rows.
