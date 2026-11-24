---
name: game-ui-preview
description: >-
  End-to-end workflow to slice packed PNG sprite sheets, map real pixel-art
  assets via visual contact sheets, build an interactive HTML/CSS Game UI
  preview, and self-verify with Playwright (DOM/geometry checks + multimodal
  screenshot critique). Trigger whenever the user provides sprite assets and
  asks to design or preview a game UI in HTML.
---

# Game UI Preview & Playwright Self-Verification Workflow

Use this skill whenever the user provides PNG sprite assets (single sprites or packed sheets) and a prompt describing a game UI they want to design and preview in HTML.

---

## Core Rules

1. **Never guess sprite coordinates or invent filenames.** Always slice the source PNGs with `slice_sprites.py` and visually inspect the generated `contact_sheet_*.png` files with `read_file` before writing HTML.
2. **Preserve pixel-art crispness, 9-slice ratios, and safe border spacing.** Use `.px-9slice` (plus `.px-btn` on clickable buttons) and `.px-sprite-box` / `.px-icon` via `data-slice-id="..."` so `pixel-ui-kit.js` hydrates real paths, native dimensions, and 9-slice insets from `catalog-data.js`. Always size `.px-9slice` frames/slots large enough so child icons and labels stay strictly inside the inner box (`outer_size - (slice_1 + slice_2) * scale`) rather than overlapping sliced borders (use `data-border-overlap-ok="true"` only for intentional badges/tags).
3. **Treat auto 9-slice as a heuristic, not 100% ground truth.** Switch to **`Edit UI`** mode (`[data-wb-mode="edit"]`) in the Workbench to inspect widgets or pick any sprite directly from the bottom **`Resources`** tab to open its **9-Slice Editor** + **Live Stretch Preview** in the Right tab. You can tune 9-slice insets and click **`Save 9-Slice`** to persist them to `previews/_catalog/overrides.json`, `manifest.json`, and `catalog-data.js` (via `slice_sprites.py --serve` or `--set-slice9 <id> T,R,B,L`), edit widget text directly (via the Right Widget Inspector or by double-clicking text on the canvas), and swap widget sprites via **`Browse Sprites…`** / Slice ID input (saved per-UI to `previews/<slug>/ui-edits.js` and `ui-edits.json`).
4. **Never skip Playwright + Visual Self-Verification.** A preview is only done when `verify_ui.mjs` exits `0` (`status: "PASSED"`) **and** you have inspected every `*-clean.png` screenshot via `read_file`.
5. **Preserve the shared `.workbench-bar` template and respect wireframe-only requests.** Every preview must keep all preview controls (`Mode` → `View` → optional `State` → `Scale`) inside `<header class="workbench-bar">` using `.wb-group` + `.wb-label` + `.wb-btn` — **never** place custom `State`, `View`, or preset toolbars inside `#game-canvas` (keep `#game-canvas` strictly in-game UI). When the user asks for a **wireframe**, stop cleanly at Stage 2.5 (structural wireframe + grouped behavior spec) and wait for approval before implementing Stage 3 sprite hydration or interactive logic.
6. **Apply Craftland Mobile Standards for Free Fire Craftland UIs.** When designing or auditing a Free Fire Craftland UI, follow [references/craftland-mobile-standards.md](./references/craftland-mobile-standards.md), scaffold with `--profile craftland` (default `1500×750` 2:1 canvas with live 4-resolution switching across `1500×750`, `1334×750`, `1625×750`, and `1280×960`), run a quick **Reuse Check** against existing `assets/` before requesting new art, and verify across Craftland viewports (`verify_ui.mjs --profile craftland --mode both`, or `--res all` for all 4 resolutions).

---

## Stage 0 (Craftland UIs): Reuse & Readability Check

Before scaffolding a Craftland screen, scan `assets/` and `previews/_catalog/manifest.json` and note:
- **Reuse**: Existing 9-slice frames/slots/icons that already fit unchanged (or via `data-tint`).
- **New / Split**: Only the minimum new pieces required (prefer pure-white tintable 9-slice pieces via `ui-asset-creator`).
- **Readability Floors**: Text `≥ 23` hard floor (`35–38` main reading target), touch targets `≥ 58×58` hard floor (`78×78` phone standard, `92×92` primary CTA), contrast `≥ 4.5:1`, popups inside centered `1280×750` safe frame (`≤ 640` tall), and clear of Free Fire bottom-left/bottom-right native controls.

---

## Stage 1: Slice & Catalog Sprites

