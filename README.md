# Pixel Game UI Preview & Studio Workbench

An AI-assisted workflow and interactive browser studio for turning packed 2D pixel-art sprite sheets (`.png`) into crisp `1280×720` interactive HTML/CSS game UI previews — complete with a live **Wireframe ↔ Edit UI ↔ Interactive** switcher, **UI Hierarchy Tree**, **Unity-style 9-Slice Editor**, permanent catalog saving, and automated Playwright geometry verification.

---

## 1. How the Workflow Works (Human-in-the-Loop)

1. **Provide Input & Clarify**: Give the AI your sprite folder (e.g. `Sprite sheets/`), a description of the UI you want, and game context (optionally using `/grill-me` so it asks clarifying questions up front).
2. **Automatic Sprite Slicing & Contact Sheets**: The pipeline slices packed PNG sheets into `previews/_catalog/slices/*.png` and generates labeled visual contact sheets (`previews/_catalog/contact_sheets/`) so the AI inspects real pixels instead of guessing sprite names or coordinates. *(Your original source PNGs are never modified.)*
3. **HTML Wireframe & Behavior Review (`Wireframe` Mode)**: Before building finished art, the agent generates an interactive **structural wireframe** on the same `previews/<slug>/index.html` page alongside a grouped **Behavior Spec** drawer below the canvas for your approval.
4. **Final Sprite UI & Automated Playwright QA**: Once approved, the agent upgrades the same preview to full pixel-art sprites and verifies every state in headless Chromium (`verify_ui.mjs --mode both`) for console errors, broken images, crisp `image-rendering: pixelated`, layout overflows, overlaps, and children intruding on `.px-9slice` borders.
5. **Interactive Review & Live 9-Slice Tuning**: Review the live UI in **`Interactive`** mode, inspect or tweak borders visually in **`Edit UI`** mode, and request any layout adjustments until complete.

---

## 2. Viewing All UIs (`launch_ui_hub.bat` & `previews/index.html`)

- **One-Click Launcher (Recommended)**: Double-click **`launch_ui_hub.bat`** in the project root to start the local Studio Backend (`127.0.0.1:17890`) and automatically open the **Game UI Preview Hub** (`http://127.0.0.1:17890/previews/index.html`) in your browser.
- **Game UI Preview Hub (`previews/index.html`)**:
  - **Multi-State UI Cards**: View all created UIs in one place with QA verification badges (`PASSED` / `FAILED`), interactive view tabs (`HUD`, `Upgrade Shop`, `Inventory`, etc.), a per-card & global `Final UI` vs `Wireframe` thumbnail toggle, and deep links to open directly in **`Interactive`**, **`Edit UI`**, or **`Wireframe`** mode.
  - **`Group by UI` vs `Expand All Screens`**: Flip between one card per UI and an expanded storyboard grid showing every screen of every UI side-by-side.
  - **`Sprite Catalog & Contact Sheets` Tab**: Browse all sliced sprites (`previews/_catalog`) and inspect full-resolution contact sheets.
- **Built-In Top-Bar UI Switcher**: Every individual preview (`previews/<slug>/index.html`) includes a **`⊞ All UIs`** hub link and a **`UI`** dropdown in its top title bar so you can jump directly to any other UI while keeping your active mode (`Interactive`, `Edit UI`, or `Wireframe`).

---

## 3. Using the Browser Workbench (`previews/<slug>/index.html`)

### Mode Switcher (`MODE`)
| Mode | Purpose | Canvas Click Behavior |
| :--- | :--- | :--- |
| **`Wireframe`** | Reviews structural layout boxes without visual art and auto-opens the **Behavior Spec** table below the canvas. | Static layout preview (no gameplay actions). |
| **`Edit UI`** | Opens the 3-panel Studio (**Left UI Hierarchy Tree** + **Center `1280×720` Canvas** + **Right Inspector & 9-Slice Editor**). | Selecting any element outlines it and inspects its sprite **without** triggering buttons or closing modals. |
| **`Interactive`** | Hides Studio sidebars for clean `1280×720` presentation and playtesting. | Normal button clicks, tab switches, upgrades, and modal open/close interactions work normally. *(Tip: hold `Shift + Click` anytime to jump straight into `Edit UI` on that element.)* |

### Toolbar Controls
- **`VIEW`**: Switches directly between UI screens and modals (e.g., `HUD`, `Upgrade Shop`, `Success / Maxed`).
- **`SCALE`**: Toggles pixel-art scale (`2x`, `3x`, `4x`).
- **`SCENE`**: Switches preview backdrop lighting (`Meadow`, `Night`, `Dungeon`, `Checker`).
- **`Behavior Spec`**: Toggles the grouped interaction specification table below the canvas.
- **`Outlines`**: Shows layout bounding boxes for alignment debugging.
- **`Sprites Used`**: Opens the asset manifest table listing every `slice_id`, role, source PNG, native dimensions, and active 9-slice insets used on the page.

### Left Panel: `UI HIERARCHY` (`Edit UI` Mode)
- Displays the nested DOM structure of all `[data-ui-view]` screens and HUD elements with type tags (`9s` for 9-slice, `spr`, `img`, `btn`).
- Use `▾` / `▸` arrows to expand or collapse containers.
- Clicking any node selects it on the canvas (activating its parent view if hidden) and opens its metadata on the right.

