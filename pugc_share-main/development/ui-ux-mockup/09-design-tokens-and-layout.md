# 09 — Design Tokens and Flow Layout (why mockups drift, and the fix)

Most "everything is slightly off" feedback has the same three causes. Fix them with rules, not with more
careful eyeballing:

| Cause | What it looks like | Rule that removes it |
|---|---|---|
| Hand-computed absolute coordinates (`left/top` math per element, popup height summed by hand) | Rows overlap after one text change, a footer floats 6 px off, a button sits outside its panel | **New designs use flow layout** (`stack`/`row` with gap tokens). Absolute positions only for a 1:1 rebuild of a real `.ui` node, marked `data-abs-ok` |
| Free values per screen (14 px here, 15 px there, `#6b5a3b` vs `#6b5a3a`) | Two popups look "almost" the same; designer cannot say why | **Tokens only.** Every font size, gap, size and color is a named token measured once from the game |
| Content placed inside a `border-image` box | Text or a price pill overflows a 9-slice button; padding differs per sprite | **Skin layer + content layer.** The 9-slice sprite is painted on its own layer behind content; content padding comes from tokens |

## Two build modes — decide per screen before writing code

| Mode | When | Layout method | Mark in `mapping` |
|---|---|---|---|
| **A. Rebuild** | A real `.ui` file exists for this screen | Absolute positions converted with [02-coordinate-system.md](02-coordinate-system.md), inside a fixed-size container. Wrap the container in `data-abs-ok` | `real` per node |
| **B. New design** | No `.ui` file (new popup, redesign, option exploration) | Compose kit components ([10-component-kit-templates.md](10-component-kit-templates.md)). No `left/top`, no hand-set height | `new` |

Mode B is where agents drifted most: they copied the absolute style of Mode A screens and invented
coordinates. Never do that.

## The token sheet

Tokens live in one file (`templates/ui-kit.css`, `:root`). Fill it ONCE per game, before the first screen:

| Group | Tokens | How to measure |
|---|---|---|
| Grid | `--k-grid` (usually 4 px) | Look at `.ui` offsets/sizes: most are multiples of 4 or 5. Pick the one that fits most values |
| Spacing | `--k-sp-1..6` | Gaps between rows, panel padding, popup inner margin in 3–4 real screens. Round to the grid |
| Type scale | `--k-fs-caption/body/label/title/popup/hero` | `fontSize` of text nodes in `.ui` (engine font ≠ web font: keep the ratio, adjust once, then freeze) |
| Sizes | popup widths S/M/L, title bar height, close size, row height, icon cell S/L, button height | Root sizes of real popups and repeated nodes |
| Palette | text 1/2/muted, good/bad, accent, surfaces popup/panel/card/special | `Image.color` / text colors in `.ui`; pick with a color picker from screenshots when `.ui` has none |
| Classification | rarity / element tables (bg + text color) | Copy from the game's code or config. Never invent |

Write the source next to each token (`.ui` node or screenshot) in a comment. A token without a source is
`approx` and must be listed for the designer.

## Spacing rhythm for popups (Mode B defaults)

| Between | Token |
|---|---|
| Popup edge → content | `--k-sp-3` |
| Section → section (hero, table, cost, footer) | `--k-sp-3` |
| Rows inside a card | `--k-sp-2` |
| Icon → text in a row | `--k-sp-2` / `--k-sp-3` |
| Label → value pairs | push apart with a growing spacer (`grow()`), never with a fixed width |

Rules: one hero per popup; at most one primary button; text left-aligned except hero/notes; numbers
right-aligned in tables; wrap instead of truncating (use `.k-ellipsis` only for names in lists).

## Enforce it

`templates/layout-lint.js` fails the build on off-scale font sizes, off-grid spacing, unknown colors,
hand-set popup heights, absolute children overflowing their parent and overlapping absolute siblings,
and warns on manual `left/top` inside kit popups. Run it with the render sweep
([06-verification-strategy.md](06-verification-strategy.md)).
