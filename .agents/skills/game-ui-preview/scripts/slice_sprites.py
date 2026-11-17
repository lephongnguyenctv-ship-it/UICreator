#!/usr/bin/env python3
"""Auto-slice packed sprite sheets into isolated PNGs, manifest JSON, and visual contact sheets."""

from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from pathlib import Path
import re
import sys
import threading
from typing import Any
import urllib.error
import urllib.request
import webbrowser

from PIL import Image, ImageDraw, ImageFilter, ImageFont

_SCRIPTS_DIR = str(Path(__file__).resolve().parent)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from build_gallery import build_gallery


@dataclass
class SliceRecord:
    """Metadata for a single extracted sprite slice."""

    slice_id: str
    file: str
    source_file: str
    group: str
    bbox: list[int]
    width: int
    height: int
    category: str
    slice_9: list[int] | None
    is_white_mask_candidate: bool


def slugify(text: str) -> str:
    """Convert a path stem into a lowercase underscore-safe identifier."""
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower()).strip("_")
    return cleaned or "sprite"


def shorten_stem(rel_path: Path) -> str:
    """Build a concise, deterministic prefix from a relative PNG path."""
    parts = [slugify(p) for p in rel_path.with_suffix("").parts]
    joined = "_".join(parts)
    replacements = {
        "sprite_sheet_for_basic_pack": "basic_pack",
        "dialouge_ui_": "dlg_",
        "dialogue_ui_": "dlg_",
        "mouse_sprites_": "mouse_",
        "buttons_square_buttons_": "btn_sq_",
        "buttons_small_square_buttons": "btn_sm_sq",
        "special_icons_": "spec_",
        "teemo_basic_emote_animations_sprite_sheet": "teemo_emote",
        "dialog_box_character_finished_talking_click_to_continue_indicator_spritesheet": "dlg_continue",
        "premade_dialog_box_": "premade_dlg_",
    }
    for old, new in replacements.items():
        joined = joined.replace(old, new)
    return joined[:48].strip("_")


def classify_slice(rel_path: Path, width: int, height: int) -> str:
    """Infer a semantic UI category hint from path and dimensions."""
    lower = rel_path.as_posix().lower()
    if "mouse" in lower or "cursor" in lower:
        return "cursor"
    if "emote" in lower:
        return "emote"
    if ("dialouge" in lower or "dialog" in lower) and width >= 40:
        return "dialog"
    if ("setting menu" in lower or "panel" in lower) or (width >= 64 and height >= 64):
        return "panel"
    if "button" in lower or (16 <= width <= 192 and 14 <= height <= 64 and width >= height):
        return "button"
    return "icon"


def is_white_mask(crop_im: Image.Image) -> bool:
    """Return True when >80% of opaque pixels are near-white (ideal for CSS mask tinting)."""
    rgba = crop_im.convert("RGBA")
    opaque = 0
    near_white = 0
    for r, g, b, a in rgba.getdata():
        if a > 20:
            opaque += 1
            if r >= 215 and g >= 215 and b >= 215:
                near_white += 1
    return opaque > 0 and (near_white / opaque) >= 0.80


def _color_diff(c1: tuple[int, int, int, int], c2: tuple[int, int, int, int]) -> int:
    return abs(c1[0] - c2[0]) + abs(c1[1] - c2[1]) + abs(c1[2] - c2[2]) + abs(c1[3] - c2[3])


def _clamp_inset(val: int, min_val: int, max_val: int) -> int:
    if max_val < min_val:
        return max(1, max_val)
    return max(min_val, min(val, max_val))