Run the sprite slicer on the input sprite directory (skip only if `previews/_catalog/manifest.json` already exists for the exact same input assets):

```powershell
python .agents/skills/game-ui-preview/scripts/slice_sprites.py --input "Sprite sheets" --output "previews/_catalog"
```

Outputs created in `previews/_catalog/`:
- `slices/*.png` — Individual tightly cropped PNG sprites.
- `manifest.json` — Metadata (`width`, `height`, `category`, suggested `slice_9`, `is_white_mask_candidate`).
- `catalog-data.js` — `window.SPRITE_CATALOG` script for zero-CORS `file://` preview loading.
- `contact_sheets/contact_sheet_*.png` — Checkerboard contact sheets showing each sprite scaled up with its `[slice_id]` and `WxH` dimensions.
- **Importing from Craftland Studio / Unity projects**: Always check each copied texture's sidecar `.meta` file for `borderTop`, `borderRight`, `borderBottom`, and `borderLeft` (the texture's **9-Grid Pattern**). `.ui` widget JSON often leaves `slicedBorder` at `0,0,0,0` when inheriting texture-level `.meta` borders — record those exact `.meta` insets into `slice_9` in `manifest.json` / `catalog-data.js` instead of guessing or treating the sprite as plain stretch.

---

## Stage 2: Visual Sprite Selection (`read_file`)

1. List the contact sheets in `previews/_catalog/contact_sheets/`.
2. Open the relevant contact sheet PNGs using `read_file` so you can see the actual pixels and exact IDs.
3. Write down an explicit **Sprite Mapping Table** before coding (matching each UI role — panel, button normal/pressed, icon, emote, dialog frame, cursor — to a verified `slice_id`).

---

## Stage 2.5: HTML Wireframe & Element Behavior Gate (Same Preview Page)

After understanding the user's request (including any upfront clarification or `/grill-me` interview) and mapping the available sprites, **never output a text-only / ASCII wireframe in chat as a substitute for the HTML preview page**. The user must view the wireframe in the browser on the exact same `previews/<slug>/index.html` page (or localhost URL) that will host the finished product.

1. Scaffold the shared preview page in wireframe mode (add `--profile craftland` for Free Fire Craftland mobile UIs):

```powershell
python .agents/skills/game-ui-preview/scripts/scaffold_preview.py --slug "<slug>" --title "<UI Title>" --mode wireframe --profile craftland
```

2. Build the **structural HTML wireframe** inside `#game-canvas` in `previews/<slug>/index.html` with `data-default-mode="wireframe"`:
   - Lay out all planned views (`[data-ui-view="<stateId>"]`) and regions (`.px-hud-top`, `.px-hud-bottom`, `.px-modal-backdrop`, `.px-wire-box` / container boxes, labels, placeholder icon slots) with **no Stage 3 sprite hydration, animations, or gameplay logic yet** — if the user asked for a wireframe, deliver only Stage 2.5 and pause for review before Stage 3.
   - **Mobile HUD Ergonomics & Craftland QA Guides**: Keep the **Center 40% Focus Zone** clear on active gameplay HUD views (≤ 22% HUD Visual Budget), keep center-anchored popups inside the **`1280×750` Safe Frame**, and keep custom gameplay controls clear of Free Fire's bottom-left/bottom-right native controls. Designers can live-switch Craftland's 4 resolutions (`1500×750`, `1334×750`, `1625×750`, `1280×960`), toggle **`Safe Zones`** and **`Focus Zone`**, stress-test **`L10n`** (`Base` / `Long 1.6× + Tall` / `RTL`), drop in a **`Backdrop`** gameplay screenshot, and check the live **`HUD: X% · Center: Y%`** badge right in the Workbench bar.
   - Keep view switching (`[data-ui-state-trigger]`) and any contextual edge-case `State` toggles (Empty, Low Resource, Sold Out, Locked, Max Values) strictly inside `<header class="workbench-bar">` as `.wb-group` sections in fixed order: **`Mode` → `View` → `State` → `Scale`**. Never render workbench/state tabs inside `#game-canvas`.
   - Populate `#wb-behavior-drawer` (`.behavior-table`) right below the canvas with the **Grouped Element Behavior Spec**. **Group repeated elements that share the same behavior into a single row** (for example, describe `"Inventory Slots (4×3 grid)"` with count `12` once instead of writing 12 separate rows, or `"Hotbar Slots (1–5)"` as one entry).

3. Verify the HTML wireframe layout before showing it to the user:

```powershell
node .agents/skills/game-ui-preview/scripts/verify_ui.mjs --page "previews/<slug>/index.html" --out "previews/<slug>/verification" --mode wireframe
```

