---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/04-ui-ux/02-icon-pipeline.md"
---

# 02 — Icon pipeline (rarity keyline icons from raw renders)

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

Source of truth: [icon pipeline references](icon-pipeline-skills/README.md) inside this folder (imported from `process-icon/README.md` + `process-icon/skills/*.md`, Vietnamese).

## Flow
```
src screenshots (3D model renders)
  → 256×256 transparent cutout (GrabCut-style background removal; no model download needed)   AUDIT
  → 256×256 redraw with neutral lighting (optional, when renders are inconsistent)               AUDIT
  → keyline outline: black 1 px → rarity colour 2 px → black 1 px (128×128 final; 256 preview) AUDIT
  → 64×64 downscale for hotbar/grid
```
Rules: real alpha (no fake checkerboards), crop tight with consistent padding, never write outlines into
the 256 base assets, every step has an audit sheet (contact sheet image) before overwriting outputs.
Rarity colour per species comes from the config (`ItemData.Rarity`) — never from guessing by look.

## Naming & wiring
`Plant_<index>_<Name>[_Element].png` (72 files) mirrors `ItemData.SpriteKey`, so pages can build the icon
path directly from config (`assets/sprites/Plants/icons_rarity_keyline/${SpriteKey}.png`). The UI/UX tool
and the balance pages (roster, skill pools, heatmaps) all use the same files.

## Audit checklist
- No background remnants or fringe at 2× zoom.
- Silhouette complete (no clipped leaves).
- Keyline colour matches the rarity table; thickness identical across the set.
- Icon readable on both light and dark panels.
