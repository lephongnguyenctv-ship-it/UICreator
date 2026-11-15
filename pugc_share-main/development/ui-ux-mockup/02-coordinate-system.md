# 02 — Reading Coordinates From `.ui` Files and Converting to CSS

Craftland Studio uses a Unity-style `RectTransform` coordinate system: each node anchors to its parent
using a point or region (0–1 normalized), then offsets by pixels. This is the **single most important**
part of building UI at the correct position — always prioritize computing the exact formula from real
`.ui` data, and only eyeball it when no `.ui` file exists for that screen (and clearly flag it as an
estimate — see file 08).

## Fields to read from each node

| Field | Meaning |
|---|---|
| `anchorMin`, `anchorMax` | The anchor point/region on the parent, normalized 0–1 per axis. If `anchorMin == anchorMax` → anchored to a single fixed point (doesn't stretch with the parent). If they differ → the node stretches along that axis when the parent resizes. |
| `anchoredPosition` (or `pos`) | The offset (px) from the anchor point to this node's `pivot` point. |
| `sizeDelta` (or `size`) | For a single-point anchor: exactly equals the node's real size (px). For a stretch anchor: the amount ADDED to the size implied by the anchor region. |
| `pivot` | The origin point (0–1) inside the node itself that `anchoredPosition` anchors to — determines which direction the node "grows" from the anchor point. |

## The most important gotcha: the Y axis is flipped

Unity/Craftland uses an origin at the **bottom-left**, with the Y axis pointing **up**. CSS
(`position:absolute` with `left/top`) uses an origin at the **top-left**, with Y pointing **down**.
Forgetting to flip the Y axis is the most common conversion bug — every formula below already handles
this, but if you ever write your own conversion from scratch, always remember: **the larger Y is in
`.ui`, the higher up on screen it is, which means a SMALLER `top` in CSS.**

## Conversion formula (single-point anchor — the most common case)

For a node anchored to a single point (`anchorMin == anchorMax == (ax, ay)`), with parent size
`(parentW, parentH)`:

```
// Step 1: the anchor point on the parent, in Unity space (bottom-left origin, Y up)
anchorPxX = ax * parentW
anchorPxY = ay * parentH

// Step 2: the node's pivot point, in Unity space
pivotPxX = anchorPxX + posX
pivotPxY = anchorPxY + posY

// Step 3: convert to CSS (top-left origin, Y down) — width/height come straight from sizeDelta
cssLeft = pivotPxX - pivot.x * width
cssTop  = parentH - pivotPxY - (1 - pivot.y) * height
```

The most common special case: `pivot = (0.5, 0.5)` (anchored at the node's center) — the formula
simplifies to:

```
cssLeft = pivotPxX - width / 2
cssTop  = parentH - pivotPxY - height / 2
```

## Conversion formula (stretch anchor on one or both axes)

When `anchorMin != anchorMax` on an axis (e.g. a full-width node pinned to both the left and right
edges of the parent), the size along that axis is NOT taken directly from `sizeDelta` — instead:

```
width  = (anchorMaxX - anchorMinX) * parentW + sizeDeltaWidth
height = (anchorMaxY - anchorMinY) * parentH + sizeDeltaHeight
```

`sizeDeltaWidth/Height` here is usually a small negative number (a margin pulled in from both sides) or
0 (flush full-width). `left`/`top` are still computed from `anchoredPosition` anchored to the center of
that stretch region.

## Generic sample code (reusable as-is)

```js
// Convert a .ui node into {left, top, width, height} in px, usable directly as absolute-position CSS.
// Supports both single-point anchors and per-axis stretch anchors.
function uiRectToCss(node, parentW, parentH) {
  const [aMinX, aMinY] = node.anchorMin;
  const [aMaxX, aMaxY] = node.anchorMax;
  const [posX, posY] = node.anchoredPosition;
  const [pivotX, pivotY] = node.pivot;

  const stretchX = aMaxX !== aMinX;
  const stretchY = aMaxY !== aMinY;

  const width = stretchX
    ? (aMaxX - aMinX) * parentW + node.sizeDelta[0]
    : node.sizeDelta[0];
  const height = stretchY
    ? (aMaxY - aMinY) * parentH + node.sizeDelta[1]
    : node.sizeDelta[1];

  // Anchor point: use the midpoint of the anchor region (equals anchorMin==anchorMax for a point anchor)
  const anchorPxX = ((aMinX + aMaxX) / 2) * parentW;
  const anchorPxY = ((aMinY + aMaxY) / 2) * parentH;

  const pivotPxX = anchorPxX + posX;
  const pivotPxY = anchorPxY + posY;

  return {
    left: pivotPxX - pivotX * width,
    top: parentH - pivotPxY - (1 - pivotY) * height,
    width,
    height,
  };
}
```

## Determining the parent size (`parentW`/`parentH`)

`.ui` files usually do NOT store the original Canvas size inside each individual node — you need to
determine the original design canvas size from one of: the Canvas/root node at the top of the `.ui`
tree, the dev team's design documentation, or by inferring it from the game's standard aspect ratio
(often 16:9 or a mobile portrait/landscape ratio). If unsure, **clearly flag this as an estimate** —
an error in the parent size will skew the coordinates of EVERY child node, making this one of the
things most worth double-checking with the designer if you're not certain.

## When building a mockup: pick a fixed canvas size per screen type

To make it easy to compare a mockup with reference images, build each screen type (popup, HUD...) on a
`<div>` with a fixed `width`/`height` matching the real parent size determined above (e.g. a 930×500px
popup), then position child nodes inside it with `position:absolute` using the converted coordinates.
This keeps a true 1:1 ratio between the mockup and the real game, and is required for the
scale-to-fit mechanism in
[05-scene-and-hud-anchoring.md](05-scene-and-hud-anchoring.md) to work correctly.
