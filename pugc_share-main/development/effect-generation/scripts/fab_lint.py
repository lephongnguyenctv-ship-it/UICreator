"""Spec linter: budgets and rules taken from the artist's sample (universe_effect.fab).

These are limits observed in ONE reference effect, not official engine limits. Errors stop the build (the .fab
would be broken or use something the sample never uses and the shader cannot render). Warnings are advice.
"""
import os

import fab_core as core
import fab_textures as ft

# Observed in the sample: 9 systems, <= 25 particles each, 64 particles in total (5 of them single-particle bodies),
# 8 textures (128..512 px), 8 materials, 1 shader ("Particles/Standard Unlit"), 2 trails.
#
# Device tiers. "low" is the default: weak phones. The numbers are a judgement, not measured on devices; the sample
# itself only fits "high". overdraw = sum(maxParticles * (size*scale)^2), a cheap proxy for filled screen area.
TIERS = {
    "low":  {"systems": 5,  "per_system": 8,  "total": 20,  "overdraw": 15.0,  "trails": 1, "textures": 5},
    "mid":  {"systems": 8,  "per_system": 20, "total": 50,  "overdraw": 40.0,  "trails": 2, "textures": 6},
    "high": {"systems": 12, "per_system": 30, "total": 100, "overdraw": 120.0, "trails": 3, "textures": 8},
}
DEFAULT_TIER = "low"
BLENDS = ("additive", "alpha")
KNOWN = {"name", "prefab", "folder", "systems"}


def _hi(v):
    if isinstance(v, (int, float)):
        return float(v)
    if v and isinstance(v[0], list):
        return max(p[1] for p in v)
    return float(max(v))


COLOUR_ART = {"saturn", "earth_8x8", "sun_4x4", "coin", "gem", "heart_pickup"}  # library textures painted in colour (not white masks)


def _colours(s):
    """Every RGB colour a system can show: start colour, over-life gradient, trail gradients."""
    out = []

    def add(stops, off):  # off = index of r in each stop ([t,r,g,b,a] -> 1, [r,g,b,a] -> 0)
        for p in stops or []:
            if isinstance(p, list) and len(p) >= off + 3:
                out.append([float(x) for x in p[off:off + 3]])
    c = s.get("color")
    if isinstance(c, list):
        add([c], 0)
    elif isinstance(c, dict):
        add(c.get("between"), 0)
        add(c.get("gradient"), 1)
    col = s.get("colorOverLife")
    add(col.get("color") if isinstance(col, dict) else col, 1)
    tr = s.get("trail")
    if isinstance(tr, dict):
        add(tr.get("colorOverTrail"), 1)
        add(tr.get("colorOverLife"), 1)
    return out


def _lo(v):
    if isinstance(v, (int, float)):
        return float(v)
    if v and isinstance(v[0], list):
        return min(p[1] for p in v)
    return float(min(v))


