---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/03-visualization/02-page-patterns.md"
---

# 02 — Page patterns (reusable)

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

Patterns the designer responded to best. Each is a few dozen lines of vanilla JS.

| Pattern | Use when | Notes |
|---|---|---|
| **KPI cards** (`.kpis` grid of label / big value / sub) | top of every page | 3–6 cards max; sub shows the dev value for comparison |
| **Proposal vs dev toggle** | any config-driven page | fetch both; red small text "dev: x" under changed cells |
| **Heatmap matrix** (rows = species, cols = element / rarity) | 2-D comparisons (plant power, skill pools) | log-scale colour on the whole matrix; cell shows big number + small %, icons inside cells; click = select |
| **Filter bar** (sliders + selects + "reset") | when a table depends on player state | one shared `filterHtml(prefix)` + `readFilter(prefix)` so two tables can have independent filters; show the resulting multipliers in a note line |
| **Timeline strip** (levels on an axis, markers above = current, below = proposed, shaded gap) | unlock spacing, collection gaps | horizontal, 10–30 levels per strip |
| **Gantt / roadmap grid** (lanes × updates, chips with left-border colour by type) | content plans | highlight the "main focus" chip per column |
| **Stacked share bar** (6 colours in one 9 px bar) | pool compositions | legend once at the top |
| **Vertical family × tier table** | skills (family header rows, tiers I–V beneath) | designer preferred vertical over 6×5 grid |
| **Segment table per 10 levels** | level/break costs, spending | columns: coin, materials, minutes of income, wait time |
| **Pack popup** (`pack-popup.js`, `data-item="id"`) | anywhere a bag/box is shown | one shared popup listing contents with %; works on shop, missions, onboarding, loot |
| **Expandable rows / cards** | zombie & boss per level | collapse detail (HP, DPS, drops) behind a click; group related columns into 2–3 cards |
| **Scene preview** (UI mockups) | HUD widgets | overlay the widget on a real screenshot at anchor + max width %; day and night variants |
| **Option rounds** | any visual decision | render 2–4 labelled options on one page with a scene preview each; then delete losers |
| **Red/yellow warnings vs targets** | simulator page | targets in a JSON file; colour cells outside ranges |
| **Staleness banner** | every page | fingerprint mismatch → banner + "rebuild" button |

## Formatting helpers

The `fmt` example below is source-project display formatting. For shared economy suffixes and
two-way Rank Value translation, use [Large Number Notation](../../../general-knowledge/large_number_notation.md).
- `fmt(v)`: ≥1e6 → `1.2M`, ≥1e4 → `12.3k`, ≥100 → integer with locale separators, else 1 decimal.
- `pc(v)`: percentages with sensible decimals (10% / 1.5% / 0.25%).
- Minutes of income beside every price (`≈ 4'`).
- Rarity colour classes and element tags everywhere the same.

## Text rules (designer feedback)
- One `lead` sentence per page; long explanations into "Chi tiết" (compact mode hides them).
- Column headers ≤ 2 words; put units in the header, not the cells.
- Prefer a number + small % over two numbers.
- No decorative sections; if a table has one row, make it a KPI card.
