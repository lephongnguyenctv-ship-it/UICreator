# Craftland Mobile UI Standards & Verified Engine Constraints

Single source of truth for Free Fire Craftland mobile UI sizing, safe frames, layout zones, localization, and verified engine capabilities (audited against Craftland Studio `FE 1.19.4689915` across 24 live `.ui` files and official Garena Craftland documentation).

All numeric sizes below are in **Craftland canvas units** (matching `transform.sizeDelta`, `transform.anchoredPosition`, and `text.fontSize` in the Craftland Inspector).

---

## 1. Canvas Resolution Presets & Scaling

Craftland Studio provides 4 device viewport presets:

| Preset Key | Craftland Studio Label | Canvas Size | Fixed Axis |
| :--- | :--- | :--- | :--- |
| `1500x750` | Default size (2:1 phone) | `1500 × 750` | Height `750` |
| `1334x750` | Regular Phone (16:9) | `1334 × 750` | Height `750` |
| `1625x750` | Large Screen Phone (19.5:9) | `1625 × 750` | Height `750` |
| `1280x960` | Tablet (4:3) | `1280 × 960` | Width `1280` |

- On phones, canvas height stays `750` and extra width is added on the left/right edges.
- On 4:3 tablets, canvas width stays `1280` and height expands to `960` (~22% smaller relative to screen height, offset by the larger physical display).
- **Samsung S25 physical reference** (`2340 × 1080` screen, `1625 × 750` canvas):
  - `1 canvas unit = 1.44 screen pixels`.
  - Capital letter height ≈ `0.7 × Font Size` (`0.7 × 1.44 ≈ 1.008` → **capital height in S25 screenshot pixels ≈ Font Size**).
  - Descenders (`g`, `y`) span `~0.92 × Font Size`; Vietnamese stacked diacritics (`BỘ`, `ỮỚ`) span `~1.0 × Font Size` (~45% taller than capitals alone).

---

## 2. Readability & Touch Target Floors