def art_review(systems):
    """Design notes from the art-direction rules in references/artist-style.md (advice, never blocks a build)."""
    import colorsys
    notes = []
    cols = [c for s in systems if s.get("texture") not in COLOUR_ART for c in _colours(s)]
    if not cols and not any(s.get("texture") in COLOUR_ART for s in systems):
        cols = [[1.0, 1.0, 1.0]]  # no colour anywhere = all white
    # 1. value: something must be near-white (the hot core), or additive stacks read as one flat hue
    if cols and not any(min(c) >= 0.7 for c in cols) and not any(s.get("texture") in COLOUR_ART for s in systems):
        notes.append("no hot core: no colour has all channels >= 0.7. Give the hero/core a near-white tint "
                     "(e.g. [1,0.9,1]) and keep saturated colour for the outer layers")
    # 2. hue: one hue family everywhere = flat; want 60/30/10 with an accent
    hues = [colorsys.rgb_to_hsv(*c)[0] * 360 for c in cols if colorsys.rgb_to_hsv(*c)[1] > 0.3]
    if len(hues) >= 3:
        hs = sorted(hues)
        gaps = [hs[i + 1] - hs[i] for i in range(len(hs) - 1)] + [360 - (hs[-1] - hs[0])]
        spread = 360 - max(gaps)
        if spread < 60:
            notes.append("palette is one hue family (spread %d deg): add an accent hue on ~10%% of the effect "
                         "(analogous +-40-60 deg or complementary) on sparks/trail tips" % spread)
    # 3. size: big / medium / small contrast
    sizes = [(_lo(s.get("size", 0.3)) * max(s.get("scale", [1, 1, 1])), _hi(s.get("size", 0.3)) * max(s.get("scale", [1, 1, 1])))
             for s in systems]
    if len(sizes) >= 3 and max(h for _, h in sizes) < 4 * min(lo for lo, _ in sizes):
        notes.append("weak size contrast (largest < 4x smallest): mix one big soft shape, medium bodies and tiny sparks")
    for s in systems:
        n, mp = s["name"], int(s.get("maxParticles", 10))
        # 4. uniform crowds look fake
        if mp >= 6:  # the artist's 4-particle disc uses a constant lifetime and looks fine
            fixed = [k for k in ("lifetime", "size") if isinstance(s.get(k, 0 if k == "size" else 2.0), (int, float))
                     and not (k == "size" and s.get("sizeOverLife"))]
            if fixed:
                notes.append("%s: %d particles with constant %s: use [min,max] ranges" % (n, mp, "/".join(fixed)))
        # 5. big additive quads in full-saturation colour clip to a flat blob where they overlap
        if s["blend"] == "additive" and _hi(s.get("size", 0.3)) >= 0.8:
            for c in _colours(s):
                if max(c) >= 0.95 and min(c) <= 0.1:
                    notes.append("%s: big additive layer in pure saturated colour %s: overlaps clip flat. "
                                 "Drop value (max channel ~0.6-0.8) or alpha (<= 0.5)" % (n, [round(x, 2) for x in c]))
                    break
    # 6. daylight maps: pure additive washes out on a bright background
    if systems and all(s["blend"] == "additive" for s in systems):
        notes.append("all layers additive: check `fab_preview.py --bg day`; on bright maps add contrast with "
                     "darker/more saturated mid tones or an alpha layer")
    # 7. loops in lockstep pulse visibly
    durs = {}
    for s in systems:
        if s.get("loop", True) and _hi(s.get("lifetime", 2.0)) < 60 and int(s.get("maxParticles", 10)) > 1:
            durs.setdefault(round(float(s.get("duration", 5.0)), 2), []).append(s["name"])
    for d, ns in durs.items():
        if len(ns) >= 3:
            notes.append("%s share duration %gs: loops pulse in sync; use non-multiple periods (e.g. 2.3 / 3.1 / 4.7)" % (", ".join(ns), d))
    return notes


