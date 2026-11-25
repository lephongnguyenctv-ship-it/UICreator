#!/usr/bin/env python3
"""Scan previews/*, build previews/_catalog/previews-data.js, and render previews/index.html."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
from typing import Any


ROOT_BAT_TEMPLATE = """@echo off
setlocal
cd /d "%~dp0"
title Game UI Preview Hub ^& Studio Backend (Port 17890)
echo ============================================================================
echo   Game UI Preview Hub ^& Studio Backend Server
echo   URL: http://127.0.0.1:17890/{hub_url_rel}
echo ============================================================================
echo.
echo Syncing UI Gallery and starting local backend server on port 17890...
echo (Keep this window open while editing 9-slice borders. Press Ctrl+C to stop.)
echo.
set "SCRIPT={script_rel}"
set "ARGS={script_args}"

if not exist "%SCRIPT%" (
  echo UICreator submodule not initialized yet. Running git submodule update --init...
  git submodule update --init --recursive
)

where uv >nul 2>&1
if not errorlevel 1 (
  uv run --with pillow "%SCRIPT%" %ARGS%
  goto :check_exit
)

if exist "%USERPROFILE%\\.local\\bin\\uv.exe" (
  "%USERPROFILE%\\.local\\bin\\uv.exe" run --with pillow "%SCRIPT%" %ARGS%
  goto :check_exit
)

python -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  python "%SCRIPT%" %ARGS%
  goto :check_exit
)

py -3 -c "import PIL" >nul 2>&1
if not errorlevel 1 (
  py -3 "%SCRIPT%" %ARGS%
  goto :check_exit
)

echo [ERROR] No working Python 3 + Pillow installation or uv runner was found.
echo Install uv or Python 3 with Pillow: pip install pillow
pause
exit /b 1