| Level | Canvas Units | Enforcement (`verify_ui.mjs`) | Use For |
| :--- | :--- | :--- | :--- |
| **Text hard floor** | **`23`** | **Hard fail** (`< 23`) | Badges, `Lv`, small counters. Nothing below this after auto-shrink. |
| **Main reading text** | **`35–38`** | Advisory warn (`< 35`) | Names, stats, prices, button labels, tab labels. |
| **Key HUD numbers** | **`~65`** | Optional guideline | HP, timers, primary rewards. |
| **Touch target floor** | **`58 × 58`** | **Hard fail** (`< 58`) | Absolute minimum tappable hit area (`~5.1mm` on a 6.2" phone). |
| **Touch target standard** | **`78 × 78`** | Advisory warn (`< 78`) | Matches physical Apple `44pt` (`~6.85mm`) on 6.2" landscape phones & Craftland HUD rails. |
| **Generous CTA / slot** | **`92 × 92`** | Recommended | Primary CTAs, inventory slots, close buttons (matches `44pt` on compact `360dp` phones). |

Additional rules:
- Floors apply to the **rendered size after auto-shrink**, not just the typed inspector value.
- **Contrast**: Minimum **`4.5 : 1`** between text and its immediate background (`3.0 : 1` only for `≥ 65` large numbers).
- **Text over live gameplay**: Always add a contrasting outline or drop shadow (`.px-text-outline` in HTML previews; `text.outline` / `text.shadow` in Craftland).
- **Type hierarchy**: Keep at most **3–4 distinct text sizes per screen** (title, main, secondary, floor).
- **Never color-only**: Pair rarity/element color with shape, border treatment, or icon for colorblind accessibility.

---

## 3. Safe Frame, Layout Zones & Popups

- **`1280 × 750` Center Safe Frame**: Keep all center-anchored popups, modals, and panels inside a centered `1280 × 750` region so nothing clips on `1334×750` (16:9) or `1280×960` (4:3). Full-bleed backdrops/scenery may extend outside.
- **Free Fire Reserved Native Control Zones (Landscape Gameplay HUD)**:
  - **Bottom-left** (`~260 × 240`): Free Fire virtual movement joystick. No custom interactive controls or critical readouts here.
  - **Bottom-right** (`~280 × 260`): Free Fire fire / jump / crouch cluster. Keep custom actions clear of this region.
  - **Top-center**: Compact glanceable status (currency, timer, boss bar). Keep slim or collapsible.
  - **Active HUD density**: Max 5–6 custom action buttons visible during combat; menu depth 1–2 levels.
- **Popups**:
  - Max height **`≤ 85%`** of phone screen height (`≤ 640u` on `750`-tall canvases).
  - Dark semi-transparent backdrop behind every modal; tapping backdrop closes the popup (**exception: shop**, which requires the explicit close button).
  - Place Close (`X`) inside the popup frame (at least `78×78` hit area, `92×92` preferred) rather than floating in a far screen corner.
  - **One popup, one job**: One hero focus, one primary CTA (brightest/warmest element on screen), one clear exit.

---

## 4. Verified Craftland Engine Capabilities (`FE 1.19.4689915`)

- **Fonts & Text (`UITextEntity`)**:
  - Locked to `"font": "Default"` (no custom font asset import). For Latin-script text, Craftland Studio's `Default` font renders **GFF Latin** (*Garena Free Fire Latin*, `UIFONT_LATIN_BOLD`). UICreator bundles **GFF Latin** (`gff-latin.css`, Thin/Regular/Medium/Bold WOFF2) and applies it automatically to `#game-canvas` on `data-ui-profile="craftland"` previews via `--px-font-craftland`. Never prompt AI mockups with custom typography.
  - Supported effects: `color`, 2-stop vertical `gradient` (`gradientTop`/`gradientBottom`), `outline`, `shadow`, `fontStyle` (`bold`/`italic`/`underline`), and optional flat `background`. **No** beveled, embossed, metallic, textured, inner-glow, or curved text.
  - Supports `Shrink` (reduce font size), `Clamp` (wrap/clip), and `ResizeFreely` overflow modes with **no `minFontSize` property** — wide text boxes are what prevent unreadable micro-text.
- **Sprites, 9-Slice & Multiply Tinting (`UIImageEntity` / `UIButtonEntity`)**:
  - **9-Slice (`fillType: 1`, Sliced / 9-Grid Pattern)** is Craftland's primary panel/button mode (used on 94% of images and 100% of buttons in real maps). Prefer compact 9-slice frames (typically `32×32`–`256×256`, `< 120KB`, borders `8–32px`) over huge raw textures (`500–800px`) unless a screen specifically calls for bespoke illustrated hero art.
  - **1:1 Non-Scaling Corners Law**: In Craftland/NGUI 9-slice mode (`fillType: 1`), corner regions render 1:1 in canvas units and **do not scale down**. Every 9-slice widget MUST satisfy `width >= borderLeft + borderRight` and `height >= borderTop + borderBottom` — otherwise the corners spill symmetrically outside the widget's bounding box around `(0.5, 0.5)`. Downscale oversized source sprites (with proportional `.png.meta` border rescaling) in Stage 1.5, resize the widget, or explicitly switch small widgets to `Simple (0)` / `Fit (5)`.
  - All color fields (`image.color`, `button.normal`/`highlight`/`pressed`/`disabled`, `texture.colorTint`) **multiply** over the texture. Export reusable tintable assets **pure white (`#FFFFFF` flat surfaces, shadows `≥ #D0D0D0`)** so they tint cleanly without muddying. Standard button convention: `normal = #FFFFFF`, `pressed = #C5C5C5`.
  - Built-in image capabilities: `centerInvisible` (hollow 9-slice border frame), 2-stop vertical `gradient`, `fillType: 3` Filled (`fillAmount`/`fillDir` for bars/radials), `flip`/`reverse` (mirror 1 corner ornament or directional arrow in engine), `alpha` `0–100`.
- **Coordinates, Anchors, Hierarchy & Lists**:
  - Full Unity-style `RectTransform` (`anchorMin`, `anchorMax`, `pivot`, `anchoredPosition`, `sizeDelta`) with **Y-up** (`+Y` up, `-Y` down). Keep `pivot = (0.5, 0.5)` and anchor edge/corner children to their nearest parent corner/edge (`(0,0)` bottom-left, `(1,0)` bottom-right, `(0,1)` top-left, `(1,1)` top-right, `(0.5,1)` top-center, `(0.5,0)` bottom-center, `[0,0]..[1,1]` full-bleed stretch) rather than center-anchoring every child.
  - Group widget hierarchies under **`UIEmptyEntity`** (never `UIPanelEntityV3` unless clipping/depth sorting is needed).
  - Attach button click scripts (`ECA hbe` or `.fcg` `func(button: entity<UIWidgetButton>, player: entity<Player>)`) to **`UIRootEntity`** (`root.ecaScripts`), never to child buttons or grouping nodes.
  - For large repeating lists, avoid unpooled heavy `UIScrollViewEntity` trees; use **paging**, a **fixed grid**, or Craftland's virtualized **`UIEasyListEntity` + `UIEasyCellEntity`**.

---

## 5. Multi-Language Localization & Device QA

Free Fire Craftland maps serve up to 17 live languages across three layout risk groups:

| Risk Group | Languages | Failure Mode |
| :--- | :--- | :--- |
| **Long** | German, Russian, French, Portuguese, Spanish, Romanian, Turkish, Burmese | Text shrinks below `23` floor inside narrow boxes |
| **Tall** | Vietnamese, Thai, Burmese, Hindi, Bengali, Arabic, Urdu | Stacked diacritics clip top/bottom or touch plate borders |
| **RTL** | Arabic, Urdu | Directional art/arrows read backwards when mirrored |

Box-sizing & testing rules:
1. **Box width**: Size text containers to fit `Font Size 35` at **`1.5×` English width** (and **`2×`** for 1–2 word tabs/buttons).
2. **Box height**: At least **`1.5× Font Size`** including vertical padding so tall diacritics never clip.
3. **Single-line short labels**: Prevent line-breaking on tabs/buttons (Thai and Burmese lack word spaces and break mid-word).
4. **Mirrorable directional art**: Keep arrows, chevrons, and progress fills cleanly mirrorable (`reverse.x`).
5. **Final phone QA**: Before shipping, capture uncropped native screenshots on a physical phone (e.g., S25) in **German**, **Burmese**, **Arabic**, and the base language; fix any element below `23px` by widening the box or adjusting layout (never by raising `Font Size` in an already-shrinking box).
