# 05 — Placing HUD/Popups Over a Real Gameplay Screenshot

When you need to show a HUD (a boss health bar, a progress bar...) at the exact position/scale it
would appear during actual gameplay, the most reliable approach is to place the mockup directly OVER a
real gameplay screenshot, auto-scaling it so the proportions are always correct and it never overflows
the image frame — regardless of how large or small that frame renders on different screens.

The mechanism below is generic and works for ANY HUD/popup — it doesn't depend on any specific game's
assets.

## Concept: the anchor system for an overlay layer

Every HUD/popup needs one of the following anchor types relative to the background image:

| Anchor | Use when |
|---|---|
| `fill` | The HUD covers the entire screen (e.g. a main UI layer that's always visible) — scales on both axes to exactly match the image frame. |
| `corner` | Anchored to a fixed corner using `%` (e.g. top-left, bottom-right) — for a small widget that always sits at one fixed spot on screen. |
| `top-center` / `bottom-center` | Anchored horizontally centered, fixed vertically — for a banner/hotbar that always sits at the top/bottom of the screen. |
| `center` | Anchored centered on both axes — the sensible default for ANY popup (a popup that opens is always centered on screen). |

## Algorithm: only scale DOWN, never scale up

The core principle that keeps a HUD/popup from ever overflowing its image frame, no matter how the
widget's original size compares to the display frame's size:

1. Measure the REAL size of the background image frame (`containerW`, `containerH`) once the image has
   finished loading.
2. Measure the REAL size of the widget rendered at its native 1:1 scale (`widgetW`, `widgetH`).
3. Compute `scale = min(1, containerW × margin / widgetW, containerH × margin / widgetH)` — `margin`
   is usually ~0.94 (leaving ~6% of breathing room around the widget). The `1` inside `min(...)`
   guarantees you NEVER scale up a widget that's already smaller than the frame (avoiding a small HUD
   looking unnaturally huge).
4. Apply `transform: scale(scale)` to the widget, keeping its entire internal structure/markup intact
   (don't break the layout just to force it to fit).

## Generic sample code

```js
// Wrap a widget into a positioned overlay layer, anchored inside the background image frame.
function buildOverlayLayer(widgetHtml, anchor) {
  let posStyle, baseTransform = '', transformOrigin = 'center center';
  if (anchor.type === 'fill') {
    posStyle = 'left:0;top:0'; transformOrigin = 'top left';
  } else if (anchor.type === 'corner') {
    posStyle = `left:${anchor.left};top:${anchor.top}`; transformOrigin = 'top left';
  } else if (anchor.type === 'top-center') {
    posStyle = `left:50%;top:${anchor.top}`; baseTransform = 'translateX(-50%)'; transformOrigin = 'top center';
  } else if (anchor.type === 'bottom-center') {
    posStyle = `left:50%;bottom:${anchor.bottom}`; baseTransform = 'translateX(-50%)'; transformOrigin = 'bottom center';
  } else { // center
    posStyle = `left:50%;top:${anchor.top || '50%'}`; baseTransform = 'translate(-50%,-50%)'; transformOrigin = 'center center';
  }
  return `<div class="overlay-layer" data-anchor="${anchor.type}" data-base-transform="${baseTransform}"
    style="position:absolute;${posStyle};transform:${baseTransform};transform-origin:${transformOrigin}">
    ${widgetHtml}</div>`;
}

// Call this AFTER the overlay has been inserted into the DOM and the background image has loaded —
// measures real sizes and auto-scales.
function fitOverlaysToContainer(containerEl) {
  const cw = containerEl.clientWidth, ch = containerEl.clientHeight;
  if (!cw || !ch) return;
  const margin = 0.94;
  Array.from(containerEl.children)
    .filter(el => el.classList.contains('overlay-layer'))
    .forEach(inner => {
      const base = inner.dataset.baseTransform || '';
      inner.style.transform = base; // reset before re-measuring
      if (inner.dataset.anchor === 'fill') {
        inner.style.transform = `scale(${cw / inner.scrollWidth}, ${ch / inner.scrollHeight})`;
        return;
      }
      const iw = inner.scrollWidth, ih = inner.scrollHeight;
      if (!iw || !ih) return;
      const scale = Math.min(1, (cw * margin) / iw, (ch * margin) / ih);
      if (scale < 1) inner.style.transform = `${base} scale(${scale})`.trim();
    });
}
```

## Common trap: the background image loads asynchronously

If you call `fitOverlaysToContainer()` IMMEDIATELY after inserting the HTML into the DOM, the
background image (often large) may NOT have finished loading yet — at that point,
`containerEl.clientHeight` is either a very small default (if you set a `min-height`) or 0, causing
`scale` to be computed completely wrong (the HUD gets squashed/broken). This bug typically does NOT
show up when you re-test (F5) because by then the image is already in the browser cache. Always handle
both cases:

```js
function renderScene(containerEl, backgroundImgUrl, widgetLayersHtml) {
  containerEl.innerHTML = `<img src="${backgroundImgUrl}" style="display:block;width:100%;height:auto">` + widgetLayersHtml;
  // Call immediately — covers the case where the image is already cached (complete=true right away)
  fitOverlaysToContainer(containerEl);
  // Also attach a 'load' listener — covers the case where the image hasn't loaded yet, recomputing once it does
  containerEl.querySelectorAll('img').forEach(img => {
    img.addEventListener('load', () => fitOverlaysToContainer(containerEl));
  });
}
```

## Stacking multiple HUD layers at once

When you need to show several HUD layers at once (e.g. a persistent main UI layer + a persistent
hotbar + one widget currently being reviewed on top), insert them into the DOM IN THE ORDER YOU WANT
THEM STACKED (a later child renders ON TOP, and is also the one that RECEIVES CLICKS FIRST in the area
it occupies) — you don't need `pointer-events:none` or manual `z-index` as long as the DOM order is
already correct:

```js
containerEl.innerHTML = `<img src="...">`
  + buildOverlayLayer(mainHudHtml, { type: 'fill' })          // bottom layer
  + buildOverlayLayer(hotbarHtml, { type: 'bottom-center', bottom: '4%' })  // middle layer
  + buildOverlayLayer(currentWidgetHtml, { type: 'corner', left: '2%', top: '4%' }); // top layer
```

## Applying this to popups (not just persistent HUD)

This same mechanism also works for showing a SINGLE popup over the gameplay scene image (instead of a
separate modal covering the whole browser viewport) — this approach guarantees the popup always stays
confined to the image frame representing "the game screen," never spilling onto the surrounding web
page. How to do it: insert an additional dark, semi-transparent backdrop layer (which does NOT carry
the `overlay-layer` class, so it isn't scaled — it just covers the image frame exactly), plus one
`overlay-layer` with a `center` anchor containing the popup content, both as direct children of the
image frame; remove both when the popup closes. See a full example (including cleanup so two popups
never stack when a different button is clicked while one is already open) in
[07-interactive-tool-scaffold.md](07-interactive-tool-scaffold.md).

Trade-off to know about and communicate up front: because it's confined to the image frame, a popup
whose native size is larger than the current display frame will automatically render SMALLER than its
true 1:1 pixel size — this is a DELIBERATE trade-off, prioritizing "never overflow the frame" over
"always exactly the right absolute size."
