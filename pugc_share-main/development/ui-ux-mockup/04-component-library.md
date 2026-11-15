# 04 — Building a "Standard Component Kit" Before Building Individual Screens

> **Working code exists:** copy [`templates/`](templates/) and follow
> [10-component-kit-templates.md](10-component-kit-templates.md) instead of writing a kit from scratch. Tokens and
> flow layout rules: [09-design-tokens-and-layout.md](09-design-tokens-and-layout.md). Extracting a kit from
> existing screens: [11-component-extraction-workflow.md](11-component-extraction-workflow.md). This file keeps the
> reasoning and the catalog.

The most common mistake when building many UI screens is writing each screen's code separately and
directly — leading to each screen drifting slightly out of sync (different padding, different tinting
approach, different class naming), so that when the designer asks to "fix the popup frame on all
screens," you end up fixing it N times in N different places.

**Principle**: before building the first specific screen, identify the SHARED COMPONENTS that repeat
across multiple screens, build each one as a function that takes parameters (data) and returns HTML —
then every specific screen just CALLS these functions with different data. Fix one place, and every
screen sharing it updates automatically.

## Catalog of common standard components (reference — adjust to match the real game)

Most collection/progression game UIs can be decomposed into the components below — check your game's
reference screenshots to see which patterns match, and build that component first:

1. **Standard popup chrome** — 9-slice background + title bar + close button. Nearly every popup
   (Inventory, Shop, Merge, Upgrade...) almost certainly shares one background frame + one title bar
   style + one close button style (there might be 1-2 variants, e.g. a square close button vs. a round
   one — build that variant separately, don't duplicate the entire popup chrome for it).
2. **Grid item cell** — icon + rarity-colored border + quantity + name, reused in Inventory, Shop,
   Merge, Collection... This is usually the MOST reused component in the entire UI.
3. **Star rating** — a row of filled/empty star icons proportional to a ratio, used for rarity, merge
   progress, milestones... Parameterize the total star count too (don't hardcode 5 stars if the game
   can have a different tier count).
4. **Tab bar** — a row of active/inactive toggle buttons, used in Inventory (filtering item types),
   Upgrade (COMBAT/ECONOMY/GARDEN...), Plant Detail (Overview/Skills)...
5. **List popup** — standard popup chrome + a horizontally-listed set of rows (icon + name +
   description + status/button), used for a Boss Selector, milestone lists, reward lists...
6. **Grid + info panel popup** — an optional filter sidebar + a grid of item cells + a detail panel on
   the right when an item is selected. Used for Inventory/Backpack, Shop, Collection...
7. **Progress bar** — used for boss HP, experience, mission progress... Has 2 common variants: one
   with its own background frame (sitting inside a popup) and one drawn directly over the 3D scene (no
   background, needs a readable text outline — see file 03, section 3).
8. **Banner/notification** — a warning or completion notice that appears over the screen briefly then
   disappears, usually with no frame/background, just text plus a light effect.

Don't force every component into exactly these 8 templates — this catalog is a REFERENCE drawn from one
specific game. Look at your own game's real reference screenshots to determine the actual set of
recurring components for that game.

## Template for writing a component (parameterized function)

Each component is a plain JS function that takes a parameter object and returns an HTML string — with
no dependency on global variables other than the style/asset constants already defined (see file 03):

```js
// Example: standard grid item cell — reused across every grid-based popup.
// Params: icon, rarity (looked up in YOUR GAME's RARITY_COLOR table), qty, name, locked, selected.
function itemCell({ icon, rarityColor, qty, name, locked, selected, width = 92, height = 108 }) {
  return `<div class="item-cell" style="position:relative;width:${width}px;height:${height}px">
    ${frameWithTint(FRAME_SPRITE, FRAME_SLICE, rarityColor, 'inset:0')}
    ${locked ? lockOverlay() : `<img src="${icon}" style="position:absolute;inset:12px;object-fit:contain">`}
    ${qty != null ? `<div class="item-qty">${qty}</div>` : ''}
    ${name ? `<div class="item-name">${name}</div>` : ''}
    ${selected ? selectionBorder() : ''}
  </div>`;
}
```

Name parameters after their MEANING (rarityColor, locked, selected), not after raw CSS values (don't
accept a bare `borderColor` — if you later change how rarity is displayed from a colored border to a
separate icon, you only need to change INSIDE the function, not every call site).

## Recommended build order

1. Primitives (file 03) — build first, no dependencies.
2. The simplest, most-reused components (usually the grid item cell, star rating, tab bar).
3. Compound components (popup chrome, grid+panel popup) — CALL the components from step 2, don't
   rewrite the markup from scratch.
4. Individual specific screens — at this point, all that's left is preparing the DATA (the game's real
   data) and calling the appropriate compound component from step 3. If a specific screen needs
   something not yet in the component kit, that's a signal to add a NEW component to the standard kit
   (and consider whether other screens might need it too), rather than writing a one-off chunk of code
   used only once.

## Hard rules (the kit enforces them; layout-lint checks them)

- A component never takes px, hex or sprite paths as params — only meaning (`rarity`, `state`, `size: 's'|'l'`).
- A component never positions itself with `left/top`; layout comes from `stack`/`row` and gap tokens.
- A popup's height is never set: content defines it.
- 9-slice sprites are a separate skin layer behind content, never the content box itself.

## Document the source right inside the component

When a component was derived from a specific `.ui` node, note it in a comment right at that function:
the original node name, the coordinates/slice values used, and whether it's a real measurement or a
guess. This lets the designer (or you, weeks later) quickly trace it back to the original data when
needed — see the disclosure convention in
[08-workflow-and-disclosure.md](08-workflow-and-disclosure.md).
