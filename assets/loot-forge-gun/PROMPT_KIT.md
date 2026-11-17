# "Loot & Forge Gun" — 5-Sheet Web Gemini Sprite Kit Prompt Pack

Use these **5 modular prompts** in Web Gemini to generate the glossy cel-shaded Roblox simulator UI sprite kit for **Loot & Forge Gun**.

## Reference Attachments
When generating each sheet in Web Gemini, **attach your 4 reference screenshots** (and optionally [.agents/skills/ui-asset-creator/resources/styles/casual-rpg-icons.png](../../.agents/skills/ui-asset-creator/resources/styles/casual-rpg-icons.png) for glossy cel-shaded icon highlights) so Gemini matches the exact thick black contours, metallic gold/charcoal panels, and vibrant halftone button finish.

---

## Sheet 1: 9-Slice Panels, Containers & 5 Rarity Slot Frames
- **Target raw save / upload name**: `sheet_01_panels_and_frames.png`
- **Background mode**: Pure `#FFFFFF` white (`-Mode white`)

```text
Generate a 2D game UI sprite sheet arranged in a clean, evenly spaced 3x3 grid of 9 completely separated UI frame assets, matching the exact glossy cel-shaded Roblox simulator art style of the attached reference screenshots (dark charcoal/gunmetal interiors, thick bevelled metallic gold/brass borders, bold continuous black outer contours, subtle diagonal glossy sheen, zero tiny noisy details).

Grid contents (left-to-right, top-to-bottom, ALL BLANK with NO text, NO numbers, NO icons inside):
1. Large rectangular dark obsidian/charcoal modal panel (#16171f interior with faint dark subtle halftone dots) bordered by a thick bevelled metallic gold-brass frame.
2. Wide horizontal dark bronze-brown list row card (#2b2118 interior) with a thin polished gold border.
3. Dark gunmetal sidebar container panel (#252730 interior) with a bevelled metallic silver-brass border.
4. Empty recessed dark horizontal progress bar track frame (top) paired cleanly below in the same cell with a separate glossy golden-amber fill bar capsule (separated by clear white gap).
5. Square 1:1 Common rarity item slot frame: slate gray interior (#525866) with light gray metallic border and faint diagonal sheen.
6. Square 1:1 Uncommon rarity item slot frame: vibrant emerald green interior (#22c55e) with bright green-gold border and faint diagonal sheen.
7. Square 1:1 Rare rarity item slot frame: electric cobalt blue interior (#3b82f6) with sky-blue border and faint diagonal sheen.
8. Square 1:1 Epic rarity item slot frame: royal neon purple interior (#a855f7) with bright magenta-violet border and faint diagonal sheen.
9. Square 1:1 Legendary rarity item slot frame: radiant amber-gold interior (#f59e0b) with bright yellow-gold border and faint diagonal sheen.

Technical constraints for clean 9-slice extraction:
- 1:1 square sheet image, 0-degree flat front orthographic view (NO 3D perspective tilt), straight symmetric edges and uniform rounded corners suitable for 9-slice scaling.
- Generous empty spacing (at least 24px white gap) between all 9 elements and generous outer white margin on all four sides (nothing touching or cropped).
- Completely flat, pure solid #FFFFFF white background everywhere outside the frames.
- 100% solid opaque colors everywhere inside every frame (NO semi-transparent glass, NO soft alpha fade, NO drop shadow, NO floor shadow, NO outer glowing aura, NO checkerboard pattern).
- Keep the outer black contour completely closed around each of the 9 elements.
```

---

## Sheet 2: Blank Halftone Action Buttons, Badges & Controls
- **Target raw save / upload name**: `sheet_02_buttons_and_controls.png`
- **Background mode**: Pure `#FFFFFF` white (`-Mode white`)

