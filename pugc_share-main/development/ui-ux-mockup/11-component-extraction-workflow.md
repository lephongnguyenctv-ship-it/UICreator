# 11 — Extracting Components From an Existing Game or Mockup Set

Use this when a project already has screens (real `.ui` files, screenshots, or an older mockup tool) and
you need a consistent kit before building more. Output: a filled token sheet, a configured kit, one spec
per component, an approved gallery.

## Step 1 — Inventory

List every screen with: source (`.ui` / screenshot / mockup only), popup size, and the visible parts.
Put it in a table — one row per screen, one column per candidate part:

| Screen | Size | Title bar | Hero | Table | Cost | List rows | Grid cells | Tabs | Buttons |
|---|---|---|---|---|---|---|---|---|---|
| Shop | 1000×540 | ✓ | | | ✓ | | ✓ | | Buy |
| Item info | 640×auto | ✓ | ✓ | | | ✓ | | | — |

A part that appears in **2+ screens** becomes a kit component. A part used once stays local only if it
truly cannot be expressed with existing components.

## Step 2 — Measure values, then cluster them

For each candidate part, collect the raw values from every screen (font sizes, paddings, row heights,
colors, sprite + slice). Then cluster:

- Values within 1–2 px of each other are the same token (pick the `.ui` value, else the most common).
- Colors within a tiny distance (`#6b5a3a` vs `#6b5a3b`) are the same token.
- Keep a value apart only if the designer confirms the difference is intended.

Record the clusters as the token sheet ([09](09-design-tokens-and-layout.md)) with the source of each.

## Step 3 — Write one spec per component

Copy [`templates/component-spec.template.md`](templates/component-spec.template.md). Fill anatomy, tokens,
skins, states and do/don't. Specs are short (one screen) and live next to the kit, so a new agent reads
the spec instead of reverse-engineering old screens.

## Step 4 — Implement in the kit and build the gallery

Implement each component in `ui-kit.js` with semantic params. Add every state to the gallery
(`example-screens.js` or the project's own screens file). Toggle "Outline boxes" to check alignment.

## Step 5 — Golden screens (designer approval)

Ask the designer to approve the gallery once. Then mark 3–5 representative screens as golden:
save their `render()` HTML to `golden/<id>.html`. After any kit change, re-render and diff against golden
files; every changed golden screen must be shown to the designer before reporting done.

## Step 6 — Migrate old screens gradually

Do not rewrite everything at once. When a screen gets feedback, rebuild it from kit components in that
round. Track migration in the inventory table (`kit` / `legacy`). Legacy screens keep working; new
screens are kit-only.

## Lessons from the source project (why this matters)

- Each new popup copied the nearest old popup and adjusted numbers. After ~10 popups there were five
  "standard" row heights and three text browns.
- Hand-summed heights (`HERO_TOP + HERO_H + 15 + ...`) broke whenever one row was added.
- A price pill inside a 9-slice button overflowed because the `border-image` width ate the content box.
- A caption wrapper with `text-align:center` silently centered all text in a popup.
- Long numbers were cut off by fixed-width cells with `overflow:hidden`.

All five are prevented by flow layout, tokens, the skin/content split and layout-lint.
