#!/usr/bin/env python3
"""Auto-slice packed sprite sheets into isolated PNGs, manifest JSON, and visual contact sheets."""

from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
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

from build_gallery import build_gallery, detect_craftland_project_root


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
    craftland_file_id: str | None = None
    craftland_asset_path: str | None = None


def slugify(text: str) -> str:
    """Convert a path stem into a lowercase underscore-safe identifier."""
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower()).strip("_")
    return cleaned or "sprite"


def camel_to_snake_slug(text: str) -> str:
    """Convert CamelCase / mixed identifiers (e.g. SquareRounded128) into snake_case."""
    step1 = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", text.strip())
    step2 = re.sub(r"([a-zA-Z])([0-9]+)", r"\1_\2", step1)
    return slugify(step2)


def read_craftland_png_meta(png_path: Path) -> tuple[str | None, list[int] | None]:
    """Read sibling <sprite>.png.meta JSON and return (fileId, slice_9_or_None)."""
    meta_path = Path(str(png_path) + ".meta")
    if not meta_path.is_file():
        return None, None
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, None
    if not isinstance(data, dict):
        return None, None
    file_id = str(data.get("fileId") or "").strip() or None
    b_top = max(0, int(data.get("borderTop", 0) or 0))
    b_right = max(0, int(data.get("borderRight", 0) or 0))
    b_bottom = max(0, int(data.get("borderBottom", 0) or 0))
    b_left = max(0, int(data.get("borderLeft", 0) or 0))
    slice_9 = [b_top, b_right, b_bottom, b_left] if (b_top or b_right or b_bottom or b_left) else None
    return file_id, slice_9


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

                sprite_path = Path(rec.file)
                if not sprite_path.is_file():
                    sprite_path = slices_root / rec.file
                sprite_im = Image.open(sprite_path).convert("RGBA")
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


def apply_slice9_overrides_in_place(
    output_dir: Path,
    updates: dict[str, list[int] | None],
    project_root: Path | None = None,
) -> dict[str, Any]:
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
            resolved_proj_root = (
                project_root.resolve()
                if project_root
                else (detect_craftland_project_root(output_dir) or Path.cwd().resolve())
            )
            is_craftland = bool(manifest.get("craftland_project"))
            slices_dict = manifest["slices"]
            for slice_id, val in updates.items():
                rec = slices_dict.get(slice_id)
                if not isinstance(rec, dict):
                    continue
                if val is None:
                    rel_file = str(rec.get("file", ""))
                    sprite_path = output_dir / rel_file
                    if not sprite_path.is_file():
                        sprite_path = resolved_proj_root / rel_file
                    if sprite_path.is_file():
                        _, meta_s9 = read_craftland_png_meta(sprite_path)
                        if meta_s9 is not None or (is_craftland and Path(str(sprite_path) + ".meta").is_file()):
                            rec["slice_9"] = meta_s9
                        else:
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


