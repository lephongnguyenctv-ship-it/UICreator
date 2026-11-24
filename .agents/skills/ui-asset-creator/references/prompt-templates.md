# Web Gemini Prompt Templates for UI Asset Creation

Use these templates when handing off a generation prompt to the user for web Gemini. Remind the user to attach the chosen style reference image (such as [casual-rpg-icons.png](../resources/styles/casual-rpg-icons.png)) when matching an existing pack.

---

## 1. `1:1` Square Icon / Prop (Default — White Background)

Best for closed-outline icons, potions, weapons, chests, backpacks, badges, and props without enclosed background holes.

```text
Generate a single 2D game UI icon of <SUBJECT>, matching the exact art style of the attached reference icons (bold continuous black outer contour, chunky simplified silhouette, vibrant glossy cel-shaded + smooth gradient coloring, crisp white specular highlights, slight playful tilt, no tiny noisy details).

Technical constraints for clean cutout:
- 1:1 square image, centered with generous white margin on all four sides (nothing cropped).
- Completely flat, pure solid #FFFFFF white background.
- Every part inside the icon must be 100% solid opaque color (NO semi-transparent glass, NO transparency effects, NO soft alpha fade). Render glass or shine using solid opaque cel-shaded pale blue/white colors.
- Keep the outer black contour completely closed around the entire icon.
- NO checkerboard pattern, NO gradient background, NO drop shadow, NO floor shadow, and NO outer glowing aura.
```

**Processing flags**: `-Mode white` (or `auto`) `-Aspect square -Size 256`

---

## 2. `1:1` Icon with Enclosed Holes or Floating Details (Chroma-Key)

Use when the subject has enclosed interior background holes (rings, keys, padlocks, scissors, mug handles) where outer white flood-fill cannot reach inside, or floating sparkles (`-KeepAllComponents`).
- Use `#00FF00` bright chroma green by default.
- Use `#FF00FF` bright chroma magenta if the sprite itself contains green (emeralds, leaves, green arrows).

```text
Generate a single 2D game UI icon of <SUBJECT>, matching the exact art style of the attached reference icons (bold continuous black outer contour, chunky simplified silhouette, vibrant glossy cel-shaded + smooth gradient coloring, crisp white specular highlights, no tiny noisy details).

Technical constraints for clean cutout:
- 1:1 square image, centered with generous margin on all four sides (nothing cropped).
- Completely flat, pure solid <CHROMA_COLOR> (#00FF00 bright green OR #FF00FF bright magenta) background everywhere behind the icon and inside any enclosed holes/loops.
- Every part inside the icon must be 100% solid opaque color (NO semi-transparent glass, NO alpha fade).
- NO checkerboard pattern, NO gradient background, NO drop shadow, NO floor shadow, and NO outer glowing aura.
```

**Processing flags**: `-Mode green` (or `magenta` / `auto`) `-Aspect square -Size 256` (add `-KeepAllComponents` if floating sparkles/detached parts should be kept)

---

## 3. Non-Square UI Panel / Button / Bar (9-Slice Friendly)

Use for rectangular HUD bars, wooden/stone/metal dialog panels, pill buttons, tabs, and progress frames.

```text
Generate a single 2D game UI <ELEMENT_TYPE (e.g., wooden button / RPG dialog panel / health bar frame)> facing straight-on (0-degree flat front orthographic view, NO 3D perspective tilt), matching the bold dark-outlined cel-shaded casual mobile game UI style of the attached reference.

Technical constraints for clean cutout & 9-slicing:
- <ASPECT_RATIO (e.g., 3:1 wide horizontal / 16:9 landscape)> composition, centered with generous #FFFFFF white margin on all sides.
- Completely flat, pure solid #FFFFFF white background (or #00FF00 if the frame has hollow interior cutouts).
- Straight, symmetric edges and clean uniform corners suitable for 9-slice scaling; keep center area clean/uncluttered.
- 100% solid opaque colors everywhere inside the frame (NO semi-transparent fill, NO drop shadow, NO outer glow).
```