```text
Generate a 2D game UI sprite sheet arranged in a clean, evenly spaced 3x3 grid of 9 completely separated UI buttons and control badges, matching the exact glossy cel-shaded Roblox simulator art style of the attached reference screenshots (vibrant halftone dot texture shading, bold continuous black outer contours, glossy top highlight edge, chunky rounded-rectangle silhouettes).

Grid contents (left-to-right, top-to-bottom, ALL BLANK with NO words/text except items 7 and 8):
1. Wide 3:1 horizontal primary action button in bright sunny yellow-gold (#fde047 to #eab308 gradient) with diagonal halftone dot pattern and thick black outline (blank inside).
2. Wide 3:1 horizontal upgrade/confirm button in vibrant emerald green (#4ade80 to #16a34a gradient) with halftone dot pattern and thick black outline (blank inside).
3. Wide 3:1 horizontal utility button in electric sky-blue (#38bdf8 to #2563eb gradient) with halftone dot pattern and thick black outline (blank inside).
4. Wide 3:1 horizontal danger button in crimson red (#f87171 to #dc2626 gradient) with halftone dot pattern and thick black outline (blank inside).
5. Rounded rectangular active sidebar tab button in warm orange-gold gradient (#fbbf24 to #d97706) with thick black outline (blank inside).
6. Dark slate-navy rounded pill badge (#1e293b) with a crisp thin metallic gold rim for HUD resource counters (blank inside).
7. Glossy bright red rounded-square close button (1:1 aspect) with a bold solid white "X" centered inside and thick black-and-gold outer contour.
8. Two small separated dark steel square navigation buttons side-by-side with clear white gap between them: left button with a crisp white "<" chevron arrow, right button with a crisp white ">" chevron arrow.
9. Vibrant rainbow diagonal-striped rectangular promo banner frame (3:1 horizontal) with thick black outline and glossy highlight (blank inside, NO text).

Technical constraints for clean 9-slice extraction:
- 1:1 square sheet image, 0-degree flat front orthographic view (NO 3D perspective tilt), straight symmetric edges and clean corners suitable for 9-slice scaling.
- Generous empty white gap (at least 24px) between every button and generous outer white margin on all four sides (nothing touching or cropped).
- Completely flat, pure solid #FFFFFF white background.
- 100% solid opaque colors everywhere (NO semi-transparent glass, NO drop shadow, NO floor shadow, NO outer glow, NO checkerboard pattern).
```

---

## Sheet 3: HUD Navigation, Currencies & Stat Icons
- **Target raw save / upload name**: `sheet_03_hud_and_stat_icons.png`
- **Background mode**: Pure `#00FF00` bright chroma green (`-Mode green -KeepAllComponents`)

```text
Generate a 2D game UI sprite sheet arranged in a clean, evenly spaced 4 columns x 3 rows grid of 12 distinct game UI icons, matching the exact glossy cel-shaded Roblox simulator art style of the attached reference screenshots (bold continuous black outer contour, chunky simplified silhouette, vibrant glossy cel-shaded + smooth gradient coloring, crisp white specular highlights, no tiny noisy details).

Grid contents (left-to-right, top-to-bottom, NO text or numbers):
1. Vibrant pink-magenta shopping basket icon with crisp white highlights (Shop).
2. Rugged brown leather tactical backpack with brass buckles and side pockets (Backpack).
3. Royal blue and gold hardcover collection tome/book with a small golden emblem on the cover (Index).
4. Glowing cyan and crimson twin circular arrow ring badge (Rebirth).
5. Heavy dark-iron gunsmith anvil with a glowing molten-orange forging hammer striking it and bright orange sparks (Gun Forge).
6. Bright purple gift box tied with a shiny golden ribbon bow (Gift Timer).
7. Chunky glossy gold coin facing slightly angled with an embossed "$" symbol (Coins).
8. Shiny trapezoidal gold forged ingot bar with crisp specular gleam (Forge Ingots).
9. Fiery orange-red heavy forge hammer smashing down onto a spark burst (Firepower / Damage stat icon).
10. Winged futuristic cyber-boot with electric blue speed streaks behind it (Fire Rate / Speed stat icon).
11. Crossed golden gunsmith hammer and glowing blue wrench with crisp impact arc (Forge Speed stat icon).
12. Heavy golden padlock with arched shackle and dark keyhole (Locked Forge Bay).

Technical constraints for clean cutout:
- 16:12 (4:3) or 1:1 grid layout with generous spacing between every icon and generous margin on all four sides (nothing cropped or overlapping).
- Completely flat, pure solid #00FF00 bright chroma-key green background everywhere behind every icon and inside any enclosed holes/loops (such as padlock shackle or circular arrow rings).
- Every part inside each icon must be 100% solid opaque color (NO semi-transparent glass, NO alpha fade).
- NO checkerboard pattern, NO gradient background, NO drop shadow, NO floor shadow, and NO outer glowing aura.
```

---

## Sheet 4: Forged Firearms & Weapon Modules
- **Target raw save / upload name**: `sheet_04_guns_and_modules.png`
- **Background mode**: Pure `#FFFFFF` white (`-Mode white`)

