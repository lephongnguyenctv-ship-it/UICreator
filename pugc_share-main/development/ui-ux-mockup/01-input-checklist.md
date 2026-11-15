# 01 — Input Data Checklist

Before building any UI/UX screen, gather as many of the items below as possible. **Do not start
building UI based on guesswork if an important item is missing** — ask the designer instead, or build
a temporary version and clearly flag it as an assumption (see
[08-workflow-and-disclosure.md](08-workflow-and-disclosure.md)).

## 1. `.ui` files (required for accurate coordinates)

The JSON file exported by Craftland Studio, containing the node tree for each popup/HUD. Each node
usually has:

- `anchorMin` / `anchorMax` — the anchor point on the parent (0–1), determining which edge/corner the
  node "sticks" to.
- `anchoredPosition` (or `pos`) — the offset from the anchor point.
- `sizeDelta` (or `size`) — the size; added on top of the size implied by the anchor if the anchor
  isn't a single point (stretch).
- `pivot` — the node's own origin point used when computing its position.
- Sprite name / tint color (`Image.color`) if the node is an image.
- Text, font size, text color if the node is text.

If the designer only has `.ui` files for SOME screens, build those screens first using real
coordinates; for other screens, temporarily estimate by eye from reference images — and **always
clearly note which screens use real `.ui` coordinates and which are eyeballed** (this is the single
most important annotation in the whole process).

## 2. Real screenshots (required)

Real in-game screenshots of each screen, ideally covering multiple states (e.g. a popup before/after
selecting an item, a HUD at full health vs. near-death). Screenshots are the most important source for
verifying COLOR when the `.ui` file doesn't specify a color explicitly, or when the `.ui` file and the
screenshot conflict (this does happen — see item 5 below).

If you have a pixel color-picker tool (an image color picker / PIL...), use it to get the exact hex
value from the reference image instead of eyeballing it.

## 3. Exported assets/sprites

The folder containing the actual sprite PNG files referenced by name in the `.ui` file. If a filename
referenced in `.ui` doesn't exist anywhere in the exported asset folder, that's a gap you should ask
the designer about — the asset might live in a different folder or hasn't been exported yet. Do NOT
guess by silently substituting a placeholder image without saying so.

Special note for shared/library icons (platform-bundled resources rather than assets unique to the
game): if the game uses a standardized shared icon library (e.g. arrow icons, lock icons, loop
icons...), confirm with the designer whether that library folder is available locally before
fabricating a substitute icon.

## 4. Color-based classification table (rarity/element/tier...) — if applicable

Many Craftland games use color to classify rarity/element/tier (common items are green, rare ones are
purple...). If your game has this system, get the exact list of tiers plus real hex colors (from `.ui`
or measured from reference images) before building any component that uses classification colors —
otherwise you risk picking a color that "looks reasonable" and later having to redo every screen that
already used it.

## 5. List of known data conflicts (if any)

Sometimes the `.ui` file and reference screenshots DON'T match (e.g. `.ui` says orange tint but the
screenshot shows brown — possibly the screenshot was captured from an older/different build). When
this happens:

- Prefer the reference screenshot (since that's what the designer/dev actually sees in the game during
  review), unless the designer says otherwise.
- Clearly document this conflict in that screen's mapping/disclosure — don't silently pick one source
  and drop the other.

## 6. File naming/organization convention (recommended, not required)

If the designer doesn't already have one, propose organizing the project like this (details in file
07):

```
project/
  design/ui-example/        <- original screenshots, named by screen id (e.g. boss_selector.png)
  design/ui-source/         <- original .ui files, shared library assets if they need copying separately
  tools/ui-mockup/
    server.js
    public/
      assets/sprites/       <- exported assets, keeping the original folder structure where possible
      css/style.css
      js/uiux.js             <- all components + the SCREENS registry (see files 04, 07)
      uiux.html
```

This exact structure isn't mandatory, but stick to one consistent convention throughout the project so
it's easy to find things again when a new screen or designer feedback comes in.
