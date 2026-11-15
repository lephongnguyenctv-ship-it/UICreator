---
name: craftland-ui-ux-mockup
description: Methodology for rebuilding a Craftland UGC map/mode's UI/UX (Craftland Studio `.ui` files) as HTML/CSS mockups that match the real `.ui` file and real assets — for dev/design review and as reference documentation. Covers input checklist, coordinate-system conversion, 9-slice/tint/text-outline primitives, design tokens and flow layout (rebuild vs new-design modes), a ready-to-copy component kit (CSS tokens + JS components + gallery + no-browser layout lint), component extraction from existing screens, HUD/scene anchoring, verification without a browser, an interactive browsing tool scaffold, and the disclosure workflow. Use when a designer needs an AI agent to rebuild one or more UI screens as browsable mockups, or build a multi-screen browsing/simulation tool, without ever fabricating colors/icons/layout.
type: development-knowledge
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-10-27
source: "craftland-ui-ux-skill (external methodology, extracted from a 25+ screen Craftland UI rebuild)"
---

# Craftland UI/UX Mockup

> Rebuild a Craftland UI/UX screen (HUD, popup, inventory, shop, upgrade,
> merge, detail, collection, etc.) as an **HTML/CSS mockup that matches the
> real `.ui` file (Craftland Studio) and real assets** — for dev/design review
> and as living reference documentation.

**This methodology holds no game-specific data** — no colors, icons, sprites,
or a game's name/style values. It is a generic working process + generic
sample code; you fill in your own game's real assets/colors/coordinates.

## When To Use

Use this when a **game designer** needs an AI agent to:
- Rebuild one or more Craftland UI screens as HTML/CSS mockups viewable in a
  browser, matching the `.ui` file and real screenshots exactly.
- Build an internal web tool to browse multiple screens, compare against
  reference images, and click through interactions (e.g. opening popups) as
  if playing the game.
- Guarantee the agent **never fabricates** colors/icons/layout when data is
  missing — it reports what's real, what's guessed, and what needs confirmation.

## Detail Files

Read these in order for a new UI rebuild; jump directly to one when only that
concern is relevant.

| # | File | Covers |
|---|---|---|
| 1 | [`ui-ux-mockup/01-input-checklist.md`](ui-ux-mockup/01-input-checklist.md) | Input data needed before starting (`.ui` JSON, screenshots, assets, color tables) and how to handle gaps — don't fabricate, ask, or mark as an assumption. |
| 2 | [`ui-ux-mockup/02-coordinate-system.md`](ui-ux-mockup/02-coordinate-system.md) | Reading `anchorMin/anchorMax/anchoredPosition/sizeDelta/pivot` from the `.ui` file and converting them precisely to CSS pixels. |
| 3 | [`ui-ux-mockup/03-visual-primitives.md`](ui-ux-mockup/03-visual-primitives.md) | Engine-accurate 9-slice frames, CSS-mask sprite tinting (matching the engine's multiply formula), and text outlines readable over a 3D background. |
| 4 | [`ui-ux-mockup/04-component-library.md`](ui-ux-mockup/04-component-library.md) | Building a standard reusable component kit (popup chrome, grid item cells, star ratings, tab bars, progress bars) before building any specific screen. |
| 5 | [`ui-ux-mockup/05-scene-and-hud-anchoring.md`](ui-ux-mockup/05-scene-and-hud-anchoring.md) | Placing HUD/popups over a real 3D scene screenshot at the correct position/scale, auto-scaling so it never overflows the frame. |
| 6 | [`ui-ux-mockup/06-verification-strategy.md`](ui-ux-mockup/06-verification-strategy.md) | Verifying a mockup without a real browser (sandboxes usually can't screenshot): syntax checks, sweeping every screen for errors, simulating a real DOM to test interactions. |
| 7 | [`ui-ux-mockup/07-interactive-tool-scaffold.md`](ui-ux-mockup/07-interactive-tool-scaffold.md) | Scaffold for an internal Node.js web tool to browse many UI screens, plus a simulation page that opens popups by clicking as if playing the real game. |
| 8 | [`ui-ux-mockup/08-workflow-and-disclosure.md`](ui-ux-mockup/08-workflow-and-disclosure.md) | The iterative workflow (draft → feedback → finalize) and the convention for disclosing what's real data, what's a guess, and what's a new proposal. |
| 9 | [`ui-ux-mockup/09-design-tokens-and-layout.md`](ui-ux-mockup/09-design-tokens-and-layout.md) | Why mockups drift and the fix: Mode A (rebuild from `.ui`, absolute) vs Mode B (new design, flow layout), token sheet, spacing rhythm. |
| 10 | [`ui-ux-mockup/10-component-kit-templates.md`](ui-ux-mockup/10-component-kit-templates.md) | Ready-to-copy kit in [`ui-ux-mockup/templates/`](ui-ux-mockup/templates/): `ui-kit.css` tokens, `ui-kit.js` components, screen template, gallery, `layout-lint.js`, component spec template. |
| 11 | [`ui-ux-mockup/11-component-extraction-workflow.md`](ui-ux-mockup/11-component-extraction-workflow.md) | Extract a kit from existing screens: inventory → measure and cluster values → specs → gallery → golden screens → gradual migration. |

## General Process (brief)

1. Gather input per the checklist (file 1). If something important is
   missing, ask the designer before building.
2. Read coordinates from the `.ui` file using the formulas in file 2 — don't
   eyeball it if real data exists.
3. Decide the build mode per screen (file 9). Fill the token sheet and the kit
   config once (files 9–10, copy `ui-ux-mockup/templates/`), or extract them from
   existing screens (file 11). Screens only compose kit components — never
   one-off CSS/markup, never invented absolute coordinates for new designs.
4. If a screen must appear over the real game scene, use the anchoring
   mechanism in file 5.
5. After every change, verify per file 6 (syntax, render sweep, layout lint,
   golden screens) before reporting it's done.
6. If the designer wants a multi-screen browsing/simulation tool, build it per
   the scaffold in file 7.
7. Throughout, follow the disclosure convention and working rhythm in file 8:
   never fabricate, never commit without being asked, always report
   assumptions clearly.

## Applicability Note

Written for **Craftland Studio** (the `.ui` format used by Free Fire PUGC). On
a different engine, only the coordinate-system section (file 2) needs
swapping for that engine's real coordinate system — the rest (9-slice,
tinting, component library, scene anchoring, verification, tool scaffold,
workflow) is generic CSS/web technique, not Craftland-specific.

## Related

- Player-facing design decisions (not implementation) → [`craftland_game_design.md`](../game-design/craftland_game_design.md)
- Pre-release client checks once the real UI ships → [`client_performance_test.md`](client_performance_test.md)


## Related balance-site references

The [Game Balance & Visualization Knowledge Pack](../game-design/knowledge-pack/README.md)
reuses the eight detail files above (its source copies were byte-for-byte identical).
Its [UI/UX track](../game-design/knowledge-pack/04-ui-ux/README.md) adds project feedback
lessons and an [icon pipeline](../game-design/knowledge-pack/04-ui-ux/icon-pipeline-skills/README.md);
those worked examples do not replace the real target game's assets, palette or `.ui` coordinates.