### Right Panel: `INSPECTOR & 9-SLICE` (`Edit UI` Mode)
- **Selected Element**: Shows the element role/selector, rendered size (`W × H px`), **Safe Interior** (`W × H px` strictly inside 9-slice borders), and pixel scale.
  - Displays a live warning if a child element touches or overlaps the `.px-9slice` frame border.
  - If the selected element is a screen navigation button (`data-ui-state-trigger`), an **`Open View: <name> →`** button lets you jump to that target view without leaving `Edit UI`.
- **Widget `Transform` (`RectTransform`)**: Collapsible layout inspector card with a **`4×4` (16-preset) Anchor Preset** picker (`Click` preserves visual position while updating `PosX`/`PosY`; `Alt/Shift+Click` snaps directly to that anchor or stretch axis), `PosX`, `PosY` (bottom-left `Y`-up coordinates), `Width`, `Height`, aspect-ratio lock (`🔗`), reset (`↻`), `⋯` menu (`Snap to Active Anchor`, `Reset Transform`, `Copy Transform JSON`), `AnchorMin`, `AnchorMax`, `Pivot`, and `Rotate`. Synchronized two-way with interactive canvas gizmos (anchor crosshairs, pivot marker, drag-to-move, and 8 rotation-aware resize handles) and saved to `ui-edits.js` / `ui-edits.json`.
- **Sprite Metadata**: Shows `Slice ID`, native size, category, and source PNG filename (plus state tabs if `data-slice-pressed` / `data-slice-on` / `data-slice-off` are present).
- **Unity-Style 9-Slice Editor**:
  - Zoomed checkerboard preview with **4 draggable green slice guides** (`T`, `R`, `B`, `L`) and exact numeric inputs (`Top`, `Right`, `Bottom`, `Left`).
  - Toggle **`Apply to all N instances of sprite`** to update every element using that `slice_id` live, or uncheck to test on the selected element only.
  - **`Save 9-Slice`** (green button): Permanently saves your `T/R/B/L` insets!
    - When the local Studio Save Server is running, it updates `previews/_catalog/overrides.json`, `previews/_catalog/manifest.json`, and `previews/_catalog/catalog-data.js` on disk immediately (works even when opening `index.html` directly via `file://`).
    - Also saves to browser `localStorage`, and supports Chrome/Edge's `showSaveFilePicker` (`catalog-data.js`) fallback if the server is offline.
  - **`Reset Default`**: Removes the manual override, re-computes default auto-slicing from the sprite PNG on disk, and restores the element and catalog.

---

## 4. Using This Skill in Another Project

Everything required — prompt instructions, Python slicer & save server, gallery hub builder, CSS/JS UI kit templates, scaffold generator, and Playwright verifier — is self-contained inside `.agents/skills/game-ui-preview/`.

1. **Copy the Skill Folder**: Copy `.agents/skills/game-ui-preview/` into `<other-project>/.agents/skills/game-ui-preview/`.
2. **Prerequisites**:
   - **Python 3** with **Pillow** (`pip install pillow`)
   - **Node.js** + **Playwright Chromium** (`npx playwright install chromium` or existing Playwright cache)
3. **What Gets Created in the Target Project**:
   - `previews/index.html` & `launch_ui_hub.bat` — Master UI Preview Hub + one-click launcher.
   - `previews/_catalog/` — Extracted sprites (`slices/`), `contact_sheets/`, `manifest.json`, `catalog-data.js`, `previews-data.js`, and `overrides.json` (your saved manual 9-slice tweaks).
   - `previews/<slug>/` — Self-contained HTML preview (`index.html`, `pixel-ui-kit.css`, `pixel-ui-kit.js`) and `verification/` Playwright screenshots & JSON reports.
   - **Source PNGs** inside your sprite folder are never altered or overwritten.

---

## 5. Included Examples & CLI Reference

### Included Demo Previews
- **All-UI Preview Hub**: `previews/index.html` (or run `launch_ui_hub.bat` for `http://127.0.0.1:17890/previews/index.html`)
- **Multi-Category Upgrade Shop**: `previews/upgrade-shop/index.html` (or `http://127.0.0.1:17890/previews/upgrade-shop/index.html` when server is active)
- **Cozy Valley RPG Showcase**: `previews/basic-pack-rpg-showcase/index.html` (or `http://127.0.0.1:17890/previews/basic-pack-rpg-showcase/index.html`)

### CLI Commands

**1. Slice source PNG sprite sheets & build contact sheets:**
```powershell
python .agents/skills/game-ui-preview/scripts/slice_sprites.py --input "Sprite sheets" --output "previews/_catalog"
```

**2. Run the Studio Save Server & open the Preview Hub (enables one-click permanent `Save 9-Slice`):**
```powershell
python .agents/skills/game-ui-preview/scripts/slice_sprites.py --output "previews/_catalog" --serve --port 17890 --open
```

**3. Rebuild the UI Preview Hub index manually:**
```powershell
python .agents/skills/game-ui-preview/scripts/build_gallery.py --previews-root "previews" --catalog "previews/_catalog"
```

**4. Manually set/override a sprite's 9-slice borders via CLI:**
```powershell
python .agents/skills/game-ui-preview/scripts/slice_sprites.py --output "previews/_catalog" --set-slice9 basic_pack_056 4,4,5,4
```

**5. Scaffold a new preview workspace:**
```powershell
python .agents/skills/game-ui-preview/scripts/scaffold_preview.py --slug "my-inventory" --title "Inventory UI" --mode wireframe
```

**6. Run automated Playwright verification (`Final UI` + `Wireframe` modes):**
```powershell
node .agents/skills/game-ui-preview/scripts/verify_ui.mjs --page "previews/<slug>/index.html" --out "previews/<slug>/verification" --mode both
```
