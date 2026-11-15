# Component spec — `<functionName>`

> One page per kit component. Fill before implementing; update when the component changes.

| Field | Value |
|---|---|
| Purpose | One line: what the player needs to understand from it |
| Used in | Screens (ids) that use it |
| Source | `.ui` node name(s) / screenshot / new design |
| Status | real / approx / new |

## Anatomy

```
┌─────────────────────────────┐
│ [icon] Title           [→]  │   ← example: list row
│        subtitle             │
└─────────────────────────────┘
```

| Part | Kit piece | Token / skin |
|---|---|---|
| Frame | `card()` | skin `card` |
| Icon | `iconCell()` | `--k-cell`, skin `cell` tinted by rarity |
| Title | `text(..., 'value')` | `--k-fs-label`, `--k-text` |
| Gap icon → text | `row({gap: 3})` | `--k-sp-3` |

## Params

| Param | Type | Meaning | Default |
|---|---|---|---|
| `title` | string | … | — |

## States

| State | Visual change | Example |
|---|---|---|
| normal | — | |
| selected | `selected` skin ring | |
| disabled-soft | `soft-off` filter, still clickable | |

## Do / Don't

- Do: …
- Don't: pass px, hex or sprite paths; set `left/top`; fix a width on text.

## Open questions

- Values marked `approx` and what the designer must confirm.
