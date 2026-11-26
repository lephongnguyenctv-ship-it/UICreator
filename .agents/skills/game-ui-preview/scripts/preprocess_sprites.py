#!/usr/bin/env python3
"""Stage 1.5 Opt-In Sprite Preprocessor for UICreator & Craftland Studio.

Downscales oversized UI PNGs with premultiplied-alpha Lanczos resampling,
proportionally rescales sibling Craftland .png.meta 9-slice borders (preserving
fileId) and _catalog/overrides.json, compresses to PNG8 (via ui-asset-creator's
compress_png.mjs or Pillow FASTOCTREE fallback), and optionally triggers
Craftland Studio MCP `asset-refresh`.

Safe by default: runs in --dry-run mode unless --apply is explicitly passed.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any

from PIL import Image

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from build_gallery import detect_craftland_project_root
from export_craftland_ui import CraftlandMcpClient, discover_mcp_info
from slice_sprites import write_craftland_png_meta_slice9


def _load_slice9_overrides(catalog_dir: Path) -> dict[str, list[int]]:
    ov_path = catalog_dir / "overrides.json"
    if not ov_path.is_file():
        return {}
    try:
        data = json.loads(ov_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    raw = data.get("slice_9") if isinstance(data, dict) else None
    if not isinstance(raw, dict):
        return {}
    out: dict[str, list[int]] = {}
    for k, v in raw.items():
        if isinstance(v, list) and len(v) == 4:
            out[str(k)] = [max(0, int(x)) for x in v]
    return out


def _find_compress_png_script() -> Path | None:
    """Locate sibling ui-asset-creator/scripts/compress_png.mjs if installed."""
    candidates = [
        _SCRIPTS_DIR.parent.parent / "ui-asset-creator" / "scripts" / "compress_png.mjs",
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def resize_premultiplied_rgba(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Resize RGBA image using premultiplied alpha to avoid dark/white fringe halos."""
    rgba = img.convert("RGBA")
    if rgba.size == (target_w, target_h):
        return rgba

    # Premultiply RGB by Alpha in floating point per channel
    r, g, b, a = rgba.split()
    a_px = a.load()
    r_px = r.load()
    g_px = g.load()
    b_px = b.load()
    w, h = rgba.size

    pr = Image.new("F", (w, h))
    pg = Image.new("F", (w, h))
    pb = Image.new("F", (w, h))
    pa = Image.new("F", (w, h))
    pr_px, pg_px, pb_px, pa_px = pr.load(), pg.load(), pb.load(), pa.load()

    for y in range(h):
        for x in range(w):
            af = a_px[x, y] / 255.0
            pa_px[x, y] = af
            pr_px[x, y] = r_px[x, y] * af
            pg_px[x, y] = g_px[x, y] * af
            pb_px[x, y] = b_px[x, y] * af

    pr_s = pr.resize((target_w, target_h), Image.Resampling.LANCZOS)
    pg_s = pg.resize((target_w, target_h), Image.Resampling.LANCZOS)
    pb_s = pb.resize((target_w, target_h), Image.Resampling.LANCZOS)
    pa_s = pa.resize((target_w, target_h), Image.Resampling.LANCZOS)

    out = Image.new("RGBA", (target_w, target_h))
    out_px = out.load()
    pr_sp, pg_sp, pb_sp, pa_sp = pr_s.load(), pg_s.load(), pb_s.load(), pa_s.load()

    for y in range(target_h):
        for x in range(target_w):
            af = max(0.0, min(1.0, pa_sp[x, y]))
            ai = int(round(af * 255.0))
            if ai <= 0:
                out_px[x, y] = (0, 0, 0, 0)
            else:
                inv = 1.0 / af
                ri = max(0, min(255, int(round(pr_sp[x, y] * inv))))
                gi = max(0, min(255, int(round(pg_sp[x, y] * inv))))
                bi = max(0, min(255, int(round(pb_sp[x, y] * inv))))
                out_px[x, y] = (ri, gi, bi, ai)
    return out


