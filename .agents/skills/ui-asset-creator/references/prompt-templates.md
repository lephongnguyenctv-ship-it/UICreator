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
