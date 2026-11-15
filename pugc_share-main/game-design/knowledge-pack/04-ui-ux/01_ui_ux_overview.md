---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-27
source: "plant-vs-zombie/GDD/knowledge-pack/04-ui-ux/01-ui-ux-overview.md"
---

# 01 — UI/UX mockups from real assets (overview)

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

The full method lives in the **[canonical UI/UX method](../../../development/ui_ux_mockup.md)** under `development/` (8 files, English, generic — no
game-specific colours). Read that entry point first. This file is the summary plus the lessons learned
*after* that skill was written.

> **2026-10-27:** colleagues reusing this method got misaligned screens. Cause: new popups were built with
> invented absolute coordinates and per-screen values. The canonical method now has a build-mode rule,
> token sheet, ready-to-copy kit and layout lint — files
> [09](../../../development/ui-ux-mockup/09-design-tokens-and-layout.md),
> [10](../../../development/ui-ux-mockup/10-component-kit-templates.md),
> [11](../../../development/ui-ux-mockup/11-component-extraction-workflow.md). Start new work from the kit.

## The method in five steps
1. **Inputs** ([checklist](../../../development/ui-ux-mockup/01-input-checklist.md)): the Craftland Studio `.ui` JSON per screen, screenshots, the
   exported sprite folder, the rarity/element colour table. Missing input → mark "approx", do not invent.
2. **Coordinates** ([coordinate system](../../../development/ui-ux-mockup/02-coordinate-system.md)): convert `anchorMin/Max`, `anchoredPosition`, `sizeDelta`,
   `pivot` to absolute CSS px inside a fixed-size popup container (`.gpopup` + `.abs`).
3. **Primitives** ([visual primitives](../../../development/ui-ux-mockup/03-visual-primitives.md)): 9-slice frames via `border-image` classes (`sk-*`),
   sprite tint via CSS `mask-image` with the engine's multiply colour, text outlines (`HP_TEXT_OUTLINE`) for
   anything over the 3D scene.
4. **Component kit first** ([component library](../../../development/ui-ux-mockup/04-component-library.md)): popup chrome, title bar, close button, grid cell,
   stars, tabs, gold-frame progress bar, reward frame — then build screens from the kit.
5. **Scene anchoring + verification** ([anchoring](../../../development/ui-ux-mockup/05-scene-and-hud-anchoring.md), [verification](../../../development/ui-ux-mockup/06-verification-strategy.md)): overlay HUD widgets on real day/night screenshots with
   per-widget anchor (corner / top-center / bottom-center / center / fill) and max-width %, auto-scaling to
   the frame; verify with jsdom sweeps, pixel measurement against reference images (PIL), syntax checks.

## What the screens page provides
- Left: rebuilt screen; right: reference screenshot; below: an **asset table** per element (sprite path,
  tint, source `.ui` node, status real/approx/new) that doubles as the dev spec.
- "Scene preview" block: the widget over day and night scenes, with Main Layout + Hotbar base HUD drawn
  underneath for non-popup widgets.
- `sceneVariants()` on a screen = several options, each with its own preview and anchor.
- A separate **HUD simulation** page wires clicks (open shop, open plant detail…) for a play-through feel.

## Lessons after 30+ feedback rounds

See [Design Rounds & Feedback](03_design_rounds_and_feedback.md).
- Designers judge by eye: always give options with scene previews, then consolidate to one and delete
  the rest from code (keep the history in comments / changelog).
- Over-the-scene widgets want: no backing panel (or a thin dark trapezoid), outlined text, docked
  position (top-center like a match timer), ≤ 2 lines, one accent colour.
- Reward moments want **slower, staged animation** with a pause between stages (skill → stars → mutation →
  stats) and a click-to-skip.
- Remove text aggressively: labels like "ACTIVE SKILL", descriptions, secondary lines. Keep the number.
- Make state differences visible: unlit stars dark brown, lit stars bright with glow; "waiting" state
  without the icon that the "active" state has.