def compress_png8_in_place(png_path: Path, prefer_node: bool = True) -> tuple[bool, str]:
    """Compress PNG to PNG8 (PLTE + tRNS) using ui-asset-creator's compress_png.mjs or Pillow fallback."""
    before = png_path.stat().st_size
    tmp_out = png_path.with_suffix(".tmp_png8.png")

    compress_script = _find_compress_png_script() if prefer_node else None
    node_exe = shutil.which("node")
    if compress_script and node_exe:
        try:
            proc = subprocess.run(
                [node_exe, str(compress_script), str(png_path), str(tmp_out)],
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            if proc.returncode == 0 and tmp_out.is_file():
                after = tmp_out.stat().st_size
                if after < before:
                    tmp_out.replace(png_path)
                    return True, f"compress_png.mjs ({before // 1024}KB -> {after // 1024}KB)"
                tmp_out.unlink(missing_ok=True)
                return False, f"kept RGBA ({before // 1024}KB <= PNG8 {after // 1024}KB)"
        except Exception:
            tmp_out.unlink(missing_ok=True)

    # Pillow FASTOCTREE PNG8 fallback (preserves full alpha palette in PNG tRNS)
    try:
        with Image.open(png_path) as im:
            q = im.convert("RGBA").quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
            q.save(tmp_out, format="PNG", optimize=True)
        after = tmp_out.stat().st_size
        if after < before:
            tmp_out.replace(png_path)
            return True, f"pillow-png8 ({before // 1024}KB -> {after // 1024}KB)"
        tmp_out.unlink(missing_ok=True)
        return False, f"kept RGBA ({before // 1024}KB)"
    except Exception as exc:
        tmp_out.unlink(missing_ok=True)
        return False, f"png8 skipped ({exc})"


def build_preprocess_plan(
    manifest: dict[str, Any],
    project_root: Path,
    selected_ids: set[str] | None = None,
    spec_overrides: dict[str, dict[str, Any]] | None = None,
    forced_scale: float | None = None,
    max_dim: int | None = None,
) -> list[dict[str, Any]]:
    """Build deterministic list of sprite resize/border/compression operations."""
    slices = manifest.get("slices") or {}
    plan: list[dict[str, Any]] = []
    spec_overrides = spec_overrides or {}

    for sid, rec in sorted(slices.items()):
        if not isinstance(rec, dict):
            continue
        if selected_ids is not None and sid not in selected_ids:
            continue
        has_spec = sid in spec_overrides
        warns = rec.get("audit_warnings") or []
        if selected_ids is None and not has_spec and not warns:
            continue

        src_rel = str(rec.get("source_file") or rec.get("file") or "").strip()
        if not src_rel or src_rel.startswith("lib://"):
            continue
        png_path = (project_root / src_rel).resolve()
        if not png_path.is_file():
            continue

        w = int(rec.get("width") or 0)
        h = int(rec.get("height") or 0)
        if w <= 0 or h <= 0:
            with Image.open(png_path) as im:
                w, h = im.size
        s9 = rec.get("slice_9")
        s9_list = [int(v) for v in s9[:4]] if isinstance(s9, list) and len(s9) == 4 else None

        target_w, target_h = w, h
        target_s9 = list(s9_list) if s9_list else None

        if has_spec:
            sp = spec_overrides[sid]
            if "width" in sp and "height" in sp:
                target_w = max(2, int(sp["width"]))
                target_h = max(2, int(sp["height"]))
            elif "scale" in sp:
                sc = float(sp["scale"])
                target_w = max(2, int(round((w * sc) / 2.0) * 2))
                target_h = max(2, int(round((h * sc) / 2.0) * 2))
            if "slice_9" in sp:
                target_s9 = [max(0, int(v)) for v in sp["slice_9"][:4]] if sp["slice_9"] else None
            elif s9_list and (target_w != w or target_h != h):
                sx = target_w / max(1, w)
                sy = target_h / max(1, h)
                target_s9 = [
                    max(0, int(round(s9_list[0] * sy))),
                    max(0, int(round(s9_list[1] * sx))),
                    max(0, int(round(s9_list[2] * sy))),
                    max(0, int(round(s9_list[3] * sx))),
                ]
        elif forced_scale is not None:
            target_w = max(2, int(round((w * forced_scale) / 2.0) * 2))
            target_h = max(2, int(round((h * forced_scale) / 2.0) * 2))
            if s9_list:
                target_s9 = [max(0, int(round(v * forced_scale))) for v in s9_list]
        elif max_dim is not None and max(w, h) > max_dim:
            sc = max_dim / float(max(w, h))
            target_w = max(2, int(round((w * sc) / 2.0) * 2))
            target_h = max(2, int(round((h * sc) / 2.0) * 2))
            if s9_list:
                target_s9 = [max(0, int(round(v * sc))) for v in s9_list]
        else:
            # Use first audit warning's suggested_size / suggested_slice_9 if available
            for warn in warns:
                if isinstance(warn.get("suggested_size"), list) and len(warn["suggested_size"]) == 2:
                    target_w = int(warn["suggested_size"][0])
                    target_h = int(warn["suggested_size"][1])
                    if isinstance(warn.get("suggested_slice_9"), list) and len(warn["suggested_slice_9"]) == 4:
                        target_s9 = [int(v) for v in warn["suggested_slice_9"]]
                    elif s9_list and (target_w != w or target_h != h):
                        sx = target_w / max(1, w)
                        sy = target_h / max(1, h)
                        target_s9 = [
                            max(0, int(round(s9_list[0] * sy))),
                            max(0, int(round(s9_list[1] * sx))),
                            max(0, int(round(s9_list[2] * sy))),
                            max(0, int(round(s9_list[3] * sx))),
                        ]
                    break

        plan.append(
            {
                "slice_id": sid,
                "source_file": src_rel,
                "png_path": png_path,
                "orig_size": [w, h],
                "target_size": [target_w, target_h],
                "orig_slice_9": s9_list,
                "target_slice_9": target_s9,
                "orig_kb": round(png_path.stat().st_size / 1024, 1),
            }
        )
    return plan


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Stage 1.5 opt-in sprite downscaler, 9-slice .meta rescaler, and PNG8 compressor."
    )
    parser.add_argument("--catalog", required=True, help="Path to _catalog/manifest.json (or _catalog directory).")
    parser.add_argument("--project-root", default=None, help="Project root directory (auto-detected when omitted).")
    parser.add_argument("--sprites", default=None, help="Comma-separated list of slice_ids to process (defaults to all audit-flagged sprites).")
    parser.add_argument("--spec", default=None, help="Optional JSON file mapping slice_id -> {width, height, slice_9} or {scale}.")
    parser.add_argument("--scale", type=float, default=None, help="Uniform scale factor override (e.g. 0.5).")
    parser.add_argument("--max-dim", type=int, default=None, help="Clamp max(width, height) to this pixel ceiling.")
    parser.add_argument("--no-png8", action="store_true", help="Skip PNG8 quantization after resize.")
    parser.add_argument("--apply", action="store_true", help="Actually overwrite PNGs, .png.meta borders, and overrides.json (default is dry-run).")
    parser.add_argument("--dry-run", action="store_true", help="Preview planned changes without modifying files (default).")
    parser.add_argument("--mcp-url", default=None, help="Optional Craftland Studio MCP URL to call asset-refresh after --apply.")
    args = parser.parse_args()

    cat_path = Path(args.catalog).resolve()
    manifest_path = cat_path / "manifest.json" if cat_path.is_dir() else cat_path
    catalog_dir = manifest_path.parent
    if not manifest_path.is_file():
        print(f"[ERROR] manifest.json not found at {manifest_path}", file=sys.stderr)
        return 2

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    project_root = (
        Path(args.project_root).resolve()
        if args.project_root
        else (detect_craftland_project_root(catalog_dir) or catalog_dir.parent.parent.resolve())
    )

    selected_ids = (
        {s.strip() for s in args.sprites.split(",") if s.strip()}
        if args.sprites
        else None
    )
    spec_overrides: dict[str, dict[str, Any]] = {}
    if args.spec:
        spec_path = Path(args.spec).resolve()
        spec_overrides = json.loads(spec_path.read_text(encoding="utf-8"))
        if selected_ids is None:
            selected_ids = set(spec_overrides.keys())

    plan = build_preprocess_plan(
        manifest=manifest,
        project_root=project_root,
        selected_ids=selected_ids,
        spec_overrides=spec_overrides,
        forced_scale=args.scale,
        max_dim=args.max_dim,
    )

    if not plan:
        print("[PREPROCESS] No sprites matched for preprocessing (0 flagged / selected).")
        return 0

    dry_run = not args.apply or args.dry_run
    mode_tag = "DRY-RUN" if dry_run else "APPLY"
    print(f"[PREPROCESS {mode_tag}] {len(plan)} sprite(s) in {project_root.as_posix()}:")

    overrides = _load_slice9_overrides(catalog_dir)
    overrides_dirty = False
    refresh_dirs: set[str] = set()

    for op in plan:
        sid = op["slice_id"]
        png_path: Path = op["png_path"]
        ow, oh = op["orig_size"]
        tw, th = op["target_size"]
        os9 = op["orig_slice_9"]
        ts9 = op["target_slice_9"]

        if dry_run:
            print(f"  - {sid:24s} {ow}x{oh} ({op['orig_kb']}KB) -> {tw}x{th}  slice9: {os9} -> {ts9}")
            continue

        with Image.open(png_path) as im:
            resized = resize_premultiplied_rgba(im, tw, th)
        resized.save(png_path, format="PNG", optimize=True)

        png8_note = "no-png8"
        if not args.no_png8:
            _, png8_note = compress_png8_in_place(png_path)

        meta_updated = False
        if ts9 is not None:
            meta_updated = write_craftland_png_meta_slice9(png_path, ts9)
            if sid in overrides:
                overrides[sid] = ts9
                overrides_dirty = True

        after_kb = round(png_path.stat().st_size / 1024, 1)
        rel_dir = Path(op["source_file"]).parent.as_posix()
        if rel_dir and rel_dir != ".":
            refresh_dirs.add(rel_dir)
        print(
            f"  + {sid:24s} {ow}x{oh} ({op['orig_kb']}KB) -> {tw}x{th} ({after_kb}KB, {png8_note}) "
            f"slice9: {os9} -> {ts9} (meta={meta_updated})"
        )

    if not dry_run and overrides_dirty:
        ov_path = catalog_dir / "overrides.json"
        ov_path.write_text(json.dumps({"slice_9": overrides}, indent=2) + "\n", encoding="utf-8")
        print(f"[PREPROCESS] Updated {ov_path.as_posix()}")

    if not dry_run and refresh_dirs:
        mcp_url, _ = discover_mcp_info(project_root, override=args.mcp_url)
        if mcp_url:
            try:
                client = CraftlandMcpClient(mcp_url)
                client.initialize()
                for rdir in sorted(refresh_dirs):
                    client.call_tool("asset-refresh", {"targets": [rdir]})
                    print(f"[MCP] Refreshed Craftland Studio assets in {rdir}")
            except Exception as exc:
                print(f"[WARN] Craftland MCP asset-refresh skipped/failed: {exc}", file=sys.stderr)

    if dry_run:
        print("Re-run with --apply to write changes, then re-run slice_sprites.py to refresh catalog metadata.")
    else:
        print("[DONE] Re-run slice_sprites.py to refresh manifest.json, catalog-data.js, and contact sheets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
