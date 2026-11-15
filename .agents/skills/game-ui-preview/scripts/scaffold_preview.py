#!/usr/bin/env python3
"""Scaffold a self-contained HTML Game UI Preview workspace under previews/<slug>/."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import sys

_SCRIPTS_DIR = str(Path(__file__).resolve().parent)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from build_gallery import build_gallery


STARTER_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Game UI Preview</title>
  <link rel="stylesheet" href="./pixel-ui-kit.css">
</head>
<body data-catalog-base="{catalog_rel}" data-default-mode="{default_mode}">
  <header class="workbench-bar">
    <div class="workbench-title">
      <span>{title}</span>
      <span class="workbench-badge">1280×720 Pixel UI Preview</span>
    </div>
    <div class="workbench-controls">
      <div class="wb-group">
        <span class="wb-label">Mode</span>
        <button class="wb-btn{wire_active}" data-wb-mode="wireframe">Wireframe</button>
        <button class="wb-btn" data-wb-mode="edit">Edit UI</button>
        <button class="wb-btn{final_active}" data-wb-mode="final">Interactive</button>
      </div>
      <div class="wb-group">
        <span class="wb-label">View</span>
        <button class="wb-btn is-active" data-ui-state-trigger="main">Main</button>
      </div>
      <div class="wb-group">
        <span class="wb-label">Scale</span>
        <button class="wb-btn" data-wb-scale="2">2x</button>
        <button class="wb-btn is-active" data-wb-scale="3">3x</button>
        <button class="wb-btn" data-wb-scale="4">4x</button>
      </div>
    </div>
  </header>

  <main class="workbench-stage">
    <div id="game-canvas" class="px-canvas scene-cozy-meadow">
      <div class="px-hud-layer" data-ui-view="main">
        <div class="px-hud-top">
          <!-- Replace with structural wireframe regions (Stage 2.5) and data-slice-id sprites (Stage 3) -->
          <div class="px-wire-box px-text-pixel" style="padding: 8px 14px;">{title}</div>
        </div>
      </div>
    </div>

    <section id="wb-behavior-drawer" class="workbench-drawer{behavior_open}" aria-label="Element Behavior Specification">
      <h3>Element Behavior Specification (Grouped by Interaction Role)</h3>
      <table class="behavior-table">
        <thead>
          <tr>
            <th>Element / Group</th>
            <th>View</th>
            <th>Count</th>
            <th>Behavior Description</th>
          </tr>
        </thead>
        <tbody id="wb-behavior-body">
          <tr>
            <td><strong>Main Panel</strong> <span class="behavior-group-tag">Group</span></td>
            <td><span class="behavior-view-badge">main</span></td>
            <td>1</td>
            <td>Replace with grouped descriptions for each interactive region (repeated identical controls share one row).</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section id="wb-manifest-drawer" class="workbench-drawer" aria-label="Sprite Asset Manifest">
      <h3>Sprite Asset Manifest (Auto-scanned from #game-canvas)</h3>
      <table class="manifest-table">
        <thead>
          <tr>
            <th>Preview</th>
            <th>Slice ID</th>
            <th>Role</th>
            <th>Source PNG</th>
            <th>Native Size</th>
            <th>9-Slice</th>
          </tr>
        </thead>
        <tbody id="wb-manifest-body"></tbody>
      </table>
    </section>
  </main>

  <script src="{catalog_rel}catalog-data.js"></script>
  <script src="{catalog_rel}previews-data.js"></script>
  <script src="./ui-edits.js"></script>
  <script src="./pixel-ui-kit.js"></script>
</body>
</html>
"""


def scaffold_preview(
    slug: str,
    title: str,
    out_root: Path,
    catalog_dir: Path,
    force: bool,
    mode: str = "wireframe",
) -> Path:
    """Create previews/<slug>/ with pixel-ui-kit assets and starter index.html."""
    target_dir = out_root / slug
    target_dir.mkdir(parents=True, exist_ok=True)

    templates_dir = Path(__file__).resolve().parent.parent / "templates"
    shutil.copy2(templates_dir / "pixel-ui-kit.css", target_dir / "pixel-ui-kit.css")
    shutil.copy2(templates_dir / "pixel-ui-kit.js", target_dir / "pixel-ui-kit.js")

    index_path = target_dir / "index.html"
    rel_catalog = Path(
        shutil.os.path.relpath(catalog_dir.resolve(), start=target_dir.resolve())
    ).as_posix().rstrip("/") + "/"

    default_mode = "wireframe" if mode == "wireframe" else "final"
    if force or not index_path.exists():
        index_path.write_text(
            STARTER_HTML.format(
                title=title,
                catalog_rel=rel_catalog,
                default_mode=default_mode,
                wire_active=" is-active" if default_mode == "wireframe" else "",
                final_active=" is-active" if default_mode == "final" else "",
                behavior_active=" is-active" if default_mode == "wireframe" else "",
                behavior_open=" is-open" if default_mode == "wireframe" else "",
            ),
            encoding="utf-8",
        )
    build_gallery(previews_root=out_root, catalog_dir=catalog_dir)
    return index_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Scaffold a Game UI Preview workspace.")
    parser.add_argument("--slug", required=True, help="Preview folder name under previews/.")
    parser.add_argument("--title", default="Game UI Preview", help="Display title for the preview.")
    parser.add_argument("--out-root", default="previews", help="Root folder for previews.")
    parser.add_argument("--catalog", default="previews/_catalog", help="Sprite catalog directory.")
    parser.add_argument(
        "--mode",
        choices=["wireframe", "final"],
        default="wireframe",
        help="Default mode for the starter page (default: wireframe).",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite existing index.html if present.")
    args = parser.parse_args()

    index_path = scaffold_preview(
        slug=args.slug,
        title=args.title,
        out_root=Path(args.out_root),
        catalog_dir=Path(args.catalog),
        force=args.force,
        mode=args.mode,
    )
    print(f"Scaffolded preview at {index_path.as_posix()} (default mode: {args.mode})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
