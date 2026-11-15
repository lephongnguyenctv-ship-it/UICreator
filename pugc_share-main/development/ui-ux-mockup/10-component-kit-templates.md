# 10 — Component Kit Templates (copy, configure once, compose)

Ready-to-copy files in [`templates/`](templates/). They turn [04-component-library.md](04-component-library.md)
from advice into working code, so every agent builds screens from the same parts.

| File | Role |
|---|---|
| [`templates/ui-kit.css`](templates/ui-kit.css) | Tokens (`:root`) + flow layout classes + text roles + skin/content layering + `.k-debug` outline mode |
| [`templates/ui-kit.js`](templates/ui-kit.js) | `KIT` config (skins, rarity/element tables) + primitives + components. Browser and Node |
| [`templates/example-screens.js`](templates/example-screens.js) | `SCREENS` registry template: 3 popup patterns + parts, built only from kit calls |
| [`templates/kit-gallery.html`](templates/kit-gallery.html) | Component gallery: renders every screen; "Outline boxes" toggle to see layout boxes |
| [`templates/layout-lint.js`](templates/layout-lint.js) | No-browser lint (tokens, grid, colors, overflow, overlap, manual positioning). `--self-test` included |
| [`templates/component-spec.template.md`](templates/component-spec.template.md) | One-page spec per component (anatomy, tokens, skins, states, do/don't) |

## Setup (once per project)

1. Copy `templates/` into the tool (e.g. `public/kit/`). Keep file names.
2. Fill `ui-kit.css` tokens from real data ([09](09-design-tokens-and-layout.md)).
3. Fill `KIT.skins` in `ui-kit.js`: sprite file, 9-slice from the sprite `.meta`, default tint from `.ui`.
   Skins with `src: null` render as flat fallback and layout-lint warns until they are real.
4. Copy the rarity/element tables from the game's code/config into `KIT.rarity` / `KIT.element`.
5. Open `kit-gallery.html`, get the designer to approve the parts once (see [11](11-component-extraction-workflow.md)).
6. Add `node layout-lint.js --self-test` and `node layout-lint.js --screens <your screens.js>` to the
   project's check script.

## Component catalog (semantic params only)

| Function | Use for | Key params |
|---|---|---|
| `popup({size, title, body, footer, close})` | every popup shell; height grows with content | `size` s/m/l |
| `panel(children)` / `card(children, {special})` | section inside popup / row or card inside section | `gap`, `pad` steps |
| `stack(children, {gap, center})` / `row(children, {gap, between, wrap})` / `grow(x)` | ALL layout | gap step 1–6 |
| `text(str, role, {tone, align, ellipsis, rarity})` | all text | role caption/body/label/value/title/hero |
| `iconCell({icon, rarity, qty, size, selected})` | any icon in a frame | size s/l |
| `hero({icon, rarity, value, title, subtitle})` | the one focal block of a popup | — |
| `compareTable([[label, before, after]])` | upgrade / break / level-up previews | — |
| `kvTable([[label, value, tone]])` | plain stats | tone good/bad/muted |
| `costChips([{icon, text, ok}])` | costs; equal-width grid that wraps, red when short | — |
| `listRow({icon, title, subtitle, right})` | lists (where to get, rewards, unlocks) | `right` slot |
| `newCard({icon, kicker, title, desc, badgeText})` | highlight something new | — |
| `button(label, {variant, state, full})` | actions; `soft-off` = looks off, stays clickable | primary/action/danger |
| `badge`, `stars`, `progressBar`, `tabs`, `note`, `divider`, `scrim` | small parts / preview backdrop | — |

## Screen template

```js
{
  id: 'break_confirm', group: 'Break', label: 'Break confirm',
  ref: null,                         // reference screenshot path when one exists
  render() {
    return K.scrim(K.popup({
      size: 's', title: 'Break Level',
      body: [
        K.hero({ icon, rarity, title: plantName, subtitle: `Tier ${t}/6` }),
        K.compareTable(rows),          // data prepared above, from config
        K.costChips(costs),
      ],
      footer: K.button(lacking ? 'Not enough material' : 'Break', { variant: 'action', state: lacking ? 'soft-off' : 'normal' }),
    }));
  },
  mapping: [['Whole popup', 'Kit composition: hero + compareTable + costChips', 'new']],
}
```

A screen file contains data preparation and kit calls only. If a screen needs something the kit cannot
express, **add or extend a component** (and its spec), then use it — never inline one-off markup.

## Extending the kit safely

1. Write the spec first (`component-spec.template.md`).
2. Implement with existing tokens and skins; add a token only if the value is measured.
3. Add a gallery entry showing every state.
4. Run lint + render sweep over ALL screens (a component change touches every screen using it).
5. Bump the tool version and note the component change in the changelog.

## Rebuild mode (Mode A) with the kit

For a screen rebuilt from a real `.ui` file, keep the absolute coordinates inside one container marked
`data-abs-ok`, but still use `skin()` for every sprite and token colors for text, so the screen matches
the rest of the kit wherever the `.ui` data does not say otherwise.