def _clean_hex_color(val: Any, default: str = "#FFFFFF") -> str:
    raw = str(val or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", raw):
        return raw.upper()
    if re.fullmatch(r"#[0-9a-fA-F]{3}", raw):
        return ("#" + "".join(ch * 2 for ch in raw[1:])).upper()
    return default


def _clean_clamped_number(val: Any, lo: float, hi: float, default: float, decimals: int = 3) -> int | float:
    num = float(_clean_transform_number(val, default))
    num = max(lo, min(hi, num))
    rounded = round(num, decimals)
    return int(rounded) if rounded.is_integer() else rounded


def apply_ui_edits_in_place(previews_root: Path, slug: str, edits_payload: dict[str, Any]) -> dict[str, Any]:
    """Persist per-preview text, sprite, transform, label, and image edits to previews/<slug>/ui-edits.json and ui-edits.js."""
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
    raw_tints = edits_payload.get("tintEdits") if isinstance(edits_payload, dict) else {}
    raw_labels = edits_payload.get("labelEdits") if isinstance(edits_payload, dict) else {}
    raw_images = edits_payload.get("imageEdits") if isinstance(edits_payload, dict) else {}

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
                if not isinstance(attr_name, str) or not attr_name.strip() or not isinstance(slice_val, str):
                    continue
                aname = attr_name.strip()
                sval = slice_val.strip()
                if sval or aname in ("data-slice-hover", "data-slice-pressed"):
                    cleaned_attrs[aname] = sval
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

    clean_tints: dict[str, dict[str, str]] = {}
    if isinstance(raw_tints, dict):
        for path_key, tint_obj in raw_tints.items():
            if not isinstance(path_key, str) or not path_key.strip() or not isinstance(tint_obj, dict):
                continue
            col = str(tint_obj.get("color") or "").strip()
            if not col:
                continue
            mode = str(tint_obj.get("mode") or "auto").strip().lower()
            if mode not in ("auto", "mask", "multiply"):
                mode = "auto"
            clean_tints[path_key.strip()] = {"color": _clean_hex_color(col, col), "mode": mode}

    clean_labels: dict[str, dict[str, Any]] = {}
    if isinstance(raw_labels, dict):
        for path_key, lbl_obj in raw_labels.items():
            if not isinstance(path_key, str) or not path_key.strip() or not isinstance(lbl_obj, dict):
                continue
            entry: dict[str, Any] = {}
            if "color" in lbl_obj:
                entry["color"] = _clean_hex_color(lbl_obj["color"], "#FFFFFF")
            if "alpha" in lbl_obj:
                entry["alpha"] = _clean_clamped_number(lbl_obj["alpha"], 0.0, 100.0, 100.0, 1)
            if "fontSize" in lbl_obj:
                entry["fontSize"] = _clean_clamped_number(lbl_obj["fontSize"], 4.0, 256.0, 16.0, 1)
            if "alignH" in lbl_obj and str(lbl_obj["alignH"]) in ("left", "center", "right", "fillH"):
                entry["alignH"] = str(lbl_obj["alignH"])
            if "alignV" in lbl_obj and str(lbl_obj["alignV"]) in ("top", "middle", "bottom", "fillV"):
                entry["alignV"] = str(lbl_obj["alignV"])
            for bkey in ("bold", "italic", "underline", "shadow", "outline"):
                if bkey in lbl_obj:
                    entry[bkey] = bool(lbl_obj[bkey])
            if "lineSpacing" in lbl_obj:
                entry["lineSpacing"] = _clean_clamped_number(lbl_obj["lineSpacing"], -64.0, 128.0, 0.0, 2)
            if "overflow" in lbl_obj:
                ov = int(_clean_transform_number(lbl_obj["overflow"], 0))
                entry["overflow"] = ov if ov in (0, 1, 2) else 0
            if "shadowColor" in lbl_obj:
                entry["shadowColor"] = _clean_hex_color(lbl_obj["shadowColor"], "#000000")
            if "shadowOffset" in lbl_obj:
                entry["shadowOffset"] = _clean_transform_pair(lbl_obj["shadowOffset"], [1, 1])
            if "shadowAlpha" in lbl_obj:
                entry["shadowAlpha"] = _clean_clamped_number(lbl_obj["shadowAlpha"], 0.0, 1.0, 1.0, 3)
            if "outlineColor" in lbl_obj:
                entry["outlineColor"] = _clean_hex_color(lbl_obj["outlineColor"], "#000000")
            if "outlineAlpha" in lbl_obj:
                entry["outlineAlpha"] = _clean_clamped_number(lbl_obj["outlineAlpha"], 0.0, 1.0, 1.0, 3)
            if "outlineWidth" in lbl_obj:
                entry["outlineWidth"] = _clean_clamped_number(lbl_obj["outlineWidth"], 0.0, 24.0, 1.0, 2)
            if "gradient" in lbl_obj:
                gr = int(_clean_transform_number(lbl_obj["gradient"], 0))
                entry["gradient"] = gr if gr in (0, 1, 2) else 0
            if "gradientTop" in lbl_obj:
                entry["gradientTop"] = _clean_hex_color(lbl_obj["gradientTop"], "#FFFFFF")
            if "gradientTopAlpha" in lbl_obj:
                entry["gradientTopAlpha"] = _clean_clamped_number(lbl_obj["gradientTopAlpha"], 0.0, 100.0, 100.0, 1)
            if "gradientBottom" in lbl_obj:
                entry["gradientBottom"] = _clean_hex_color(lbl_obj["gradientBottom"], "#FFFFFF")
            if "gradientBottomAlpha" in lbl_obj:
                entry["gradientBottomAlpha"] = _clean_clamped_number(lbl_obj["gradientBottomAlpha"], 0.0, 100.0, 100.0, 1)
            if entry:
                clean_labels[path_key.strip()] = entry

    clean_images: dict[str, dict[str, Any]] = {}
    if isinstance(raw_images, dict):
        for path_key, img_obj in raw_images.items():
            if not isinstance(path_key, str) or not path_key.strip() or not isinstance(img_obj, dict):
                continue
            entry: dict[str, Any] = {}
            if "color" in img_obj:
                entry["color"] = _clean_hex_color(img_obj["color"], "#FFFFFF")
            if "tintMode" in img_obj and str(img_obj["tintMode"]).lower() in ("auto", "mask", "multiply"):
                entry["tintMode"] = str(img_obj["tintMode"]).lower()
            if "alpha" in img_obj:
                entry["alpha"] = _clean_clamped_number(img_obj["alpha"], 0.0, 100.0, 100.0, 1)
            for bkey in ("flipX", "flipY", "centerInvisible", "invertFill", "passthrough"):
                if bkey in img_obj:
                    entry[bkey] = bool(img_obj[bkey])
            if "fillType" in img_obj:
                ft = int(_clean_transform_number(img_obj["fillType"], 0))
                entry["fillType"] = ft if ft in (0, 1, 2, 3, 5) else 0
            if "fillDir" in img_obj:
                fd = int(_clean_transform_number(img_obj["fillDir"], 0))
                entry["fillDir"] = fd if fd in (0, 1, 2, 3, 4) else 0
            if "fillAmount" in img_obj:
                entry["fillAmount"] = _clean_clamped_number(img_obj["fillAmount"], 0.0, 1.0, 1.0, 3)
            if "gradient" in img_obj:
                gr = int(_clean_transform_number(img_obj["gradient"], 0))
                entry["gradient"] = gr if gr in (0, 1, 2) else 0
            if "gradientTop" in img_obj:
                entry["gradientTop"] = _clean_hex_color(img_obj["gradientTop"], "#FFFFFF")
            if "gradientTopAlpha" in img_obj:
                entry["gradientTopAlpha"] = _clean_clamped_number(img_obj["gradientTopAlpha"], 0.0, 100.0, 100.0, 1)
            if "gradientBottom" in img_obj:
                entry["gradientBottom"] = _clean_hex_color(img_obj["gradientBottom"], "#FFFFFF")
            if "gradientBottomAlpha" in img_obj:
                entry["gradientBottomAlpha"] = _clean_clamped_number(img_obj["gradientBottomAlpha"], 0.0, 100.0, 100.0, 1)
            if "pressedColor" in img_obj:
                entry["pressedColor"] = _clean_hex_color(img_obj["pressedColor"], "#C5C5C5")
            if "disableColor" in img_obj:
                entry["disableColor"] = _clean_hex_color(img_obj["disableColor"], "#808080")
            if entry:
                clean_images[path_key.strip()] = entry

    normalized: dict[str, Any] = {
        "textEdits": clean_text,
        "spriteEdits": clean_sprites,
    }
    if clean_transforms:
        normalized["transformEdits"] = clean_transforms
    if clean_tints:
        normalized["tintEdits"] = clean_tints
    if clean_labels:
        normalized["labelEdits"] = clean_labels
    if clean_images:
        normalized["imageEdits"] = clean_images

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

    build_gallery(previews_root=previews_root, catalog_dir=resolved_catalog, project_root=resolved_root)
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
                payload = build_gallery(
                    previews_root=previews_root,
                    catalog_dir=resolved_catalog,
                    sync_kit=False,
                    project_root=resolved_root,
                )
                self._send_json(200, {"ok": True, **payload})
                return
            super().do_GET()

        def do_POST(self) -> None:
            req_path = self.path.split("?", 1)[0]
            if req_path not in ("/api/save-slice9", "/api/save-ui-edits", "/api/export-craftland-ui"):
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

            if req_path == "/api/export-craftland-ui":
                slug = str(data.get("slug") or "").strip()
                if not slug or "/" in slug or "\\" in slug or slug.startswith("."):
                    self._send_json(400, {"ok": False, "error": f"Invalid preview slug: {slug!r}"})
                    return
                page_path = (previews_root / slug / "index.html").resolve()
                if not page_path.is_file():
                    self._send_json(404, {"ok": False, "error": f"Preview page not found: {page_path.as_posix()}"})
                    return
                view_id = str(data.get("view") or "").strip() or None
                ui_name = str(data.get("uiName") or "").strip() or None
                ui_dir = str(data.get("uiDirectory") or "Assets/HUDs/_Draft").strip() or "Assets/HUDs/_Draft"
                mcp_url_override = str(data.get("mcpUrl") or "").strip() or None
                dry_run = bool(data.get("dryRun", False))
                take_snapshot = bool(data.get("snapshot", False))
                try:
                    from export_craftland_ui import run_export_pipeline

                    export_res = run_export_pipeline(
                        page_path=page_path,
                        project_root=resolved_root,
                        view_id=view_id,
                        ui_name=ui_name,
                        ui_directory=ui_dir,
                        mcp_url_override=mcp_url_override,
                        dry_run=dry_run,
                        take_snapshot=take_snapshot,
                    )
                    self._send_json(200, {"ok": True, **export_res})
                except Exception as exc:
                    self._send_json(200, {"ok": False, "error": str(exc)})
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

            updated_map = apply_slice9_overrides_in_place(catalog_dir, updates, project_root=resolved_root)
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


def resolve_real_source_paths(workspace_root: Path, catalog_dir: Path) -> int:
    """Resolve every manifest source_file to a real file path on disk relative to workspace_root.

    Falls back to the real sliced PNG in previews/_catalog/slices/<id>.png when the original
    source sheet no longer exists on disk. Rewrites manifest.json and catalog-data.js if changed.
    """
    manifest_path = catalog_dir / "manifest.json"
    if not manifest_path.exists():
        return 0
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return 0
    if not isinstance(manifest, dict):
        return 0

    root = workspace_root.resolve()
    cat_dir = catalog_dir.resolve()
    raw_input = manifest.get("input_dir")
    input_dir = Path(raw_input).resolve() if isinstance(raw_input, str) and raw_input else (root / "Sprite sheets")

    def to_rel_posix(p: Path) -> str:
        resolved = p.resolve()
        try:
            return resolved.relative_to(root).as_posix()
        except ValueError:
            return resolved.as_posix()

    # Index real PNGs in trusted asset source directories (Sprite sheets/ and assets/)
    indexed_pngs: dict[str, list[Path]] = {}
    for search_root in (input_dir, root / "Sprite sheets", root / "assets"):
        if not search_root.exists():
            continue
        for png in search_root.rglob("*.png"):
            if not png.is_file():
                continue
            key = png.name.lower()
            bucket = indexed_pngs.setdefault(key, [])
            rp = png.resolve()
            if rp not in bucket:
                bucket.append(rp)

    def resolve_one(raw_sf: str, slice_file: str | None) -> str:
        norm = str(raw_sf or "").replace("\\", "/").strip()
        if norm:
            # 1. Already a real path relative to workspace root
            cand_root = root / norm
            if cand_root.is_file():
                return to_rel_posix(cand_root)
            # 2. Real path relative to input_dir (e.g. Sprite sheets/)
            cand_input = input_dir / norm
            if cand_input.is_file():
                return to_rel_posix(cand_input)
            # 3. Embedded absolute Windows path (e.g. "speedyrace/c:/Users/.../file.png")
            drive_match = re.search(r"([a-zA-Z]:/.+)$", norm)
            if drive_match:
                cand_abs = Path(drive_match.group(1))
                if cand_abs.is_file():
                    return to_rel_posix(cand_abs)
            # 4. Filename match in Sprite sheets/ or assets/
            fname = Path(norm).name.lower()
            matches = indexed_pngs.get(fname, [])
            if len(matches) == 1:
                return to_rel_posix(matches[0])
            if len(matches) > 1:
                if "generated" in norm.lower():
                    for m in matches:
                        if "generated" in m.as_posix().lower():
                            return to_rel_posix(m)
                return to_rel_posix(matches[0])

        # 5. Fallback: original source doesn't exist on disk -> use the real slice PNG on disk
        if slice_file:
            sf_norm = str(slice_file).replace("\\", "/")
            cand_root_slice = root / sf_norm
            if cand_root_slice.is_file():
                return to_rel_posix(cand_root_slice)
            cand_slice = cat_dir / sf_norm
            if cand_slice.is_file():
                return to_rel_posix(cand_slice)
        return norm

    changed = 0
    slices_dict = manifest.get("slices")
    if isinstance(slices_dict, dict):
        for sid, rec in slices_dict.items():
            if not isinstance(rec, dict):
                continue
            old_sf = rec.get("source_file", "")
            new_sf = resolve_one(old_sf, rec.get("file"))
            if new_sf and new_sf != old_sf:
                rec["source_file"] = new_sf
                changed += 1

    sources_list = manifest.get("sources")
    if isinstance(sources_list, list):
        for src in sources_list:
            if not isinstance(src, dict):
                continue
            old_sf = src.get("source_file", "")
            slice_ids = src.get("slice_ids") or []
            fallback_slice_file = None
            if isinstance(slices_dict, dict) and slice_ids:
                first_rec = slices_dict.get(slice_ids[0])
                if isinstance(first_rec, dict):
                    fallback_slice_file = first_rec.get("file")
            new_sf = resolve_one(old_sf, fallback_slice_file)
            if new_sf and new_sf != old_sf:
                src["source_file"] = new_sf
                changed += 1

    if changed > 0:
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        catalog_js_path = cat_dir / "catalog-data.js"
        catalog_js_path.write_text(
            "// Auto-generated by slice_sprites.py for file:// preview compatibility\n"
            f"window.SPRITE_CATALOG = {json.dumps(manifest, separators=(',', ':'))};\n",
            encoding="utf-8",
        )
    return changed


def process_directory(
    input_dir: Path,
    output_dir: Path,
    alpha_threshold: int,
    dilate: int,
    min_size: int,
    project: str = "basic-pack",
    craftland_assets: bool = False,
    project_root: Path | None = None,
    extra_inputs: list[Path] | None = None,
) -> dict[str, Any]:
    """Slice or index all PNGs in input_dir (plus optional extra_inputs) and write manifest, JS catalog, and contact sheets.

    In default mode, cropped slices from packed sheets are saved under assets/<project>/slices/.
    In --craftland-assets mode, textures are indexed 1:1 in-place from Assets/ with zero copies,
    extracting fileId and 9-slice borders directly from sibling .png.meta files.
    """
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    detected_craftland_root = detect_craftland_project_root(output_dir, explicit_root=project_root)
    if craftland_assets and detected_craftland_root is None:
        detected_craftland_root = detect_craftland_project_root(input_dir, explicit_root=project_root)
    workspace_root = (project_root or detected_craftland_root or Path.cwd()).resolve()
    is_craftland_project = bool(craftland_assets or detected_craftland_root is not None)

    output_dir = output_dir.resolve()
    contact_dir = output_dir / "contact_sheets"
    contact_dir.mkdir(parents=True, exist_ok=True)

    overrides = load_overrides(output_dir)
    slice9_overrides: dict[str, Any] = overrides.get("slice_9", {})

    for stale in contact_dir.glob("*.png"):
        stale.unlink()

    records: list[SliceRecord] = []
    sources_meta: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    if craftland_assets:
        ws_id_map: dict[str, str] = {}
        ws_id_file = Path(__file__).resolve().parent / "workshop_icon_library_ids.json"
        if ws_id_file.is_file():
            try:
                ws_id_map = json.loads(ws_id_file.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                ws_id_map = {}

        input_roots: list[Path] = [input_dir.resolve()]
        for ext in extra_inputs or []:
            ext_resolved = ext.resolve()
            if ext_resolved.exists() and ext_resolved not in input_roots:
                input_roots.append(ext_resolved)

        all_entries: list[tuple[Path, Path]] = []
        for root_folder in input_roots:
            for p in sorted(root_folder.rglob("*"), key=lambda x: x.as_posix().lower()):
                if p.is_file() and p.suffix.lower() == ".png":
                    all_entries.append((root_folder, p))

        if not all_entries:
            raise RuntimeError(f"No PNG files found under {[r.as_posix() for r in input_roots]}")

        # Count stem frequencies to disambiguate colliding filenames cleanly by folder name
        stem_counts: dict[str, int] = {}
        for root_folder, png_path in all_entries:
            is_ws = "workshopiconlibrary" in root_folder.as_posix().lower() or "workshopiconlibrary" in png_path.as_posix().lower()
            s_key = f"ws_{slugify(png_path.stem)}" if is_ws else camel_to_snake_slug(png_path.stem)
            stem_counts[s_key] = stem_counts.get(s_key, 0) + 1

        for root_folder, png_path in all_entries:
            rel_path = png_path.relative_to(root_folder)
            try:
                real_source_file = png_path.resolve().relative_to(workspace_root).as_posix()
            except ValueError:
                real_source_file = png_path.resolve().as_posix()

            is_ws = "workshopiconlibrary" in root_folder.as_posix().lower() or "workshopiconlibrary" in png_path.as_posix().lower()
            if is_ws:
                group = "WorkshopIconLibrary"
                base_id = f"ws_{slugify(png_path.stem)}"
                craftland_asset_path = f"lib://fftextures/WorkshopIconLibrary/{png_path.name}"
                file_id = ws_id_map.get(craftland_asset_path)
                meta_slice_9 = None
            else:
                group = rel_path.parts[0] if len(rel_path.parts) > 1 else root_folder.name
                base_id = camel_to_snake_slug(png_path.stem)
                if stem_counts.get(base_id, 0) > 1 and len(rel_path.parts) > 1:
                    parent_slug = camel_to_snake_slug(rel_path.parent.name)
                    base_id = f"{parent_slug}_{base_id}"
                craftland_asset_path = real_source_file
                file_id, meta_slice_9 = read_craftland_png_meta(png_path)

            slice_id = base_id
            collision = 2
            while slice_id in used_ids:
                slice_id = f"{base_id}_{collision}"
                collision += 1
            used_ids.add(slice_id)

            with Image.open(png_path) as raw_im:
                im = raw_im.convert("RGBA")
                w, h = im.size
                cat = classify_slice(rel_path, w, h)
                manual_9 = slice9_overrides.get(slice_id)
                if isinstance(manual_9, list) and len(manual_9) == 4:
                    slice_9 = [int(v) for v in manual_9]
                elif meta_slice_9 is not None:
                    slice_9 = meta_slice_9
                    if cat == "icon" and w >= 16 and h >= 16:
                        cat = "panel"
                elif Path(str(png_path) + ".meta").is_file():
                    slice_9 = None
                else:
                    slice_9 = estimate_9slice(im, cat)
                white_mask = is_white_mask(im)

            records.append(
                SliceRecord(
                    slice_id=slice_id,
                    file=real_source_file,
                    source_file=real_source_file,
                    group=group,
                    bbox=[0, 0, w, h],
                    width=w,
                    height=h,
                    category=cat,
                    slice_9=slice_9,
                    is_white_mask_candidate=white_mask,
                    craftland_file_id=file_id,
                    craftland_asset_path=craftland_asset_path,
                )
            )
            sources_meta.append(
                {
                    "source_file": real_source_file,
                    "width": w,
                    "height": h,
                    "dilate_used": 0,
                    "slice_count": 1,
                    "slice_ids": [slice_id],
                    "craftland_file_id": file_id,
                    "craftland_asset_path": craftland_asset_path,
                }
            )
    else:
        safe_project = re.sub(r"[^a-zA-Z0-9_-]+", "-", project.strip()).strip("-") or "basic-pack"
        slices_dir = workspace_root / "assets" / safe_project / "slices"
        slices_dir.mkdir(parents=True, exist_ok=True)
        for stale in slices_dir.glob("*.png"):
            stale.unlink()

        png_files = sorted(input_dir.rglob("*.png"), key=lambda p: p.as_posix().lower())
        if not png_files:
            raise RuntimeError(f"No PNG files found under {input_dir}")

        for png_path in png_files:
            rel_path = png_path.relative_to(input_dir)
            try:
                real_source_file = png_path.resolve().relative_to(workspace_root).as_posix()
            except ValueError:
                real_source_file = png_path.resolve().as_posix()
            group = rel_path.parts[0] if len(rel_path.parts) > 1 else "root"
            stem = shorten_stem(rel_path)
            file_id, meta_slice_9 = read_craftland_png_meta(png_path)

            with Image.open(png_path) as raw_im:
                im = raw_im.convert("RGBA")
                w, h = im.size
                lower_name = rel_path.as_posix().lower()
                if "emote" in lower_name and w % 32 == 0 and h % 32 == 0:
                    sheet_dilate = 0
                    boxes = detect_grid_cells(im, cell_size=32, alpha_threshold=alpha_threshold, min_size=min_size)
                else:
                    sheet_dilate = 0 if (w >= 400 and dilate > 0 and "basic pack" in lower_name) else dilate
                    boxes = detect_islands(im, alpha_threshold=alpha_threshold, dilate=sheet_dilate, min_size=min_size)
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

                    if len(boxes) == 1 and x0 == 0 and y0 == 0 and x1 == w and y1 == h:
                        slice_rel = real_source_file
                    else:
                        slice_dest = slices_dir / f"{slice_id}.png"
                        crop.save(slice_dest)
                        try:
                            slice_rel = slice_dest.resolve().relative_to(workspace_root).as_posix()
                        except ValueError:
                            slice_rel = slice_dest.resolve().as_posix()

                    cat = classify_slice(rel_path, cw, ch)
                    manual_9 = slice9_overrides.get(slice_id)
                    if isinstance(manual_9, list) and len(manual_9) == 4:
                        slice_9 = [int(v) for v in manual_9]
                    elif len(boxes) == 1 and meta_slice_9 is not None:
                        slice_9 = meta_slice_9
                    else:
                        slice_9 = estimate_9slice(crop, cat)
                    white_mask = is_white_mask(crop)

                    records.append(
                        SliceRecord(
                            slice_id=slice_id,
                            file=slice_rel,
                            source_file=real_source_file,
                            group=group,
                            bbox=[x0, y0, cw, ch],
                            width=cw,
                            height=ch,
                            category=cat,
                            slice_9=slice_9,
                            is_white_mask_candidate=white_mask,
                            craftland_file_id=file_id if len(boxes) == 1 else None,
                            craftland_asset_path=real_source_file if len(boxes) == 1 else None,
                        )
                    )
                    sheet_slice_ids.append(slice_id)

                sources_meta.append(
                    {
                        "source_file": real_source_file,
                        "width": w,
                        "height": h,
                        "dilate_used": sheet_dilate,
                        "slice_count": len(sheet_slice_ids),
                        "slice_ids": sheet_slice_ids,
                    }
                )

    contact_sheets = render_contact_sheets(records, workspace_root, contact_dir)

    try:
        input_rel_posix = input_dir.resolve().relative_to(workspace_root).as_posix()
    except ValueError:
        input_rel_posix = input_dir.as_posix()

    project_root_rel = Path(os.path.relpath(workspace_root, start=output_dir)).as_posix().rstrip("/") + "/"

    manifest: dict[str, Any] = {
        "input_dir": input_rel_posix,
        "project_root_rel": project_root_rel,
        "craftland_project": is_craftland_project,
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
                **(
                    {"craftland_file_id": r.craftland_file_id}
                    if r.craftland_file_id is not None
                    else {}
                ),
                **(
                    {"craftland_asset_path": r.craftland_asset_path}
                    if r.craftland_asset_path is not None
                    else {}
                ),
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
    build_gallery(previews_root=output_dir.resolve().parent, catalog_dir=output_dir, project_root=workspace_root)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Slice packed PNG sprite sheets or index Craftland Assets in-place.")
    parser.add_argument("--input", default="Sprite sheets", help="Directory containing source PNG sprite sheets or Assets/Sprites.")
    parser.add_argument(
        "--extra-input",
        action="append",
        default=[],
        help="Additional sprite directories to index alongside --input (e.g. WorkshopIconLibrary).",
    )
    parser.add_argument("--output", default="previews/_catalog", help="Output catalog metadata directory.")
    parser.add_argument("--project", default="basic-pack", help="Project folder under assets/<project>/slices/ for packed-sheet slices.")
    parser.add_argument(
        "--craftland-assets",
        action="store_true",
        help="Index individual Craftland PNG textures in-place without slicing or copying, reading sibling .png.meta fileId & 9-slice.",
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Explicit Craftland project root directory (auto-detected from main.gproj / Assets when omitted).",
    )
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
    parser.add_argument("--sync-sources", action="store_true", help="Resolve all manifest source_file paths to real existing files on disk.")
    parser.add_argument("--serve", action="store_true", help="Run local Studio save server on 127.0.0.1 for live Save 9-Slice.")
    parser.add_argument("--port", type=int, default=17890, help="Port for --serve (default: 17890).")
    parser.add_argument("--open", action="store_true", help="Open the Game UI Preview Hub in your default browser when --serve starts.")
    args = parser.parse_args()

    out_dir = Path(args.output)
    explicit_proj_root = Path(args.project_root).resolve() if args.project_root else None
    detected_root = detect_craftland_project_root(out_dir, explicit_root=explicit_proj_root)
    if args.craftland_assets and detected_root is None:
        detected_root = detect_craftland_project_root(Path(args.input), explicit_root=explicit_proj_root)
    effective_root = explicit_proj_root or detected_root or Path.cwd().resolve()
    extra_input_paths = [Path(p) for p in (args.extra_input or [])]

    if args.sync_sources:
        changed = resolve_real_source_paths(effective_root, out_dir)
        print(f"Resolved real source paths in {out_dir.as_posix()} ({changed} entries updated).")
        if not args.serve and not args.reslice and not args.set_slice9:
            return 0

    if args.set_slice9:
        updates: dict[str, list[int] | None] = {}
        for slice_id, raw_vals in args.set_slice9:
            parts = [int(p.strip()) for p in raw_vals.split(",") if p.strip()]
            if len(parts) != 4:
                raise SystemExit(f"Invalid --set-slice9 values '{raw_vals}' for {slice_id}; expected 4 integers T,R,B,L")
            updates[slice_id] = parts
        updated_map = apply_slice9_overrides_in_place(out_dir, updates, project_root=effective_root)
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
                project=args.project,
                craftland_assets=args.craftland_assets,
                project_root=effective_root,
                extra_inputs=extra_input_paths,
            )
        else:
            resolve_real_source_paths(effective_root, out_dir)
        return run_studio_server(effective_root, out_dir, args.port, open_browser=args.open)

    manifest = process_directory(
        input_dir=Path(args.input),
        output_dir=out_dir,
        alpha_threshold=args.alpha_threshold,
        dilate=args.dilate,
        min_size=args.min_size,
        project=args.project,
        craftland_assets=args.craftland_assets,
        project_root=effective_root,
        extra_inputs=extra_input_paths,
    )
    mode_verb = "Indexed" if args.craftland_assets else "Sliced"
    print(
        f"{mode_verb} {manifest['total_slices']} sprites from {manifest['total_sources']} PNG sources "
        f"into {Path(args.output).as_posix()} ({len(manifest['contact_sheets'])} contact sheets)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