:check_exit
if errorlevel 1 (
  echo.
  echo [ERROR] Server exited with an error. Make sure Python 3 and Pillow or uv are installed.
  pause
  exit /b 1
)
"""


def detect_craftland_project_root(start_dir: Path, explicit_root: Path | None = None) -> Path | None:
    """Walk up from start_dir to locate a Craftland Studio project root (main.gproj or Assets + ProjectSettings)."""
    if explicit_root is not None:
        resolved = explicit_root.resolve()
        if (resolved / "main.gproj").is_file() or ((resolved / "Assets").is_dir() and (resolved / "ProjectSettings").is_dir()):
            return resolved
        return resolved

    cur = start_dir.resolve()
    if cur.is_file():
        cur = cur.parent
    for candidate in (cur, *cur.parents):
        if (candidate / "main.gproj").is_file() or (
            (candidate / "Assets").is_dir() and (candidate / "ProjectSettings").is_dir()
        ):
            return candidate
    return None


def _render_launch_bat(bat_dir: Path, previews_root: Path, catalog_dir: Path, project_root: Path | None = None) -> str:
    resolved_bat_dir = bat_dir.resolve()
    resolved_previews = previews_root.resolve()
    resolved_catalog = catalog_dir.resolve()
    resolved_proj = (project_root or resolved_bat_dir).resolve()

    slice_script = (Path(__file__).resolve().parent / "slice_sprites.py").resolve()
    script_rel = os.path.relpath(slice_script, start=resolved_bat_dir).replace("/", "\\")
    cat_rel = os.path.relpath(resolved_catalog, start=resolved_bat_dir).replace("/", "\\")
    proj_rel = os.path.relpath(resolved_proj, start=resolved_bat_dir).replace("/", "\\")

    try:
        hub_url_rel = (resolved_previews / "index.html").relative_to(resolved_proj).as_posix()
    except ValueError:
        hub_url_rel = "previews/index.html"

    is_craftland = (resolved_proj / "main.gproj").is_file() or (
        (resolved_proj / "Assets").is_dir() and (resolved_proj / "ProjectSettings").is_dir()
    )
    if is_craftland:
        args_parts = []
        if proj_rel != ".":
            args_parts.append(f'--project-root "{proj_rel}"')
        args_parts.append(f"--output {cat_rel} --serve --port 17890 --open")
        script_args = " ".join(args_parts)
    else:
        script_args = f"--output {cat_rel} --serve --port 17890 --open"

    return ROOT_BAT_TEMPLATE.format(
        hub_url_rel=hub_url_rel,
        script_rel=script_rel,
        script_args=script_args,
    )


class _PreviewHTMLParser(HTMLParser):
    """Lightweight parser to extract title, default mode, views, triggers, and sprite count."""

    def __init__(self) -> None:
        super().__init__()
        self.in_title = False
        self.page_title_parts: list[str] = []
        self.wb_title_depth = 0
        self.in_wb_title_span = False
        self.wb_title_parts: list[str] = []
        self.found_wb_title = False
        self.default_mode = "final"
        self.views: list[str] = []
        self.wb_trigger_labels: dict[str, str] = {}
        self._active_trigger_id: str | None = None
        self._active_trigger_parts: list[str] = []
        self.slice_ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        classes = set(attr_map.get("class", "").split())
        tag_l = tag.lower()

        if tag_l == "title":
            self.in_title = True

        if tag_l == "body" and attr_map.get("data-default-mode"):
            self.default_mode = attr_map["data-default-mode"].strip().lower()

        if self.wb_title_depth > 0:
            self.wb_title_depth += 1
            if (
                tag_l == "span"
                and not self.found_wb_title
                and "workbench-badge" not in classes
                and not self.in_wb_title_span
            ):
                self.in_wb_title_span = True
        elif "workbench-title" in classes:
            self.wb_title_depth = 1

        view_id = attr_map.get("data-ui-view", "").strip()
        if view_id and view_id not in self.views:
            self.views.append(view_id)

        trigger_id = attr_map.get("data-ui-state-trigger", "").strip()
        if trigger_id and "wb-btn" in classes and trigger_id not in self.wb_trigger_labels:
            self._active_trigger_id = trigger_id
            self._active_trigger_parts = []

        for attr_name in ("data-slice-id", "data-slice-hover", "data-slice-pressed", "data-slice-on", "data-slice-off"):
            val = attr_map.get(attr_name, "").strip()
            if val:
                self.slice_ids.add(val)

    def handle_endtag(self, tag: str) -> None:
        tag_l = tag.lower()
        if tag_l == "title":
            self.in_title = False

        if self.in_wb_title_span and tag_l == "span":
            self.in_wb_title_span = False
            if "".join(self.wb_title_parts).strip():
                self.found_wb_title = True

        if self.wb_title_depth > 0:
            self.wb_title_depth -= 1

        if self._active_trigger_id is not None and tag_l in ("button", "a", "span"):
            label = re.sub(r"\s+", " ", "".join(self._active_trigger_parts)).strip()
            if label:
                self.wb_trigger_labels[self._active_trigger_id] = label
            self._active_trigger_id = None
            self._active_trigger_parts = []

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.page_title_parts.append(data)
        if self.in_wb_title_span:
            self.wb_title_parts.append(data)
        if self._active_trigger_id is not None:
            self._active_trigger_parts.append(data)


def _humanize_slug(text: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"[-_]+", text.strip()) if part) or text


def _extract_preview_metadata(preview_dir: Path, previews_root: Path) -> dict[str, Any]:
    slug = preview_dir.name
    index_path = preview_dir / "index.html"
    raw_html = index_path.read_text(encoding="utf-8")

    parser = _PreviewHTMLParser()
    parser.feed(raw_html)
    parser.close()

    wb_title = re.sub(r"\s+", " ", "".join(parser.wb_title_parts)).strip()
    page_title = re.sub(r"\s+", " ", "".join(parser.page_title_parts)).strip()
    page_title = re.sub(r"\s*[—-]\s*Game UI Preview(?:\s+Showcase)?$", "", page_title, flags=re.IGNORECASE).strip()
    title = wb_title or page_title or _humanize_slug(slug)

    view_ids = parser.views or ["main"]

    report_path = preview_dir / "verification" / "report.json"
    verification: dict[str, Any] = {
        "status": "UNVERIFIED",
        "timestamp": None,
        "summary": None,
    }
    if report_path.exists():
        try:
            report_data = json.loads(report_path.read_text(encoding="utf-8"))
            if isinstance(report_data, dict):
                verification = {
                    "status": str(report_data.get("status") or "UNVERIFIED"),
                    "timestamp": report_data.get("timestamp"),
                    "summary": report_data.get("summary"),
                }
        except (OSError, json.JSONDecodeError):
            pass

    shots_dir = preview_dir / "verification" / "screenshots"
    views_meta: list[dict[str, Any]] = []
    for vid in view_ids:
        final_shot = shots_dir / f"{vid}-clean.png"
        wire_shot = shots_dir / f"{vid}-wireframe-clean.png"
        views_meta.append(
            {
                "id": vid,
                "label": parser.wb_trigger_labels.get(vid) or _humanize_slug(vid),
                "final_screenshot": final_shot.relative_to(previews_root).as_posix() if final_shot.exists() else None,
                "wireframe_screenshot": wire_shot.relative_to(previews_root).as_posix() if wire_shot.exists() else None,
            }
        )

    return {
        "slug": slug,
        "title": title,
        "default_mode": parser.default_mode,
        "path": f"{slug}/index.html",
        "sprite_count": len(parser.slice_ids),
        "views": views_meta,
        "verification": verification,
    }


def scan_previews(previews_root: Path) -> dict[str, Any]:
    """Scan previews_root for self-contained UI previews and build catalog metadata."""
    previews: list[dict[str, Any]] = []
    if previews_root.exists():
        for entry in sorted(previews_root.iterdir(), key=lambda p: p.name.lower()):
            if not entry.is_dir() or entry.name.startswith("_") or entry.name.startswith("."):
                continue
            if not (entry / "index.html").is_file():
                continue
            previews.append(_extract_preview_metadata(entry, previews_root))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_previews": len(previews),
        "previews": previews,
    }


def build_gallery(
    previews_root: Path = Path("previews"),
    catalog_dir: Path = Path("previews/_catalog"),
    sync_kit: bool = True,
    project_root: Path | None = None,
) -> dict[str, Any]:
    """Generate previews/_catalog/previews-data.js, previews/index.html, and sync kit templates."""
    previews_root.mkdir(parents=True, exist_ok=True)
    catalog_dir.mkdir(parents=True, exist_ok=True)

    detected_proj = detect_craftland_project_root(previews_root, explicit_root=project_root)
    payload = scan_previews(previews_root)

    previews_js_path = catalog_dir / "previews-data.js"
    previews_js_path.write_text(
        "// Auto-generated by build_gallery.py for zero-CORS file:// and http:// preview hub compatibility\n"
        f"window.UI_PREVIEWS_CATALOG = {json.dumps(payload, separators=(',', ':'))};\n",
        encoding="utf-8",
    )

    templates_dir = Path(__file__).resolve().parent.parent / "templates"
    hub_template = templates_dir / "gallery-hub.html"
    if hub_template.exists():
        shutil.copy2(hub_template, previews_root / "index.html")

    if sync_kit:
        css_src = templates_dir / "pixel-ui-kit.css"
        js_src = templates_dir / "pixel-ui-kit.js"
        for item in payload["previews"]:
            target_dir = previews_root / item["slug"]
            if css_src.exists():
                shutil.copy2(css_src, target_dir / "pixel-ui-kit.css")
            if js_src.exists():
                shutil.copy2(js_src, target_dir / "pixel-ui-kit.js")
            edits_js = target_dir / "ui-edits.js"
            if not edits_js.exists():
                edits_js.write_text(
                    "// Auto-generated by Studio UI Editor\nwindow.PIXELUI_EDITS = window.PIXELUI_EDITS || {};\n",
                    encoding="utf-8",
                )

    bat_parent = previews_root.resolve().parent
    bat_path = bat_parent / "launch_ui_hub.bat"
    bat_content = _render_launch_bat(
        bat_dir=bat_parent,
        previews_root=previews_root,
        catalog_dir=catalog_dir,
        project_root=detected_proj or bat_parent,
    )
    if not bat_path.exists() or detected_proj is not None:
        bat_path.write_text(bat_content, encoding="utf-8")

    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the Game UI Preview Hub and previews-data.js index.")
    parser.add_argument("--previews-root", default="previews", help="Root folder containing UI previews.")
    parser.add_argument("--catalog", default="previews/_catalog", help="Shared sprite & preview catalog directory.")
    parser.add_argument(
        "--project-root",
        default=None,
        help="Optional Craftland project root directory (auto-detected when omitted).",
    )
    parser.add_argument(
        "--no-sync-kit",
        action="store_true",
        help="Skip syncing pixel-ui-kit.css and pixel-ui-kit.js into existing preview folders.",
    )
    args = parser.parse_args()

    payload = build_gallery(
        previews_root=Path(args.previews_root),
        catalog_dir=Path(args.catalog),
        sync_kit=not args.no_sync_kit,
        project_root=Path(args.project_root).resolve() if args.project_root else None,
    )
    print(f"Built UI Preview Hub at {Path(args.previews_root).as_posix()}/index.html ({payload['total_previews']} UIs).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
