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
3. **Treat auto 9-slice as a heuristic, not 100% ground truth.** Switch to **`Edit UI`** mode (`[data-wb-mode="edit"]`) in the Workbench to inspect elements in the 3-panel Studio (Left UI Hierarchy Tree + canvas click-to-select + Right Sprite Inspector & Unity-style 9-Slice Editor) and click **`Save 9-Slice`** to persist edits permanently to `previews/_catalog/overrides.json`, `manifest.json`, and `catalog-data.js` (via `slice_sprites.py --serve` or `--set-slice9 <id> T,R,B,L`).
4. **Never skip Playwright + Visual Self-Verification.** A preview is only done when `verify_ui.mjs` exits `0` (`status: "PASSED"`) **and** you have inspected every `*-clean.png` screenshot via `read_file`.

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

---

## Stage 2: Visual Sprite Selection (`read_file`)

1. List the contact sheets in `previews/_catalog/contact_sheets/`.
2. Open the relevant contact sheet PNGs using `read_file` so you can see the actual pixels and exact IDs.
3. Write down an explicit **Sprite Mapping Table** before coding (matching each UI role — panel, button normal/pressed, icon, emote, dialog frame, cursor — to a verified `slice_id`).

---

## Stage 2.5: HTML Wireframe & Element Behavior Gate (Same Preview Page)

After understanding the user's request (including any upfront clarification or `/grill-me` interview) and mapping the available sprites, **never output a text-only / ASCII wireframe in chat as a substitute for the HTML preview page**. The user must view the wireframe in the browser on the exact same `previews/<slug>/index.html` page (or localhost URL) that will host the finished product.

1. Scaffold the shared preview page in wireframe mode:

```powershell
python .agents/skills/game-ui-preview/scripts/scaffold_preview.py --slug "<slug>" --title "<UI Title>" --mode wireframe
```

2. Build the **structural HTML wireframe** inside `#game-canvas` in `previews/<slug>/index.html` with `data-default-mode="wireframe"`:
   - Lay out all planned views (`[data-ui-view="<stateId>"]`) and regions (`.px-hud-top`, `.px-hud-bottom`, `.px-modal-backdrop`, `.px-wire-box` / container boxes, labels, placeholder icon slots) with **no animations or gameplay logic needed yet**.
   - Keep view switching (`[data-ui-state-trigger]`) wired in the workbench bar so the user can preview the wireframe shape of every screen/modal.
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
   - **9-Slice Border Safe Interior Rule**: For frames, slots, and badges built with `.px-9slice`, calculate outer dimensions from the sprite's insets and `3x` pixel scale (`inner_w = outer_w - (L + R) * 3`, `inner_h = outer_h - (T + B) * 3`) so icons and labels sit strictly inside the inner box without overlapping the frame border. Mark intentional border-straddling elements (like corner hotkeys or badges) with `data-border-overlap-ok="true"`.
   - Use flow layout helpers (`.px-row`, `.px-stack`, `.px-grid`, `.px-hud-top`, `.px-hud-bottom`, `.px-modal-backdrop`) so elements never overflow or collide.
2. **Preserve the 3-mode switcher (`Wireframe` | `Edit UI` | `Interactive`) on the same page**:
   - Keep the `Mode` buttons (`[data-wb-mode="wireframe"]`, `[data-wb-mode="edit"]`, `[data-wb-mode="final"]`), the `Behavior Spec` drawer (`#wb-behavior-drawer`), and `data-wireframe-hide="true"` (or `.world-backdrop-props`) on purely decorative backdrop scenery.
   - `Interactive` (`[data-wb-mode="final"]`) hides the Studio sidebars and plays buttons/modals normally without canvas click interception.
   - `Edit UI` (`[data-wb-mode="edit"]`) opens the 3-panel **Studio Workbench** (Left UI Hierarchy Tree + direct canvas click-to-select + Right Sprite Inspector & interactive Unity-style 9-Slice Editor). Clicking **`Save 9-Slice`** writes edits permanently to `previews/_catalog/overrides.json`, `manifest.json`, and `catalog-data.js` when the local Studio daemon (`python .agents/skills/game-ui-preview/scripts/slice_sprites.py --output "previews/_catalog" --serve --port 17890`) is running (with `localStorage` + File System API fallbacks).
   - Guard all custom interactive/animation handlers in `index.html` with `if (window.PixelUI && window.PixelUI.isWireframeMode()) return;` so switching back to **Wireframe** mode restores the clean, static structural wireframe alongside the grouped behavior spec at any time.