**Processing flags**: `-Aspect preserve -Size 512` (or `-Size 0` to keep full native size)

---

## 4. Pixel Art Sprite / Icon

Use when matching pixel-art packs (e.g. `Sprite sheets/`).

```text
Generate a single 2D 16-bit pixel art game sprite of <SUBJECT>, crisp pixel grid with clean dark pixel-art outlines, limited cohesive color palette, NO anti-aliasing, NO smooth gradients, NO blur.

Technical constraints for clean cutout:
- 1:1 square centered with generous margin on all sides.
- Completely flat solid #00FF00 chroma-key green background (or #FF00FF if the sprite uses green).
- 100% solid opaque pixels inside the sprite, NO drop shadow, NO outer glow, NO checkerboard.
```

**Processing flags**: `-Mode green -Aspect square -Size 256` (or `-Lossless` / smaller `-Size` depending on target pixel density)

---

## 5. Pure-White Multiply-Tintable UI Piece (Craftland Engine)

Use for reusable 9-slice panels, buttons, tabs, item slots, rarity frames, badges, and progress bars that will be color-tinted in Craftland (`image.color` / `button.normal`) or HTML preview (`data-tint`).

> **Critical:** Because pure-white surfaces (`#FFFFFF`) would be eaten by `-Mode white` flood-fill, **always** generate pure-white pieces on a solid `#00FF00` bright green (or `#FF00FF` magenta) chroma-key background and process with `-Mode green` (or `-Mode magenta`) + `-WhiteFloor`.

```text
Generate a single 2D game UI <ELEMENT_TYPE (e.g., rounded wood-grain tab / ornate square item slot / beveled button)> facing straight-on (0-degree flat front orthographic view, NO 3D perspective tilt).

Pure-white tintable material rules:
- Recolor the entire piece to pure white so it can be multiply-tinted cleanly in a game engine.
- All flat surfaces must be pure white (#FFFFFF). Keep form and surface texture readable using only very light grey shading, with the darkest shadow no darker than #D0D0D0.
- NO mid grey, NO dark grey, NO beige, NO color tint anywhere. It should read like a softly lit white paper/plaster model of the piece.
- Straight, symmetric edges and crisp corners suitable for 9-slice scaling; uniform uncluttered middle region; NO text and NO icon inside.

Technical constraints for clean cutout:
- <ASPECT_RATIO (e.g., 1:1 square / 3:1 horizontal)> composition, centered with generous margin on all sides.
- Completely flat, pure solid #00FF00 bright chroma-key green background everywhere behind the piece and inside any hollow openings.
- 100% solid opaque pixels inside the shape, NO drop shadow outside the shape, NO outer glow, NO checkerboard.
```

**Processing flags**: `-Mode green -Aspect preserve -Size 512 -WhiteFloor` (or `-Aspect square -Size 256 -WhiteFloor` for square slots)

---

## 6. Multi-Color Split-Layer Extraction (Combined + Pixel-Aligned Layers)

Use when an approved UI piece has **two or more independent color areas** (e.g., panel face + metallic trim, frame + colored inset, progress track + fill) that need independent tinting in Craftland. Always generate **both** a Combined version and per-region Split layers on the exact same canvas.

### 6a. Combined Reference Piece (Single Image)
Use Template 3 or Template 5 with `-Mode green -Aspect preserve -Size 0` to keep full reference dimensions.

### 6b. Pixel-Aligned Split Layer Prompt (Repeat Once Per Color Region)
Attach the combined piece (or approved screen) as the reference image.

```text
Using the attached reference image, isolate ONLY the <REGION_NAME (e.g., outer gold border trim / inner wood backing face)> and remove everything else.

Pixel-alignment & pure-white rules:
- Output on a canvas of EXACTLY the same size and aspect ratio as the attached reference image, leaving the isolated region in its EXACT original pixel position.
- Do NOT recenter, do NOT crop, do NOT resize, and do NOT shift the region.
- Recolor the isolated region to pure white (#FFFFFF flat surfaces, darkest shading no darker than #D0D0D0, no mid/dark grey, no color tint).
- Replace everything outside the isolated region (including removed layers and holes) with completely flat, pure solid #00FF00 bright chroma-key green.
- Straight-on 2D orthographic view, NO drop shadow, NO outer glow, NO text, NO icon.
```

