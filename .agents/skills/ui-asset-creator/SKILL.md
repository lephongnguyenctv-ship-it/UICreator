---
name: ui-asset-creator
description: >-
  Human-in-the-loop game UI asset creation pipeline: generates copy-pasteable
  web Gemini prompts (with style presets for 1:1 icons, non-square UI panels,
  and pixel art), strips solid white or chroma-key backgrounds, removes
  watermarks, resizes via 1:1 premultiplied-alpha Bicubic Sharper, compresses
  to PNG8 (PLTE + tRNS), and visually verifies the final transparent asset.
  Trigger whenever the user asks to create/generate a game icon, sprite, or UI
  element via external image generation or wants to extract, resize, and
  compress a generated asset into a transparent PNG.
---

# UI Asset Creator Pipeline

End-to-end 4-step workflow for creating transparent, game-ready UI icons, sprites, and UI elements using web Gemini + automated local post-processing.

---

## Workflow Overview

1. **Prompt Assembly**: Identify asset type (`icon`, `ui-panel`, `pixel-art`), choose background strategy (`#FFFFFF` white for closed-outline opaque sprites; `#00FF00` or `#FF00FF` chroma-key for sprites with enclosed holes or floating sparkles), and assemble a prompt from [prompt-templates.md](./references/prompt-templates.md).
2. **Handoff to User**: Give the user the ready-to-copy prompt and point to the style reference in [resources/styles/](./resources/styles/) (e.g., [casual-rpg-icons.png](./resources/styles/casual-rpg-icons.png)) if matching an existing style.
3. **Process Returned Image**: Once the user provides the generated image path or uploads it, inspect it with `read_file` first, then run [process_asset.ps1](./scripts/process_asset.ps1) (which calls [compress_png.mjs](./scripts/compress_png.mjs) automatically).
4. **Visual Verification**: Inspect the `-PreviewPath` 3-backdrop strip (dark UI `#1b1a23`, checkerboard, purple UI `#4b2e5e`) with `read_file` to confirm zero halo/fringe, intact outlines, and no leftover watermark.

---

## Processing Command

### Default: `1:1` Square Icon (`256×256`, PNG8 `192` colors)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".agents/skills/ui-asset-creator/scripts/process_asset.ps1" `
  -InputPath "<raw_image_path>" `
  -OutputPath "assets/<project>/<asset_slug>.png" `
  -PreviewPath "<scratch_dir>/<asset_slug>_preview.png"
```

### Non-Square UI Panel / Button / Bar (Aspect Preserved)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".agents/skills/ui-asset-creator/scripts/process_asset.ps1" `
  -InputPath "<raw_image_path>" `
  -OutputPath "assets/<project>/<panel_slug>.png" `
  -Aspect preserve `
  -Size 512 `
  -PreviewPath "<scratch_dir>/<panel_slug>_preview.png"
```

### Compress an Existing PNG Standalone

```powershell
node ".agents/skills/ui-asset-creator/scripts/compress_png.mjs" "<input.png>" "<output.png>" [maxColors=192]
```

---

## Script Flags Reference ([process_asset.ps1](./scripts/process_asset.ps1))

| Flag | Default | Purpose |
| :--- | :--- | :--- |
| `-Mode` | `auto` | Background removal mode: `auto` (detects corners), `white` (border flood-fill + 2px anti-fringe), `green` (`#00FF00`), or `magenta` (`#FF00FF`). |
| `-Aspect` | `square` | `square` pads cutout to `1:1` canvas before Bicubic Sharper resizing; `preserve` keeps the cropped aspect ratio. |
| `-Size` | `256` | Target side length (`square`) or max dimension (`preserve`). Set `0` with `-Aspect preserve` to keep native cropped resolution. |
| `-Margin` | `14` | Outer transparent margin (at `256px`, scaled proportionally with `-Size`) in `square` mode. |
| `-Padding` | `12` | Source-pixel padding around the tight foreground bounding box before aspect-padding. |
| `-KeepAllComponents` | `$false` | Keep secondary foreground islands (`>= 0.5%` of main sprite area). By default keeps only the largest connected component to strip watermarks. |
| `-Colors` | `192` | Max palette entries passed to `compress_png.mjs` (up to `256`). |
| `-Lossless` | `$false` | Skip PNG8 quantization and save 32-bit RGBA PNG directly. |
| `-KeepFull` | `$false` | Also save `<output_dir>/<name>_full.png` full-resolution 32-bit RGBA cutout. |
| `-PowerOfTwo` | `$false` | Snap output width and height to powers of 2 (`2, 4, 8, ..., 256, 512, ...`). |
| `-PotMode` | `resize` | `resize` (Bicubic Sharper to nearest POT `W×H`) or `pad` (center on transparent next-POT canvas without stretching). |
| `-PreviewPath` | `""` | Write a 3-panel visual QA image (dark UI, checkerboard, purple UI) from the final output. |

---

## Optional `game-ui-preview` Integration

By default, processed assets go directly into `assets/<project>/<name>.png` (e.g. `assets/speedyrace/`, `assets/loot-forge-gun/`, or `assets/shared/`) so every sprite has a single source of truth with zero duplicate copies in `previews/`. To register newly generated assets into the `game-ui-preview` catalog, add them to `previews/_catalog/manifest.json` / `catalog-data.js` pointing directly to `assets/<project>/<name>.png` (or run `slice_sprites.py --input "assets/<project>" --project "<project>" --output "previews/_catalog"`).
