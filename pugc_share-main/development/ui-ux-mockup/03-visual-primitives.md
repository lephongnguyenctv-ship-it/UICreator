# 03 — Techniques for Engine-Accurate Rendering

Three foundational CSS techniques that make a mockup look "like the real engine" instead of looking
like a generic web app. This is generic code — it contains no asset/color from any specific game; you
supply the real sprites/colors yourself.

## 1. 9-slice frames (border-image)

Most UI frames (popups, buttons, item cards...) in Craftland use 9-slice sprites: the 4 corners keep
their original pixel size, while the 4 edges and the center stretch to fit the display size. Building
this with a flat `<div>` background color or `background-size:cover` will distort the corners — you
MUST use CSS's `border-image` correctly.

The slice values (how many px per edge stay unstretched) should come from the **import settings/`.meta`
file that ships alongside the sprite** in the game project (wherever the engine stores real 9-slice
border data), not guessed by inspecting the alpha channel — many sprites have a border that's a painted
detail rather than a transparent region, so scanning alpha will get it wrong.

```css
.nine-slice-frame {
  border-style: solid;
  /* These 4 numbers MUST be identical between border-width and border-image-slice, or the corners get scaled */
  border-width: <top>px <right>px <bottom>px <left>px;
  border-image-source: url(<real sprite>);
  border-image-slice: <top> <right> <bottom> <left> fill; /* fill = also render the center */
  border-image-repeat: stretch; /* or round if the edge has a repeating pattern that can't stretch continuously */
}
```

Generic helper function:

```js
function nineSliceStyle(spriteUrl, top, right, bottom, left) {
  return {
    borderStyle: 'solid',
    borderWidth: `${top}px ${right}px ${bottom}px ${left}px`,
    borderImageSource: `url(${spriteUrl})`,
    borderImageSlice: `${top} ${right} ${bottom} ${left} fill`,
    borderImageRepeat: 'stretch',
  };
}
```

## 2. Sprite tinting — two different techniques depending on sprite type

Engines usually tint sprites by multiplying a color onto the original texture (`Image.color` in
Unity-style engines). CSS has no direct "multiply tint" property on `border-image`/`background-image`,
so you need one of the two techniques below — **pick the right one based on what the source sprite
actually looks like**:

### 2a. Source sprite is a pure WHITE/alpha shape (icon, glyph) → use CSS `mask`

Check first: open the sprite in an image viewer — if every non-transparent pixel is close to white (or
the engine explicitly documents this sprite as freely tintable), use the mask technique for an EXACT
tint color, with no bleed from the original:

```js
function tintMask(spriteUrl, colorHex, extraStyle = '') {
  return `background-color:${colorHex};` +
    `-webkit-mask-image:url(${spriteUrl});mask-image:url(${spriteUrl});` +
    `-webkit-mask-size:contain;mask-size:contain;` +
    `-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;${extraStyle}`;
}
```

### 2b. Source sprite HAS real color/shading detail (wood frame, fabric, metal...) → multiply overlay

If you tint this kind of sprite with a mask, all shading detail is lost (it becomes one flat color) —
which won't match the real in-game look. Use a `mix-blend-mode: multiply` overlay layer to keep the
detail:

```html
<div style="position:relative;width:Wpx;height:Hpx;isolation:isolate">
  <!-- 9-slice frame layer, original sprite -->
  <div style="position:absolute;inset:0; <nine-slice-frame CSS above> "></div>
  <!-- tint layer, ON TOP, same size — skip this layer entirely if the tint is white/no color change -->
  <div style="position:absolute;inset:0;background-color:TINT_HEX;mix-blend-mode:multiply;pointer-events:none"></div>
</div>
```

`isolation: isolate` on the outer wrapper is mandatory — without it, `mix-blend-mode: multiply` will
"bleed" through to elements behind it in the whole page's stacking order instead of only blending with
the sprite directly beneath it.

Generic helper function combining both frame + tint (skips the tint layer when no color change is
needed):

```js
function frameWithTint(spriteUrl, sliceLTRB, tintHex, posStyle) {
  const [top, right, bottom, left] = sliceLTRB;
  const frameCss = `position:absolute;inset:0;border-style:solid;` +
    `border-width:${top}px ${right}px ${bottom}px ${left}px;` +
    `border-image-source:url(${spriteUrl});` +
    `border-image-slice:${top} ${right} ${bottom} ${left} fill;` +
    `border-image-repeat:stretch;`;
  const tintDiv = tintHex
    ? `<div style="position:absolute;inset:0;background-color:${tintHex};mix-blend-mode:multiply;pointer-events:none"></div>`
    : '';
  return `<div class="frame" style="position:relative;isolation:isolate;${posStyle}">` +
    `<div style="${frameCss}"></div>${tintDiv}</div>`;
}
```

### Rule of thumb: if unsure whether to use mask or multiply, try both and compare against the reference image

If the mask result looks flat/missing detail compared to the reference image → the sprite has real
shading, switch to multiply. If the multiply result looks off-color (mixed in with unwanted original
detail) → the sprite was already pure white, switch to mask. Don't guess — always check directly
against a real screenshot.

## 3. Text outlines readable over a moving/varied background

HUD elements rendered directly over the 3D gameplay scene (with no dedicated popup background) need a
4-direction black outline to stay readable against ANY background color, since you can't know in
advance whether the background behind it will be light or dark:

```js
function textOutline(color = '#000', size = 1) {
  const s = size;
  return `${-s}px ${-s}px 0 ${color}, ${s}px ${-s}px 0 ${color}, ` +
    `${-s}px ${s}px 0 ${color}, ${s}px ${s}px 0 ${color}`;
}
// Usage: style="text-shadow:${textOutline()}"
```

Apply this `text-shadow` to EVERY line of text that sits directly on the scene (don't apply it to text
inside a popup that has its own background — contrast is already sufficient there, and adding an
outline would be redundant/ugly).

## General principle when building primitives

- Turn each technique into a REUSABLE helper function (as above) instead of repeating hand-written CSS
  per screen — this is the foundation the next step
  ([04-component-library.md](04-component-library.md)) needs in order to build more complex components
  consistently.
- Never fabricate color/slice values when you don't have real data — see
  [01-input-checklist.md](01-input-checklist.md) and
  [08-workflow-and-disclosure.md](08-workflow-and-disclosure.md).