**Processing flags**: `-Mode green -PreserveCanvas -Size 0 -KeepAllComponents -WhiteFloor` *(keeps exact source pixel coordinates across every layer so they stack pixel-for-pixel in Craftland; omit `-Size 0` and pass the same `-Size <N>` to all layers if downscaling uniformly)*

---

## 7. Matte Hand-Painted Craftland Style Modifier (Optional Render Block)

Append this render block to any template (or full-screen mockup prompt) when matching muted hand-painted mobile UI rather than glossy cel-shaded icons. Also enforce Craftland's verified text constraints (never name custom fonts; only solid/2-stop vertical gradient, simple outline, or simple drop shadow).

```text
Style & render constraints:
- Hand-painted 2D mobile game UI, flat-on orthographic view, no perspective.
- No heavy dark cartoon contour outlines around shapes. Define edges with soft painted shading and a subtle top rim light only.
- Muted, slightly desaturated palette using these exact hex colors: <LIST 5-7 HEX COLORS WITH ROLES>.
- Soft diffused lighting, flat matte finish. No glossy plastic sheen, no strong specular highlights, no neon saturation, no heavy vignette.
- Clean separation between elements: no overlapping glow or shared shadow spilling across adjacent panels.
```

---

## 8. 1-Pass Multi-Component Sprite Sheet (Fast Batch Extraction)

Use when extracting 3–6 reusable UI pieces from an approved concept screen in a single generation pass (then slice automatically with `game-ui-preview/scripts/slice_sprites.py`). Note: single-sheet generation trades per-piece resolution for speed — run large hero 9-slice panels individually via Template 5 when pixel-clean borders are required.

```text
Using the attached approved UI screen as source, extract the following UI components onto ONE square 1:1 sprite sheet:
1. <COMPONENT_1 (name + location in source screen)>
2. <COMPONENT_2 (name + location in source screen)>
3. <COMPONENT_3 (name + location in source screen)>

Sheet layout & cutout rules:
- Arrange pieces in a loose grid (largest pieces on top rows, small icons/ornaments on bottom rows), upright, straight-on, at natural proportions, none cropped by the canvas edge.
- Leave wide empty gaps between every piece: nothing touching, nothing overlapping, NO shared drop shadow.
- Recolor every piece to pure white (#FFFFFF flat surfaces, darkest shadow >= #D0D0D0, no color tint) unless color is explicitly requested.
- Completely flat, pure solid #00FF00 bright chroma-key green background across the entire sheet.
- NO text, NO labels, NO numbering, NO captions, NO grid lines, NO outer frame around the sheet.
```

**Post-processing**: Strip `#00FF00` with `process_asset.ps1 -Mode green -PreserveCanvas -KeepAllComponents -Size 0 -Lossless -WhiteFloor`, then slice individual pieces with `python .agents/skills/game-ui-preview/scripts/slice_sprites.py`.

---

## Reference Image Attachment Rules (All Prompts)

Whenever attaching reference images in web Gemini / GPT:
- **Maximum 3 images.** More than 3 causes random style/layout blending.
- **One explicit job per image:** e.g., Image 1 = layout only; Image 2 = material/color only (prefer your most recently approved screen to keep game-wide consistency); Image 3 = live in-game screen when preserving existing UX.
- **Always state what to take and what to ignore** using this lead-in above the prompt:
  ```text
  Reference images are attached. Use image 1 for LAYOUT ONLY; ignore its colors and frame. Use image 2 for MATERIAL AND COLOR ONLY; ignore its shape and layout. Follow the written description below wherever it overrides the references.
  ```
- **On targeted fix passes, attach NO new references** (new images trigger full regeneration instead of surgical edits) and explicitly list the untouched elements to preserve.