def lint(spec, tex_dirs=(), tier=None):
    tier = tier or spec.get("tier") or DEFAULT_TIER
    if tier not in TIERS:
        raise SystemExit("unknown tier '%s' (use %s)" % (tier, ", ".join(TIERS)))
    T = TIERS[tier]
    errors, warnings, info = [], [], []
    systems = spec.get("systems") or []
    if not systems:
        errors.append("spec has no systems")
    if len(systems) > T["systems"]:
        warnings.append("%d systems > %d for tier '%s'" % (len(systems), T["systems"], tier))
    total = trails = 0
    overdraw = 0.0
    lib = set(ft.library()) | set(ft.PROCEDURAL)
    tex_used = set()
    names = set()
    for s in systems:
        n = s["name"]
        if n in names:
            errors.append("%s: duplicate system name" % n)
        names.add(n)
        mp = int(s.get("maxParticles", 10))
        total += mp
        if mp < 1:
            errors.append("%s: maxParticles must be >= 1" % n)
        if mp > T["per_system"]:
            warnings.append("%s: maxParticles %d > %d for tier '%s'" % (n, mp, T["per_system"], tier))
        if s["blend"] not in BLENDS:
            errors.append("%s: blend must be one of %s" % (n, ", ".join(BLENDS)))
        sh = s.get("shape", "none")
        st = sh if isinstance(sh, str) else sh.get("type", "none")
        if st != "none" and st not in core.SHAPES:
            errors.append("%s: unknown shape '%s' (use %s)" % (n, st, ", ".join(core.SHAPES)))
        elif st != "none" and st not in core.SHAPES_VERIFIED:
            warnings.append("%s: shape '%s' is not used in the sample (sphere/cone/circle are verified)" % (n, st))
        rm = s.get("render", {}).get("mode", "billboard")
        if rm not in core.RENDER_MODES:
            errors.append("%s: render.mode must be one of %s" % (n, ", ".join(core.RENDER_MODES)))
        elif rm not in core.RENDER_VERIFIED:
            warnings.append("%s: render mode '%s' is not used in the sample (billboard/horizontal are verified)" % (n, rm))
        if s.get("bursts"):
            warnings.append("%s: bursts are not used in the sample (layout copied from the Unity 2018 serializer, untested in-engine)" % n)
        if s.get("space") == "world":
            warnings.append("%s: world simulation space is not used in the sample" % n)
        if s.get("gravity"):
            warnings.append("%s: gravity is not used in the sample" % n)
        tx = s.get("texture", "glow")
        tex_used.add(tx if isinstance(tx, str) else repr(tx))
        try:
            origin, kind = ft.resolve_kind(tx, tex_dirs)
        except Exception as e:  # noqa: BLE001
            errors.append("%s: bad texture (%s)" % (n, e))
            origin, kind = None, None
        if origin == "generated":
            info.append("%s: texture %s is not in the library: it will be auto-generated as '%s'" % (n, tx if isinstance(tx, str) else "(gen)", kind))
        fb = s.get("flipbook")
        if fb and (len(fb.get("tiles", [])) != 2 or min(fb["tiles"]) < 1):
            errors.append("%s: flipbook.tiles must be [x, y]" % n)
        if s.get("trail") is not None and s.get("trail") is not False:
            trails += 1
            tex_used.add(s["trail"].get("texture", "trail") if isinstance(s["trail"], dict) else "trail")
        lt = _hi(s.get("lifetime", 2.0))
        rate = _hi(s.get("rate", 0.0))
        if not s.get("loop", True) and s.get("prewarm"):
            warnings.append("%s: prewarm only works on looping systems (ignored)" % n)
        if s.get("loop", True) and lt <= 60 and rate * lt < 0.9 * mp and not s.get("bursts"):
            info.append("%s: rate*lifetime = %.1f < maxParticles %d (the cap is never reached)" % (n, rate * lt, mp))
        if rate * lt > 2.0 * mp and lt <= 60 and rate > 0:
            info.append("%s: rate*lifetime = %.1f >> maxParticles %d (emission is clipped by the cap)" % (n, rate * lt, mp))
        if s.get("fade", [0.2, 0.3]) is None and not s.get("colorOverLife") and s.get("loop", True) and lt < 60:
            warnings.append("%s: no alpha fade on a looping system (particles will pop in/out)" % n)
        sc = s.get("scale", [1, 1, 1])
        overdraw += mp * (_hi(s.get("size", 0.3)) * max(sc)) ** 2
    if total > T["total"]:
        warnings.append("total maxParticles %d > %d for tier '%s' (cut the smallest layers first, keep the hero)" % (total, T["total"], tier))
    if len(tex_used) > T["textures"]:
        warnings.append("%d distinct textures > %d for tier '%s' (reuse textures, tint them)" % (len(tex_used), T["textures"], tier))
    if trails > T["trails"]:
        warnings.append("%d trail systems > %d for tier '%s'" % (trails, T["trails"], tier))
    if overdraw > T["overdraw"]:
        warnings.append("overdraw estimate %.0f > %.0f for tier '%s' (big quads overlap: shrink size or cut particles)" % (overdraw, T["overdraw"], tier))
    lines = ["[lint] tier '%s': %d systems, %d/%d max particles, %d/%d textures, overdraw estimate %.0f/%.0f" % (
        tier, len(systems), total, T["total"], len(tex_used), T["textures"], overdraw, T["overdraw"])]
    art = art_review(systems) if not errors else []
    lines += ["  ERROR   " + e for e in errors] + ["  WARNING " + w for w in warnings] + ["  note    " + i for i in info]
    lines += ["  art     " + a for a in art]
    if not errors and not warnings:
        lines.append("  OK - inside the '%s' budget" % tier)
    return {"errors": errors, "warnings": warnings, "info": info, "art": art, "lines": lines,
            "tier": tier, "metrics": {"systems": len(systems), "particles": total, "trails": trails, "overdraw": round(overdraw, 1)}}


if __name__ == "__main__":
    import argparse
    import json
    import sys
    ap = argparse.ArgumentParser(description="Lint an effect spec against the artist sample's budget.")
    ap.add_argument("spec")
    ap.add_argument("--tex-dir", action="append", default=[])
    ap.add_argument("--tier", choices=list(TIERS), help="device budget, default: spec 'tier' or 'low'")
    a = ap.parse_args()
    import fab_build
    rep = lint(fab_build.normalize(json.load(open(a.spec, encoding="utf8"))), a.tex_dir, a.tier)
    print("\n".join(rep["lines"]))
    sys.exit(1 if rep["errors"] else 0)