def estimate_9slice(crop_im: Image.Image, category: str) -> list[int] | None:
    """Estimate [top, right, bottom, left] 9-slice insets without bleeding rounded corners into stretch regions."""
    if category not in {"panel", "dialog", "button"}:
        return None
    w, h = crop_im.size
    if w < 14 or h < 14:
        return None

    cx, cy = w // 2, h // 2
    px = crop_im.load()
    mid_row = [px[x, cy] for x in range(w)]
    mid_col = [px[cx, y] for y in range(h)]

    def row_matches(y: int, x_start: int = 0, x_end: int = w) -> bool:
        return all(_color_diff(px[x, y], mid_row[x]) <= 12 for x in range(x_start, x_end))

    def col_matches(x: int, y_start: int = 0, y_end: int = h) -> bool:
        return all(_color_diff(px[x, y], mid_col[y]) <= 12 for y in range(y_start, y_end))

    max_top = min(16, h // 2 - 2)
    max_bottom = min(16, h // 2 - 2)
    max_left = min(16, w // 2 - 2)
    max_right = min(16, w // 2 - 2)

    top = 0
    while top < max_top and not row_matches(top):
        top += 1

    bottom = 0
    while bottom < max_bottom and not row_matches(h - 1 - bottom):
        bottom += 1

    left = 0
    while left < max_left and not col_matches(left):
        left += 1

    right = 0
    while right < max_right and not col_matches(w - 1 - right):
        right += 1

    # Fallback when side protrusions (e.g. speech bubble tail) break full-span symmetry
    if top + bottom >= h - 4 or (top >= max_top and bottom >= max_bottom):
        x_trim = min(w // 4, 12)
        if w - 2 * x_trim >= 4:
            top = 0
            while top < max_top and not row_matches(top, x_trim, w - x_trim):
                top += 1
            bottom = 0
            while bottom < max_bottom and not row_matches(h - 1 - bottom, x_trim, w - x_trim):
                bottom += 1

    if left + right >= w - 4 or (left >= max_left and right >= max_right):
        y_trim = min(h // 4, 12)
        if h - 2 * y_trim >= 4:
            left = 0
            while left < max_left and not col_matches(left, y_trim, h - y_trim):
                left += 1
            right = 0
            while right < max_right and not col_matches(w - 1 - right, y_trim, h - y_trim):
                right += 1

    min_v = 3 if h >= 16 else 2
    min_h = 3 if w >= 16 else 2
    top = _clamp_inset(top, min_v, max_top)
    bottom = _clamp_inset(bottom, min_v, max_bottom)
    left = _clamp_inset(left, min_h, max_left)
    right = _clamp_inset(right, min_h, max_right)
    return [top, right, bottom, left]


def detect_grid_cells(
    im: Image.Image,
    cell_size: int,
    alpha_threshold: int,
    min_size: int,
) -> list[tuple[int, int, int, int]]:
    """Extract tightly trimmed bounding boxes from fixed-size sprite sheet cells."""
    w, h = im.size
    alpha = im.split()[3].point(lambda p: 255 if p >= alpha_threshold else 0)
    boxes: list[tuple[int, int, int, int]] = []
    for gy in range(0, h, cell_size):
        for gx in range(0, w, cell_size):
            cell_alpha = alpha.crop((gx, gy, min(w, gx + cell_size), min(h, gy + cell_size)))
            bbox = cell_alpha.getbbox()
            if not bbox:
                continue
            bx0, by0, bx1, by1 = bbox
            if (bx1 - bx0) >= min_size or (by1 - by0) >= min_size:
                boxes.append((gx + bx0, gy + by0, gx + bx1, gy + by1))
    return boxes


def detect_islands(
    im: Image.Image,
    alpha_threshold: int,
    dilate: int,
    min_size: int,
) -> list[tuple[int, int, int, int]]:
    """Detect connected sprite bounding boxes using dilated grouping and tight un-dilated cropping."""
    w, h = im.size
    alpha = im.split()[3]
    base_mask = alpha.point(lambda p: 255 if p >= alpha_threshold else 0)
    work_mask = (
        base_mask.filter(ImageFilter.MaxFilter(dilate * 2 + 1))
        if dilate > 0
        else base_mask
    )

    base_px = base_mask.load()
    work_px = work_mask.load()
    visited = [[False] * w for _ in range(h)]
    boxes: list[tuple[int, int, int, int]] = []

    for y in range(h):
        for x in range(w):
            if work_px[x, y] == 0 or visited[y][x]:
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y][x] = True

            min_x, min_y = w, h
            max_x, max_y = -1, -1
            opaque_count = 0

            while queue:
                cx, cy = queue.popleft()
                if base_px[cx, cy] > 0:
                    opaque_count += 1
                    if cx < min_x:
                        min_x = cx
                    if cx > max_x:
                        max_x = cx
                    if cy < min_y:
                        min_y = cy
                    if cy > max_y:
                        max_y = cy

                for nx in range(max(0, cx - 1), min(w, cx + 2)):
                    for ny in range(max(0, cy - 1), min(h, cy + 2)):
                        if not visited[ny][nx] and work_px[nx, ny] > 0:
                            visited[ny][nx] = True
                            queue.append((nx, ny))

            if opaque_count == 0 or max_x < min_x or max_y < min_y:
                continue

            bw = max_x - min_x + 1
            bh = max_y - min_y + 1
            effective_min = min(min_size, min(w, h))
            if bw >= effective_min or bh >= effective_min:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1))

    # Sort deterministically by row band (16px) then left-to-right
    boxes.sort(key=lambda b: (b[1] // 16, b[0], b[1]))
    return boxes


def _load_font(size: int = 12) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def _draw_checkerboard(img: Image.Image, x0: int, y0: int, w: int, h: int, tile: int = 8) -> None:
    draw = ImageDraw.Draw(img)
    c1 = (44, 48, 56, 255)
    c2 = (58, 63, 74, 255)
    for ty in range(0, h, tile):
        for tx in range(0, w, tile):
            color = c1 if ((tx // tile + ty // tile) % 2 == 0) else c2
            draw.rectangle(
                [x0 + tx, y0 + ty, min(x0 + w - 1, x0 + tx + tile - 1), min(y0 + h - 1, y0 + ty + tile - 1)],
                fill=color,
            )


def render_contact_sheets(
    records: list[SliceRecord],
    slices_root: Path,
    out_dir: Path,
    cards_per_page: int = 36,
) -> list[str]:
    """Render high-contrast labeled contact sheets grouped by folder for AI visual selection."""
    out_dir.mkdir(parents=True, exist_ok=True)
    grouped: dict[str, list[SliceRecord]] = {}
    for rec in records:
        grouped.setdefault(rec.group, []).append(rec)

    font_title = _load_font(16)
    font_label = _load_font(11)
    font_meta = _load_font(11)

    generated_paths: list[str] = []
    cols = 6
    card_w = 252
    card_h = 166
    pad = 14
    header_h = 44

    for group_name, items in sorted(grouped.items()):
        total_pages = max(1, (len(items) + cards_per_page - 1) // cards_per_page)
        for page_idx in range(total_pages):
            chunk = items[page_idx * cards_per_page : (page_idx + 1) * cards_per_page]
            rows = max(1, (len(chunk) + cols - 1) // cols)
            sheet_w = pad + cols * (card_w + pad)
            sheet_h = header_h + pad + rows * (card_h + pad)

            sheet = Image.new("RGBA", (sheet_w, sheet_h), (24, 26, 32, 255))
            draw = ImageDraw.Draw(sheet)

            title = (
                f"Group: {group_name}  |  Page {page_idx + 1}/{total_pages}"
                f"  |  Slices: {len(chunk)} of {len(items)}"
            )
            draw.text((pad, 14), title, fill=(240, 224, 190, 255), font=font_title)

            for idx, rec in enumerate(chunk):
                col = idx % cols
                row = idx // cols
                cx = pad + col * (card_w + pad)
                cy = header_h + pad + row * (card_h + pad)

                draw.rectangle([cx, cy, cx + card_w - 1, cy + card_h - 1], fill=(34, 37, 45, 255), outline=(78, 84, 98, 255))

                preview_x = cx + 8
                preview_y = cy + 8
                preview_w = card_w - 16
                preview_h = card_h - 54
                _draw_checkerboard(sheet, preview_x, preview_y, preview_w, preview_h, tile=8)

                sprite_im = Image.open(slices_root / rec.file).convert("RGBA")
                sw, sh = sprite_im.size
                # Integer scale up small pixel art for legibility; downscale oversized panels cleanly
                max_int_scale = min(preview_w // max(1, sw), preview_h // max(1, sh))
                if max_int_scale >= 1:
                    scale = min(3, max_int_scale)
                    disp_w, disp_h = sw * scale, sh * scale
                    resized = sprite_im.resize((disp_w, disp_h), Image.Resampling.NEAREST)
                else:
                    ratio = min(preview_w / sw, preview_h / sh)
                    disp_w = max(1, int(sw * ratio))
                    disp_h = max(1, int(sh * ratio))
                    resized = sprite_im.resize((disp_w, disp_h), Image.Resampling.NEAREST)

                ox = preview_x + (preview_w - disp_w) // 2
                oy = preview_y + (preview_h - disp_h) // 2
                sheet.alpha_composite(resized, (ox, oy))

                label_y = cy + card_h - 40
                draw.text((cx + 8, label_y), rec.slice_id, fill=(255, 244, 214, 255), font=font_label)

                slice_info = f"9s:{rec.slice_9}" if rec.slice_9 else ("mask" if rec.is_white_mask_candidate else rec.category)
                meta_text = f"{rec.width}x{rec.height} | {slice_info}"
                draw.text((cx + 8, label_y + 18), meta_text, fill=(165, 180, 200, 255), font=font_meta)

            suffix = f"_{page_idx + 1:02d}" if total_pages > 1 else ""
            out_name = f"contact_sheet_{slugify(group_name)}{suffix}.png"
            out_path = out_dir / out_name
            sheet.save(out_path)
            generated_paths.append(f"contact_sheets/{out_name}")

    return generated_paths


def load_overrides(output_dir: Path) -> dict[str, Any]:
    """Load optional manual overrides (e.g. slice_9 edits) from output_dir/overrides.json."""
    ov_path = output_dir / "overrides.json"
    if not ov_path.exists():
        return {"slice_9": {}}
    try:
        data = json.loads(ov_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"slice_9": {}}
    if not isinstance(data, dict):
        return {"slice_9": {}}
    slice_9_map = data.get("slice_9")
    if not isinstance(slice_9_map, dict):
        slice_9_map = {}
    return {"slice_9": slice_9_map}


def save_overrides(output_dir: Path, overrides: dict[str, Any]) -> Path:
    """Persist manual overrides cleanly to output_dir/overrides.json."""
    output_dir.mkdir(parents=True, exist_ok=True)
    ov_path = output_dir / "overrides.json"
    ov_path.write_text(json.dumps(overrides, indent=2) + "\n", encoding="utf-8")
    return ov_path


def apply_slice9_overrides_in_place(output_dir: Path, updates: dict[str, list[int] | None]) -> dict[str, Any]:
    """Update overrides.json, manifest.json, and catalog-data.js in place without re-slicing sheets."""
    overrides = load_overrides(output_dir)
    slice_9_map: dict[str, list[int]] = overrides["slice_9"]

    for slice_id, val in updates.items():
        if val is None:
            slice_9_map.pop(slice_id, None)
        else:
            slice_9_map[slice_id] = [max(0, int(x)) for x in val[:4]]

    save_overrides(output_dir, overrides)

    manifest_path = output_dir / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            manifest = None

        if isinstance(manifest, dict) and isinstance(manifest.get("slices"), dict):
            slices_dict = manifest["slices"]
            for slice_id, val in updates.items():
                rec = slices_dict.get(slice_id)
                if not isinstance(rec, dict):
                    continue
                if val is None:
                    sprite_path = output_dir / str(rec.get("file", ""))
                    if sprite_path.exists():
                        with Image.open(sprite_path) as raw_crop:
                            rec["slice_9"] = estimate_9slice(raw_crop.convert("RGBA"), str(rec.get("category", "panel")))
                else:
                    rec["slice_9"] = [max(0, int(x)) for x in val[:4]]

            manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            catalog_js_path = output_dir / "catalog-data.js"
            catalog_js_path.write_text(
                "// Auto-generated by slice_sprites.py for file:// preview compatibility\n"
                f"window.SPRITE_CATALOG = {json.dumps(manifest, separators=(',', ':'))};\n",
                encoding="utf-8",
            )

    return slice_9_map


def _clean_transform_number(val: Any, default: float = 0.0) -> int | float:
    try:
        num = float(val)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(num):
        return default
    rounded = round(num, 4)
    return int(rounded) if rounded.is_integer() else rounded


def _clean_transform_pair(val: Any, default: list[float]) -> list[int | float]:
    if isinstance(val, (list, tuple)) and len(val) == 2:
        return [
            _clean_transform_number(val[0], default[0]),
            _clean_transform_number(val[1], default[1]),
        ]
    return list(default)


def apply_ui_edits_in_place(previews_root: Path, slug: str, edits_payload: dict[str, Any]) -> dict[str, Any]:
    """Persist per-preview text, sprite, and transform edits to previews/<slug>/ui-edits.json and ui-edits.js."""
    clean_slug = str(slug or "").strip()
    if not clean_slug or "/" in clean_slug or "\\" in clean_slug or clean_slug.startswith("."):
        raise ValueError(f"Invalid preview slug: {slug!r}")

    resolved_root = previews_root.resolve()
    target_dir = (resolved_root / clean_slug).resolve()
    if target_dir.parent != resolved_root or not (target_dir / "index.html").is_file():
        raise FileNotFoundError(f"Preview not found for slug: {clean_slug}")

    raw_text = edits_payload.get("textEdits") if isinstance(edits_payload, dict) else {}
    raw_sprites = edits_payload.get("spriteEdits") if isinstance(edits_payload, dict) else {}
    raw_transforms = edits_payload.get("transformEdits") if isinstance(edits_payload, dict) else {}

    clean_text: dict[str, str] = {}
    if isinstance(raw_text, dict):
        for k, v in raw_text.items():
            if isinstance(k, str) and k.strip():
                clean_text[k.strip()] = str(v)

    clean_sprites: dict[str, dict[str, str]] = {}
    if isinstance(raw_sprites, dict):
        for path_key, attr_map in raw_sprites.items():
            if not isinstance(path_key, str) or not path_key.strip() or not isinstance(attr_map, dict):
                continue
            cleaned_attrs: dict[str, str] = {}
            for attr_name, slice_val in attr_map.items():
                if isinstance(attr_name, str) and attr_name.strip() and isinstance(slice_val, str) and slice_val.strip():
                    cleaned_attrs[attr_name.strip()] = slice_val.strip()
            if cleaned_attrs:
                clean_sprites[path_key.strip()] = cleaned_attrs

    clean_transforms: dict[str, dict[str, Any]] = {}
    if isinstance(raw_transforms, dict):
        for path_key, tf_obj in raw_transforms.items():
            if not isinstance(path_key, str) or not path_key.strip() or not isinstance(tf_obj, dict):
                continue
            entry: dict[str, Any] = {}
            if "posX" in tf_obj:
                entry["posX"] = _clean_transform_number(tf_obj["posX"], 0)
            if "posY" in tf_obj:
                entry["posY"] = _clean_transform_number(tf_obj["posY"], 0)
            if "width" in tf_obj:
                w = float(_clean_transform_number(tf_obj["width"], 1))
                entry["width"] = _clean_transform_number(max(1.0, w), 1)
            if "height" in tf_obj:
                h = float(_clean_transform_number(tf_obj["height"], 1))
                entry["height"] = _clean_transform_number(max(1.0, h), 1)
            if "rotate" in tf_obj:
                entry["rotate"] = _clean_transform_number(tf_obj["rotate"], 0)
            if "anchorMin" in tf_obj:
                entry["anchorMin"] = _clean_transform_pair(tf_obj["anchorMin"], [0.5, 0.5])
            if "anchorMax" in tf_obj:
                entry["anchorMax"] = _clean_transform_pair(tf_obj["anchorMax"], [0.5, 0.5])
            if "pivot" in tf_obj:
                entry["pivot"] = _clean_transform_pair(tf_obj["pivot"], [0.5, 0.5])
            if "lockAspect" in tf_obj:
                entry["lockAspect"] = bool(tf_obj["lockAspect"])
            if "aspectRatio" in tf_obj:
                ratio = float(_clean_transform_number(tf_obj["aspectRatio"], 1.0))
                entry["aspectRatio"] = _clean_transform_number(max(0.0001, ratio), 1.0)
            if entry:
                clean_transforms[path_key.strip()] = entry

    normalized: dict[str, Any] = {
        "textEdits": clean_text,
        "spriteEdits": clean_sprites,
    }
    if clean_transforms:
        normalized["transformEdits"] = clean_transforms

    edits_json_path = target_dir / "ui-edits.json"
    edits_json_path.write_text(json.dumps(normalized, indent=2) + "\n", encoding="utf-8")

    edits_js_path = target_dir / "ui-edits.js"
    edits_js_path.write_text(
        "// Auto-generated by Studio UI Editor for zero-CORS file:// preview loading\n"
        "window.PIXELUI_EDITS = window.PIXELUI_EDITS || {};\n"
        f"window.PIXELUI_EDITS[{json.dumps(clean_slug)}] = {json.dumps(normalized, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    return normalized


def _is_studio_server_running(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=1.2) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return bool(isinstance(data, dict) and data.get("ok"))
    except (OSError, ValueError, urllib.error.URLError):
        return False
    return False


def run_studio_server(
    root_dir: Path,
    catalog_dir: Path,
    port: int = 17890,
    open_browser: bool = False,
) -> int:
    """Serve workspace previews and accept live 9-slice save POSTs from file:// or http:// pages."""
    resolved_root = root_dir.resolve()
    resolved_catalog = catalog_dir.resolve()
    previews_root = resolved_catalog.parent

    try:
        hub_rel = (previews_root / "index.html").relative_to(resolved_root).as_posix()
        hub_url_path = f"/{hub_rel}"
    except ValueError:
        hub_url_path = "/previews/index.html"

    build_gallery(previews_root=previews_root, catalog_dir=resolved_catalog)
    hub_full_url = f"http://127.0.0.1:{port}{hub_url_path}"

    if _is_studio_server_running(port):
        print(f"Studio save server already listening on http://127.0.0.1:{port}", flush=True)
        if open_browser:
            print(f"Opening {hub_full_url}", flush=True)
            webbrowser.open(hub_full_url)
        return 0

    class _ReusableThreadingHTTPServer(ThreadingHTTPServer):
        allow_reuse_address = True
        daemon_threads = True

    class StudioRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(resolved_root), **kwargs)

        def end_headers(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            super().end_headers()

        def _send_json(self, status: int, payload: dict[str, Any]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self) -> None:
            req_path = self.path.split("?", 1)[0]
            if req_path == "/favicon.ico":
                self.send_response(204)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if req_path in ("/", "/previews", "/previews/"):
                self.send_response(302)
                self.send_header("Location", hub_url_path)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if req_path == "/api/ping":
                self._send_json(200, {"ok": True, "catalog": catalog_dir.as_posix()})
                return
            if req_path == "/api/previews":
                payload = build_gallery(previews_root=previews_root, catalog_dir=resolved_catalog, sync_kit=False)
                self._send_json(200, {"ok": True, **payload})
                return
            super().do_GET()

        def do_POST(self) -> None:
            req_path = self.path.split("?", 1)[0]
            if req_path not in ("/api/save-slice9", "/api/save-ui-edits"):
                self._send_json(404, {"ok": False, "error": f"Unknown endpoint: {req_path}"})
                return

            length = int(self.headers.get("Content-Length", "0") or 0)
            raw = self.rfile.read(length) if length > 0 else b"{}"
            try:
                data = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                self._send_json(400, {"ok": False, "error": f"Invalid JSON: {exc}"})
                return

            if not isinstance(data, dict):
                self._send_json(400, {"ok": False, "error": "Expected JSON object"})
                return

            if req_path == "/api/save-ui-edits":
                slug = str(data.get("slug") or "")
                edits = data.get("edits") if isinstance(data.get("edits"), dict) else {}
                try:
                    saved = apply_ui_edits_in_place(previews_root, slug, edits)
                except ValueError as exc:
                    self._send_json(400, {"ok": False, "error": str(exc)})
                    return
                except FileNotFoundError as exc:
                    self._send_json(404, {"ok": False, "error": str(exc)})
                    return
                self._send_json(200, {"ok": True, "slug": slug, "edits": saved})
                return

            updates: dict[str, list[int] | None] = {}
            if isinstance(data.get("overrides"), dict):
                for sid, arr in data["overrides"].items():
                    if isinstance(arr, list) and len(arr) == 4:
                        updates[str(sid)] = [int(x) for x in arr]
                    elif arr is None:
                        updates[str(sid)] = None
            if data.get("slice_id") and isinstance(data.get("slice_9"), list) and len(data["slice_9"]) == 4:
                updates[str(data["slice_id"])] = [int(x) for x in data["slice_9"]]
            if data.get("reset_slice_id"):
                updates[str(data["reset_slice_id"])] = None

            updated_map = apply_slice9_overrides_in_place(catalog_dir, updates)
            resolved_map: dict[str, Any] = {}
            manifest_path = catalog_dir / "manifest.json"
            if manifest_path.exists():
                try:
                    m_data = json.loads(manifest_path.read_text(encoding="utf-8"))
                    slices_dict = m_data.get("slices", {}) if isinstance(m_data, dict) else {}
                    for sid in updates:
                        rec = slices_dict.get(sid)
                        if isinstance(rec, dict) and "slice_9" in rec:
                            resolved_map[sid] = rec["slice_9"]
                except (OSError, json.JSONDecodeError):
                    pass
            self._send_json(200, {"ok": True, "slice_9": updated_map, "resolved": resolved_map})

        def log_message(self, format: str, *args: Any) -> None:
            pass

    server = _ReusableThreadingHTTPServer(("127.0.0.1", port), StudioRequestHandler)
    print(f"Studio save server listening on http://127.0.0.1:{port} (hub: {hub_full_url})", flush=True)
    if open_browser:
        threading.Timer(0.4, lambda: webbrowser.open(hub_full_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


def process_directory(
    input_dir: Path,
    output_dir: Path,
    alpha_threshold: int,
    dilate: int,
    min_size: int,
) -> dict[str, Any]:
    """Slice all PNGs in input_dir and write manifest, JS catalog, and contact sheets."""
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    slices_dir = output_dir / "slices"
    contact_dir = output_dir / "contact_sheets"
    slices_dir.mkdir(parents=True, exist_ok=True)
    contact_dir.mkdir(parents=True, exist_ok=True)

    overrides = load_overrides(output_dir)
    slice9_overrides: dict[str, Any] = overrides.get("slice_9", {})

    # Clean stale outputs so catalog matches current input folder
    for stale in slices_dir.glob("*.png"):
        stale.unlink()
    for stale in contact_dir.glob("*.png"):
        stale.unlink()

    png_files = sorted(input_dir.rglob("*.png"), key=lambda p: p.as_posix().lower())
    if not png_files:
        raise RuntimeError(f"No PNG files found under {input_dir}")

    records: list[SliceRecord] = []
    sources_meta: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    for png_path in png_files:
        rel_path = png_path.relative_to(input_dir)
        group = rel_path.parts[0] if len(rel_path.parts) > 1 else "root"
        stem = shorten_stem(rel_path)

        with Image.open(png_path) as raw_im:
            im = raw_im.convert("RGBA")
            w, h = im.size
            lower_name = rel_path.as_posix().lower()
            if "emote" in lower_name and w % 32 == 0 and h % 32 == 0:
                sheet_dilate = 0
                boxes = detect_grid_cells(im, cell_size=32, alpha_threshold=alpha_threshold, min_size=min_size)
            else:
                # Large packed sheets (e.g. Basic Pack 896x240) pack items tightly; avoid merging neighbors
                sheet_dilate = 0 if (w >= 400 and dilate > 0 and "basic pack" in lower_name) else dilate
                boxes = detect_islands(im, alpha_threshold=alpha_threshold, dilate=sheet_dilate, min_size=min_size)
                # Zero-gap button strips (e.g. 32x128 16x16 grid) collapse into 1 strip; split on 16px grid
                if (
                    len(boxes) == 1
                    and "button" in lower_name
                    and w % 16 == 0
                    and h % 16 == 0
                    and (w > 32 or h > 32)
                ):
                    boxes = detect_grid_cells(im, cell_size=16, alpha_threshold=alpha_threshold, min_size=min_size)

            sheet_slice_ids: list[str] = []
            for idx, (x0, y0, x1, y1) in enumerate(boxes, start=1):
                crop = im.crop((x0, y0, x1, y1))
                cw, ch = crop.size
                base_id = f"{stem}_{idx:03d}"
                slice_id = base_id
                collision = 2
                while slice_id in used_ids:
                    slice_id = f"{base_id}_{collision}"
                    collision += 1
                used_ids.add(slice_id)

                slice_rel = f"slices/{slice_id}.png"
                crop.save(output_dir / slice_rel)

                cat = classify_slice(rel_path, cw, ch)
                manual_9 = slice9_overrides.get(slice_id)
                if isinstance(manual_9, list) and len(manual_9) == 4:
                    slice_9 = [int(v) for v in manual_9]
                else:
                    slice_9 = estimate_9slice(crop, cat)
                white_mask = is_white_mask(crop)

                records.append(
                    SliceRecord(
                        slice_id=slice_id,
                        file=slice_rel,
                        source_file=rel_path.as_posix(),
                        group=group,
                        bbox=[x0, y0, cw, ch],
                        width=cw,
                        height=ch,
                        category=cat,
                        slice_9=slice_9,
                        is_white_mask_candidate=white_mask,
                    )
                )
                sheet_slice_ids.append(slice_id)

            sources_meta.append(
                {
                    "source_file": rel_path.as_posix(),
                    "width": w,
                    "height": h,
                    "dilate_used": sheet_dilate,
                    "slice_count": len(sheet_slice_ids),
                    "slice_ids": sheet_slice_ids,
                }
            )

    contact_sheets = render_contact_sheets(records, output_dir, contact_dir)

    manifest = {
        "input_dir": input_dir.as_posix(),
        "total_sources": len(sources_meta),
        "total_slices": len(records),
        "contact_sheets": contact_sheets,
        "sources": sources_meta,
        "slices": {
            r.slice_id: {
                "id": r.slice_id,
                "file": r.file,
                "source_file": r.source_file,
                "group": r.group,
                "bbox": r.bbox,
                "width": r.width,
                "height": r.height,
                "category": r.category,
                "slice_9": r.slice_9,
                "is_white_mask_candidate": r.is_white_mask_candidate,
            }
            for r in records
        },
    }

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    catalog_js_path = output_dir / "catalog-data.js"
    catalog_js_path.write_text(
        "// Auto-generated by slice_sprites.py for file:// preview compatibility\n"
        f"window.SPRITE_CATALOG = {json.dumps(manifest, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    build_gallery(previews_root=output_dir.resolve().parent, catalog_dir=output_dir)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Slice packed PNG sprite sheets into isolated sprites + contact sheets.")
    parser.add_argument("--input", default="Sprite sheets", help="Directory containing source PNG sprite sheets.")
    parser.add_argument("--output", default="previews/_catalog", help="Output catalog directory.")
    parser.add_argument("--alpha-threshold", type=int, default=10, help="Minimum alpha (0-255) considered opaque.")
    parser.add_argument("--dilate", type=int, default=1, help="Pixel dilation radius for grouping multi-part icons.")
    parser.add_argument("--min-size", type=int, default=4, help="Minimum slice width/height in pixels.")
    parser.add_argument(
        "--set-slice9",
        nargs=2,
        action="append",
        metavar=("SLICE_ID", "T,R,B,L"),
        help="Save a manual 9-slice override (e.g. --set-slice9 basic_pack_056 4,4,5,4) into overrides.json.",
    )
    parser.add_argument("--reslice", action="store_true", help="Force full sheet re-slice after applying --set-slice9.")
    parser.add_argument("--serve", action="store_true", help="Run local Studio save server on 127.0.0.1 for live Save 9-Slice.")
    parser.add_argument("--port", type=int, default=17890, help="Port for --serve (default: 17890).")
    parser.add_argument("--open", action="store_true", help="Open the Game UI Preview Hub in your default browser when --serve starts.")
    args = parser.parse_args()

    out_dir = Path(args.output)
    if args.set_slice9:
        updates: dict[str, list[int] | None] = {}
        for slice_id, raw_vals in args.set_slice9:
            parts = [int(p.strip()) for p in raw_vals.split(",") if p.strip()]
            if len(parts) != 4:
                raise SystemExit(f"Invalid --set-slice9 values '{raw_vals}' for {slice_id}; expected 4 integers T,R,B,L")
            updates[slice_id] = parts
        updated_map = apply_slice9_overrides_in_place(out_dir, updates)
        if not args.reslice and not args.serve and (out_dir / "manifest.json").exists():
            print(f"Updated 9-slice overrides in place ({len(updates)} updated, {len(updated_map)} total).")
            return 0

    if args.serve:
        if not (out_dir / "manifest.json").exists():
            process_directory(
                input_dir=Path(args.input),
                output_dir=out_dir,
                alpha_threshold=args.alpha_threshold,
                dilate=args.dilate,
                min_size=args.min_size,
            )
        return run_studio_server(Path.cwd(), out_dir, args.port, open_browser=args.open)

    manifest = process_directory(
        input_dir=Path(args.input),
        output_dir=out_dir,
        alpha_threshold=args.alpha_threshold,
        dilate=args.dilate,
        min_size=args.min_size,
    )
    print(
        f"Sliced {manifest['total_slices']} sprites from {manifest['total_sources']} PNG sheets "
        f"into {Path(args.output).as_posix()} ({len(manifest['contact_sheets'])} contact sheets)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