---

## Stage 4: Run Playwright Automated Verification (Final + Wireframe Modes)

Execute the Playwright verifier across both modes against the HTML preview:

```powershell
node .agents/skills/game-ui-preview/scripts/verify_ui.mjs --page "previews/<slug>/index.html" --out "previews/<slug>/verification" --mode both
```

What `verify_ui.mjs` tests automatically in headless Chromium (`1280x720`, `?clean=1`) for both `final` and `wireframe` modes:
- **Console & JS Errors**: Fails on any `console.error` or uncaught `pageerror`.
- **Asset Integrity**: Verifies every visible `<img>`, CSS `background-image`, and `border-image-source` loads with `naturalWidth > 0` (skipping unhydrated wireframe placeholders in `--mode wireframe`).
- **Pixel Rendering**: Confirms `image-rendering: pixelated` on sprite elements in `final` mode.
- **Computed Geometry (`getBoundingClientRect`)**: Detects viewport out-of-bounds, text/child container overflows, child overlap with `.px-9slice` inner border insets (`child-overlaps-9slice-border` in `final` mode), and unintended sibling overlaps inside layout containers in both modes.
- **Interactive States**: Switches through every `[data-ui-view]` (preferring real in-canvas triggers) and captures `verification/screenshots/<state>-clean.png` and `<state>-wireframe-clean.png` (plus `*-annotated.png` if geometry defects appear).

---

## Stage 5: Multimodal Visual Self-Critique & Fix Loop (Up to 3 Iterations)

1. Read `previews/<slug>/verification/report.json`.
   - If `status === "FAILED"`, inspect the failing selectors and any `*-annotated.png` screenshots, fix the HTML/CSS/sprite mapping, and re-run `verify_ui.mjs --mode both`.
2. Once `status === "PASSED"`, **call `read_file` on EVERY `verification/screenshots/<state>-clean.png` and `<state>-wireframe-clean.png`** and evaluate this 5-point rubric:
   - **9-Slice Crispness**: Are frame/button corners sharp and unstretched, with zero distortion or double-borders?
   - **Semantic Icon Match**: Does every icon visually match its label/tooltip/action?
   - **Typography & Contrast**: Is text legible, centered in buttons/headers, and properly padded inside panels (in both Final UI and Wireframe modes)?
   - **Layout Balance & Anchoring**: Are HUD bars, modals, and dialog boxes cleanly anchored with comfortable whitespace?
   - **Prompt Fidelity**: Does every requested view, modal, interactive control, and mode toggle (`Wireframe` <-> `Final UI`) match the user's prompt?
3. If any visual issue appears in a screenshot, refine `previews/<slug>/index.html` (or CSS) and re-run `verify_ui.mjs --mode both` until both the automated check and visual inspection pass cleanly.

---

## Stage 6: Start Studio Save Server & User Review Loop

1. **Ensure the self-contained Studio Save Server is running** (`IsDaemon: true`) before presenting the preview so the user's **`Save 9-Slice`** edits write directly to `previews/_catalog/overrides.json`, `manifest.json`, and `catalog-data.js`:
   ```powershell
   python .agents/skills/game-ui-preview/scripts/slice_sprites.py --output "previews/_catalog" --serve --port 17890
   ```
   *(Skip launching a duplicate if `GET http://127.0.0.1:17890/api/ping` is already responding for the current workspace.)*
2. Present both the clickable preview link (`previews/<slug>/index.html`) and local Studio URL (`http://127.0.0.1:17890/previews/<slug>/index.html`), the verified `*-clean.png` screenshots, and a brief summary of what was verified.
3. When the user reviews the UI and requests layout, asset, or behavior changes:
   - Apply the requested updates to `previews/<slug>/index.html` (and CSS/JS if needed).
   - **Always re-run Stage 4 (`verify_ui.mjs`) and Stage 5 (read updated `*-clean.png` screenshots)** before presenting the revised preview back to the user.