4. Read the generated `*-wireframe-clean.png` screenshots with `read_file` to confirm the wireframe layout is clean, then give the user the clickable preview link (`previews/<slug>/index.html`, and/or the active localhost preview URL) plus the wireframe screenshots and wait for approval or layout adjustments before Stage 3. Once approved, run Stages 3–5 autonomously without interrupting the user.

---

## Stage 3: Upgrade to Finished Interactive UI (Preserving Wireframe <-> Edit UI <-> Interactive Switch)

1. Upgrade the **same** `previews/<slug>/index.html` into the finished sprite-hydrated UI and change `<body ... data-default-mode="final">` (also updating the active workbench `Mode` button class to `data-wb-mode="final"` labeled `Interactive`):
   - Place all UI screens/modals inside `#game-canvas` (`1280x720`).
   - Use `[data-ui-view="<stateId>"]` for each screen/modal view and `[data-ui-state-trigger="<stateId>"]` on both workbench toolbar tabs and in-canvas navigation buttons.
   - Bind sprites with `data-slice-id="<id>"` (and optional `data-slice-pressed="<pressed_id>"` for tactile button presses, `data-slice-9="t,r,b,l"` to override 9-slice insets when needed). Always pair clickable `<button class="px-9slice">` controls with `.px-btn` (and never let native button backgrounds/borders bleed through transparent corners).
   - **Engine-Accurate Dual Sprite Tinting**: Use `data-tint="#RRGGBB"` (and optional `data-tint-mode="auto|mask|multiply"`) to tint sprites cleanly. `auto` uses CSS `mask-image` for pure-white icons/glyphs (`is_white_mask_candidate: true`) and `isolation: isolate` + `mix-blend-mode: multiply` for shaded wood/metal/rarity frames so texture shading is preserved. Designers can also tune tints live in **`Edit UI`** → Right Inspector (**Sprite Tint**), persisted to `ui-edits.json`.
   - **Scene-Readable HUD Text Outlines**: Apply `.px-text-outline` (or `.px-text-outline-lg`) to text rendered directly over live gameplay scenes so it stays legible against both light and dark backgrounds — avoid adding outlines to text already sitting inside opaque panels/popups.
   - **Design Tokens & Visual Hierarchy Discipline**: Use the 4px spacing tokens (`--px-sp-1..6`) and named type scale (`--px-fs-caption`, `--px-fs-body`, `--px-fs-label`, `--px-fs-title`, `--px-fs-popup`, `--px-fs-hero`). Keep at most **one hero element** and **one primary CTA button** per modal, use `.px-num` for right-aligned tabular numbers in stat tables, prefer wrapping over silent clipping (use `.px-ellipsis` only for single-line names), and avoid hard-coding fixed `height` (or over-tall `min-height` + `justify-content: space-between`) on modals so content defines popup height with even vertical rhythm.
   - **HUD Craft, Slot Ratios & Progressive Disclosure**:
     - **Icon-to-Slot Fill Ratio**: Hero item/weapon icons inside hotbar or inventory slots should fill **60–75%** of the inner slot box (never tiny postage-stamp icons surrounded by dead space).
     - **Zero Redundant Micro-Copy**: Omit redundant state text (`ACTIVE`, `SLOT 2`, `TAP`) when a glowing active frame, subtle corner badge (`★`/`🔒`), or slot position already communicates the state.
     - **Progressive Disclosure for Secondary Buffs**: Collapse passive/low-urgency modifiers (e.g., time/friend/rebirth boosts) into a compact icon button + **tap-to-toggle popover** rather than cluttering the combat HUD with text pills.
     - **Rail Shape Consistency**: Grouped HUD navigation/event rails should share a consistent column width and tile geometry; featured promos should differentiate via color/frame treatment rather than breaking the rail's grid width.
   - **Contextual Non-Happy-Path State Toggles**: Place compact state toggles for realistic edge cases — such as **Empty** (no items/quests), **Locked / Insufficient** (can't afford, disabled state), **Sold Out**, **Critical / Low-Resource** (low HP/cooldown), or **Max-Value** (`999.9M` large numbers / long names) — inside `<header class="workbench-bar">` as a `<div class="wb-group"><span class="wb-label">State</span>...</div>` right between `View` and `Scale` (never inside `#game-canvas`), so designers can stress-test beyond the default happy path with consistent workbench controls across previews.
   - **9-Slice Border Safe Interior & Wireframe Parity Rule**: For frames, slots, and badges built with `.px-9slice`, calculate outer dimensions from the sprite's insets and `3x` pixel scale (`inner_w = outer_w - (L + R) * 3`, `inner_h = outer_h - (T + B) * 3`) so icons and labels sit strictly inside the inner box without hugging or overlapping the frame border. If a preview uses `::before` 9-slice rendering (`border: none`), apply `border: none` consistently in **both** Wireframe and Interactive modes (so layout geometry never shifts between modes) and set internal `padding ≥ (slice_inset × pixel_scale) + 8px`. Mark intentional border-straddling elements (like corner hotkeys or badges) with `data-border-overlap-ok="true"`.
   - **High-Res / Painted 9-Slice Textures (`.px-9slice--hd`)**: For non-pixel-art UI textures with 9-slice insets (e.g., Craftland/Unity `32×32`–`256×256` sprites with `.meta` 9-Grid Pattern borders), **never** fall back to `.px-sprite-box` (`background-size: 100% 100%`), which distorts corners and border thickness. Instead, use `.px-9slice.px-9slice--hd` (`border: none`, `::before` `border-image` at `--pixel-scale: 1`, `image-rendering: auto`, and `inset: 0` on `.px-tint-overlay`) so corners render 1:1 with the editor while only center regions stretch.
   - Use flow layout helpers (`.px-row`, `.px-stack`, `.px-grid`, `.px-hud-top`, `.px-hud-bottom`, `.px-modal-backdrop`) so elements never overflow or collide.
2. **Preserve the 3-mode switcher (`Wireframe` | `Edit UI` | `Interactive`) on the same page**:
   - Keep the `Mode` buttons (`[data-wb-mode="wireframe"]`, `[data-wb-mode="edit"]`, `[data-wb-mode="final"]`), the `Behavior Spec` drawer (`#wb-behavior-drawer`), and `data-wireframe-hide="true"` (or `.world-backdrop-props`) on purely decorative backdrop scenery.
   - `Interactive` (`[data-wb-mode="final"]`) hides the Studio sidebars and plays buttons/modals normally without canvas click interception.
   - `Edit UI` (`[data-wb-mode="edit"]`) opens the **Studio Workbench** (Left UI Hierarchy Tree + direct canvas click/double-click on `#game-canvas` + Right Inspector + Bottom **Resources** dock). Selecting any sprite in the bottom **Resources** tab opens the **Sprite 9-Slice Editor** + **Live Stretch Preview** in the Right tab; clicking a canvas widget inspects text and sprite swapping in the Right tab (with an **`Edit 9-Slice →`** shortcut). Saving writes `overrides.json`/`catalog-data.js` and per-preview `ui-edits.js`/`ui-edits.json` permanently when the local Studio daemon (`python .agents/skills/game-ui-preview/scripts/slice_sprites.py --output "previews/_catalog" --serve --port 17890`) is running (with `localStorage` fallback).
   - Guard all custom interactive/animation handlers in `index.html` with `if (window.PixelUI && window.PixelUI.isWireframeMode()) return;` so switching back to **Wireframe** mode restores the clean, static structural wireframe alongside the grouped behavior spec at any time.

---

## Stage 4: Run Playwright Automated Verification (Final + Wireframe Modes)

Execute the Playwright verifier across both modes against the HTML preview:

```powershell
node .agents/skills/game-ui-preview/scripts/verify_ui.mjs --page "previews/<slug>/index.html" --out "previews/<slug>/verification" --mode both
```

*(For Craftland profiles, `verify_ui.mjs` auto-detects `data-ui-profile="craftland"` — or accepts `--profile craftland` — and sweeps `1500x750` + `1280x960` by default. Pass `--res all` to sweep all 4 Craftland presets: `1500x750`, `1334x750`, `1625x750`, `1280x960`.)*

What `verify_ui.mjs` tests automatically in headless Chromium (`?clean=1`) for both `final` and `wireframe` modes:
- **Console & JS Errors**: Fails on any `console.error` or uncaught `pageerror`.
- **Asset Integrity**: Verifies every visible `<img>`, CSS `background-image`, and `border-image-source` loads with `naturalWidth > 0` (skipping unhydrated wireframe placeholders in `--mode wireframe`).
- **Pixel Rendering**: Confirms `image-rendering: pixelated` on sprite elements in `final` mode.
- **Computed Geometry (`getBoundingClientRect`)**: Detects viewport out-of-bounds, text/child container overflows, child overlap with `.px-9slice` inner border insets (`child-overlaps-9slice-border` in `final` mode), and unintended sibling overlaps inside layout containers in both modes.
- **Craftland Tiered Mobile QA (`--profile craftland`)**:
  - **Hard Failures**: Visible text `< 23px` (opt-out `data-font-floor-ok="true"`) and interactive touch targets `< 58×58` (opt-out `data-touch-floor-ok="true"`).
  - **Advisory Warnings**: Main reading text `< 35px`, touch targets `< 78×78` (`92×92` recommended for primary CTAs), WCAG text contrast `< 4.5:1` (`< 3.0:1` for `≥ 65px`), modal height `> 640px` (`> 85%` of `750` phone height), center modals outside `1280×750` safe frame, or gameplay HUD widgets intruding into Free Fire bottom-left/bottom-right native controls.
- **Interactive States**: Switches through every `[data-ui-view]` (preferring real in-canvas triggers) and captures `verification/screenshots/<state>-clean.png` and `<state>-wireframe-clean.png` (plus `<state>-<res>-clean.png` for secondary resolutions and `*-annotated.png` if geometry defects appear).
- **Non-Blocking Design Warnings**: Logs advisory `warnings` in `report.json` (never failing the run) for silent text clipping (`nowrap + overflow:hidden` without ellipsis), fixed inline modal heights, or high gameplay HUD coverage / Center 40% focus-zone intrusion.

---

## Stage 5: Multimodal Visual Self-Critique & Fix Loop (Up to 3 Iterations)

1. Read `previews/<slug>/verification/report.json`.
   - If `status === "FAILED"`, inspect the failing selectors and any `*-annotated.png` screenshots, fix the HTML/CSS/sprite mapping, and re-run `verify_ui.mjs --mode both`.
2. Once `status === "PASSED"`, **call `read_file` on EVERY `verification/screenshots/<state>-clean.png` and `<state>-wireframe-clean.png`** and evaluate this 6-point rubric:
   - **9-Slice Crispness**: Are frame/button corners sharp and unstretched, with zero distortion or double-borders?
   - **Semantic Icon Match**: Does every icon visually match its label/tooltip/action?
   - **Typography & Contrast**: Is text legible, centered in buttons/headers, properly padded inside panels, and outlined (`.px-text-outline`) when sitting over live gameplay?
   - **Layout Balance & Anchoring**: Are HUD bars, modals, and dialog boxes cleanly anchored with comfortable whitespace and clear visual hierarchy (max 1 hero & 1 primary CTA per modal)?
   - **HUD Focus & Edge-State Clarity**: Is the Center 40% Focus Zone clear in gameplay HUD views, and do contextual non-happy-path states (Empty, Locked/Insufficient, Critical, Max-Value) look intentional?
   - **Prompt Fidelity**: Does every requested view, modal, interactive control, and mode toggle (`Wireframe` <-> `Final UI`) match the user's prompt?
3. If any visual issue appears in a screenshot, refine `previews/<slug>/index.html` (or CSS) and re-run `verify_ui.mjs --mode both` until both the automated check and visual inspection pass cleanly.

---

## Stage 6: Start Studio Save Server & User Review Loop

1. **Ensure the self-contained Studio Save Server is running** (`IsDaemon: true`) before presenting the preview so the user's **`Save 9-Slice`** edits write directly to `previews/_catalog/overrides.json`, `manifest.json`, and `catalog-data.js` (and the master UI Hub is accessible):
   ```powershell
   python .agents/skills/game-ui-preview/scripts/slice_sprites.py --output "previews/_catalog" --serve --port 17890
   ```
   *(Skip launching a duplicate if `GET http://127.0.0.1:17890/api/ping` is already responding for the current workspace. Users on Windows can also double-click `launch_ui_hub.bat` to start the backend and open the Hub automatically.)*
2. Present the **Game UI Preview Hub** (`previews/index.html` / `http://127.0.0.1:17890/previews/index.html` — which aggregates all created UIs and includes the top-bar UI switcher across previews), the specific clickable preview link (`previews/<slug>/index.html` and `http://127.0.0.1:17890/previews/<slug>/index.html`), the verified `*-clean.png` screenshots, and a brief summary of what was verified. (`verify_ui.mjs` and `scaffold_preview.py` automatically update `previews/index.html` and `previews/_catalog/previews-data.js` via `build_gallery.py`.)
3. When the user reviews the UI and requests layout, asset, or behavior changes:
   - Apply the requested updates to `previews/<slug>/index.html` (and CSS/JS if needed).
   - **Always re-run Stage 4 (`verify_ui.mjs`) and Stage 5 (read updated `*-clean.png` screenshots)** before presenting the revised preview back to the user.