```text
Generate a 2D game UI sprite sheet arranged in a clean, evenly spaced 3x3 grid of 9 separated firearm and weapon-attachment icons, matching the exact glossy cel-shaded Roblox simulator art style of the attached reference screenshots (bold continuous black outer contour, chunky simplified silhouette, vibrant glossy cel-shaded + smooth gradient coloring, crisp white specular highlights, slight playful 3/4 diagonal tilt, no tiny noisy details).

Grid contents (left-to-right, top-to-bottom, NO text or labels):
1. Rusty scrap-metal revolver pistol with brown taped grip (Common starter gun).
2. Compact cobalt-blue tactical submachine gun (SMG) with chunky drum magazine (Uncommon gun).
3. Emerald-green modern military assault rifle with glowing green reflex sight (Rare gun).
4. Royal purple and dark-chrome plasma assault rifle with glowing violet energy coils along the barrel (Epic gun — Plasma Hellfire).
5. Heavy golden rotary gatling minigun with warm orange muzzle tips and brass ammo belt (Legendary gun).
6. Crimson-red and obsidian futuristic railgun sniper rifle with glowing cyan power core (Mythic gun).
7. Riveted heavy iron fluted gun barrel attachment with silver-steel sheen (Barrel Module).
8. Chunky hexagonal glowing cyan-and-gold weapon power core module (Core Module).
9. Golden blaster pistol crossed dynamically with a glowing blue energy sword and yellow lightning bolt (Combat Power / 2x Power emblem).

Technical constraints for clean cutout:
- 1:1 square sheet image, each of the 9 icons centered inside its own cell with generous white margin on all four sides (nothing cropped or touching).
- Completely flat, pure solid #FFFFFF white background.
- Every part inside every weapon must be 100% solid opaque color (NO semi-transparent glass, NO alpha fade). Render glowing coils or sights using solid opaque bright cel-shaded colors.
- Keep the outer black contour completely closed around each icon.
- NO checkerboard pattern, NO gradient background, NO drop shadow, NO floor shadow, and NO outer glowing aura.
```

---

## Sheet 5: Monster Drops & Gun Scrap Loot
- **Target raw save / upload name**: `sheet_05_monster_and_scrap_loot.png`
- **Background mode**: Pure `#FFFFFF` white (`-Mode white`)

```text
Generate a 2D game UI sprite sheet arranged in a clean, evenly spaced 3x3 grid of 9 separated monster-drop and gun-scrap loot icons, matching the exact glossy cel-shaded Roblox simulator art style of the attached reference screenshots (bold continuous black outer contour, chunky simplified silhouette, vibrant glossy cel-shaded + smooth gradient coloring, crisp white specular highlights, slight playful tilt, no tiny noisy details).

Grid contents (left-to-right, top-to-bottom, NO text or labels):
1. Curved ivory monster horn/claw with a brown armored base (Monster Claw).
2. Pair of sharp white curved beast fangs side-by-side (Beast Fang).
3. Glossy oversized eyeball with bright blue iris and crisp white highlight (Eyeball).
4. Chunky cut of monster rib meat with three white bone tips sticking out (Rib Meat).
5. Ancient weathered gray stone rune disc carved with a glowing pale spiral symbol (Old Rune).
6. Upright dark-iron armored giant gauntlet fist with gold knuckle bands (Giant Fist).
7. Heavy notched brass and dark-steel cogwheel gear scrap (Scrap Gear).
8. Cylindrical metallic canister with solid bright-green cel-shaded plasma fuel window (Plasma Cell).
9. Cracked obsidian rock core glowing with solid molten orange-gold lava veins (Magma Core).

Technical constraints for clean cutout:
- 1:1 square sheet image, each of the 9 icons centered inside its own cell with generous white margin on all four sides (nothing cropped or touching).
- Completely flat, pure solid #FFFFFF white background.
- Every part inside every loot icon must be 100% solid opaque color (NO semi-transparent glass, NO alpha fade).
- Keep the outer black contour completely closed around each icon.
- NO checkerboard pattern, NO gradient background, NO drop shadow, NO floor shadow, and NO outer glowing aura.
```

---

## Phase 2 Post-Processing Commands (Run Once You Upload the 5 Images)

Once you upload the 5 generated PNGs (or save them locally), we will run `process_asset.ps1` with `-KeepAllComponents -Aspect preserve -Size 0` to strip backgrounds and corner watermarks while keeping all sheet islands separated for `slice_sprites.py`:

```powershell
# Example for white-background sheets (Sheets 1, 2, 4, 5)
powershell -NoProfile -ExecutionPolicy Bypass -File ".agents/skills/ui-asset-creator/scripts/process_asset.ps1" `
  -InputPath "<raw_sheet_path>" `
  -OutputPath "Sprite sheets/loot-forge-gun/<sheet_name>.png" `
  -Mode white -Aspect preserve -Size 0 -KeepAllComponents `
  -PreviewPath "<scratch_dir>/<sheet_name>_preview.png"

# Example for chroma-green sheet (Sheet 3)
powershell -NoProfile -ExecutionPolicy Bypass -File ".agents/skills/ui-asset-creator/scripts/process_asset.ps1" `
  -InputPath "<raw_sheet_03_path>" `
  -OutputPath "Sprite sheets/loot-forge-gun/sheet_03_hud_and_stat_icons.png" `
  -Mode green -Aspect preserve -Size 0 -KeepAllComponents `
  -PreviewPath "<scratch_dir>/sheet_03_hud_and_stat_icons_preview.png"
```
