#!/usr/bin/env python
"""Rough software preview of a spec (or a .fab) so an agent can LOOK at an effect without Unity or the game.

    python fab_preview.py spec.json [-o preview.gif] [--sheet sheet.png] [--seconds 4] [--size 480]
    python fab_preview.py effect.fab -o preview.gif            (reads the .fab back into a spec first)

It approximates Unity's particle system: emission with the max-particles cap, shapes, start values, orbital and linear
velocity, size/rotation/colour over lifetime, flipbooks, trails (as soft ribbons), additive vs alpha blending, billboard vs
horizontal quads, and a fixed camera. It is NOT the game renderer: use it to judge layout, timing, colour and density,
then confirm in Craftland Studio.
"""
import argparse
import json
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import fab_build  # noqa: E402
import fab_core as core  # noqa: E402
import fab_textures as ft  # noqa: E402


def _rot_matrix(eul):
    qx, qy, qz, qw = core.euler_to_quat(*eul)
    return np.array([
        [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
        [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
        [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)]], np.float32)


def _val(v, rng):
    if isinstance(v, (int, float)):
        return float(v)
    if len(v) == 2 and all(isinstance(x, (int, float)) for x in v):
        return rng.uniform(v[0], v[1])
    return float(v[0][1])


def _curve(v, t, default=1.0):
    if v is None:
        return default
    if isinstance(v, (int, float)):
        return float(v)
    pts = v if isinstance(v[0], list) else None
    if pts is None:
        return float(v[0])
    t = min(max(t, 0.0), 1.0)
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * (t - t0) / max(1e-6, t1 - t0)
    return pts[-1][1]


def _grad(keys, t):
    """Shared keys [[t,r,g,b,a]] or {"color":[[t,r,g,b]], "alpha":[[t,a]]} -> rgba."""
    if isinstance(keys, dict):
        ck, ak = keys["color"], keys["alpha"]
    else:
        ck = [[k[0]] + k[1:4] for k in keys]
        ak = [[k[0], k[4]] for k in keys]

    def lerp(lst, t, n):
        t = min(max(t, 0.0), 1.0)
        if t <= lst[0][0]:
            return lst[0][1:1 + n]
        for a, b in zip(lst, lst[1:]):
            if t <= b[0]:
                f = (t - a[0]) / max(1e-6, b[0] - a[0])
                return [a[1 + i] + (b[1 + i] - a[1 + i]) * f for i in range(n)]
        return lst[-1][1:1 + n]
    return lerp(ck, t, 3) + lerp(ak, t, 1)


def _start_color(c, rng):
    if isinstance(c, dict) and "gradient" in c:
        return _grad(c["gradient"], rng.random() if c.get("random") else 0.0)
    if isinstance(c, dict) and "between" in c:
        a, b = c["between"]
        f = rng.random()
        return [a[i] + (b[i] - a[i]) * f for i in range(4)]
    return list(c) + [1.0] * (4 - len(c))


class Sys:
    def __init__(self, s, tex_dirs):
        self.s = s
        self.rng = random.Random(hash(s["name"]) & 0xFFFF)
        self.P = []
        self.acc = 0.0
        self.fired = set()
        img, _, _ = ft.load_texture(s["texture"], tex_dirs)
        img, _ = ft.to_pot(img)
        self.tex = img
        self.fb = s.get("flipbook")
        self.R = _rot_matrix(s.get("rotationEuler", s.get("tilt", [0, 0, 0])))
        self.pos = np.array(s.get("position", [0, 0, 0]), np.float32)
        self.scale = np.array(s.get("scale", [1, 1, 1]), np.float32)
        sh = s.get("shape", "none")
        self.sh = {"type": sh} if isinstance(sh, str) else dict(sh)
        self.SR = _rot_matrix(self.sh.get("rotation", [0, 0, 0]))
        self.SS = np.array(self.sh.get("scale", [1, 1, 1]), np.float32)
        self.cache = {}

    def _emit(self, t):
        s, rng = self.s, self.rng
        if len(self.P) >= int(s.get("maxParticles", 10)):
            return
        sh = self.sh
        typ = sh.get("type", "none")
        r = float(sh.get("radius", s.get("radius", 1.0)))
        th = float(sh.get("thickness", 1.0))
        d = np.array([0, 0, 1], np.float32)
        p = np.zeros(3, np.float32)
        if typ in ("sphere", "hemisphere"):
            v = np.array([rng.gauss(0, 1) for _ in range(3)], np.float32)
            v /= max(1e-6, np.linalg.norm(v))
            if typ == "hemisphere":
                v[2] = abs(v[2])
            p, d = v * r * (1 - th * rng.random()), v
        elif typ == "circle":
            a = math.radians(float(sh.get("arc", 360))) * rng.random()
            rr = r * (1 - th * rng.random())
            d = np.array([math.cos(a), math.sin(a), 0], np.float32)
            p = d * rr
        elif typ == "cone":
            a = rng.random() * math.tau
            rr = r * math.sqrt(rng.random())
            p = np.array([math.cos(a) * rr, math.sin(a) * rr, 0], np.float32)
            ang = math.radians(float(sh.get("angle", 25))) * (rr / max(r, 1e-6))
            d = np.array([math.cos(a) * math.sin(ang), math.sin(a) * math.sin(ang), math.cos(ang)], np.float32)
        elif typ == "box":
            p = np.array([rng.uniform(-.5, .5) for _ in range(3)], np.float32)
        elif typ == "edge":
            p = np.array([rng.uniform(-r, r), 0, 0], np.float32)
        p = (self.SR @ (p * self.SS)) + np.array(sh.get("position", [0, 0, 0]), np.float32)
        d = self.SR @ d
        life = max(0.05, _val(s.get("lifetime", 2.0), rng))
        spd = _val(s.get("speed", 0.0), rng)
        rot = math.radians(_val(s.get("rotation", 0.0), rng))
        rov = s.get("rotationOverLife", 0)
        self.P.append({"p": p, "v": d * spd, "age": 0.0, "life": life, "size": _val(s.get("size", 0.3), rng),
                       "rot": rot, "rov": math.radians(_val(rov, rng)) if rov else 0.0,
                       "col": _start_color(s.get("color", [1, 1, 1, 1]), rng), "row": rng.randrange(max(1, self.fb["tiles"][1])) if self.fb else 0,
                       "hist": []})

    def step(self, t, dt):
        s = self.s
        loop = s.get("loop", True)
        dur = float(s.get("duration", 5.0))
        local_t = t % dur if loop else t
        if loop or t <= dur:
            self.acc += _val(s.get("rate", 0.0), self.rng) * dt
            while self.acc >= 1.0:
                self.acc -= 1.0
                self._emit(t)
            for i, b in enumerate(s.get("bursts") or []):
                key = (i, int(t // dur) if loop else 0)
                if local_t >= b[0] and key not in self.fired:
                    self.fired.add(key)
                    lo = b[1]
                    hi = b[2] if len(b) > 2 else lo
                    for _ in range(self.rng.randint(int(lo), int(hi))):
                        self._emit(t)
        orbit = s.get("orbit")
        vel = s.get("velocity")
        keep = []
        for q in self.P:
            q["age"] += dt
            if q["age"] >= q["life"]:
                continue
            if orbit:
                w = np.array(orbit, np.float32)
                ang = float(np.linalg.norm(w)) * dt
                if ang > 1e-6:
                    ax = w / np.linalg.norm(w)
                    pp = q["p"]
                    q["p"] = pp * math.cos(ang) + np.cross(ax, pp) * math.sin(ang) + ax * float(ax @ pp) * (1 - math.cos(ang))
            if vel:
                q["p"] = q["p"] + np.array(vel, np.float32) * dt
            q["p"] = q["p"] + q["v"] * dt
            q["rot"] += q["rov"] * dt
            keep.append(q)
        self.P = keep

    # -- rendering helpers
    def sprite(self, frame, px, rot_deg):
        key = (frame, px, int(rot_deg) // 6)
        if key in self.cache:
            return self.cache[key]
        img = self.tex
        if self.fb:
            tx, ty = self.fb["tiles"]
            w, h = img.size
            fx, fy = frame % tx, frame // tx
            img = img.crop((fx * w // tx, fy * h // ty, (fx + 1) * w // tx, (fy + 1) * h // ty))
        img = img.resize((px, px), Image.BILINEAR)
        if rot_deg:
            img = img.rotate(rot_deg, resample=Image.BILINEAR, expand=False)
        arr = np.asarray(img, np.float32) / 255.0
        self.cache[key] = arr
        return arr


# (top, bottom) colours. "day" approximates a daylight map (sky over sandy ground): additive washes out there.
BACKGROUNDS = {"dark": ([0.03, 0.035, 0.07], [0.01, 0.01, 0.02]), "day": ([0.62, 0.72, 0.84], [0.46, 0.43, 0.36])}


def render(systems, size, cam, t, bg="dark"):
    W = H = size
    canvas = np.zeros((H, W, 3), np.float32)
    yy = np.linspace(0, 1, H)[:, None, None]
    top, bottom = BACKGROUNDS[bg]
    canvas += np.array(top) * (1 - yy) + np.array(bottom) * yy
    eye, target = cam
    fwd = (target - eye)
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, np.array([0, 1, 0], np.float32))
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    focal = 0.5 * H / math.tan(math.radians(40) / 2)
    pitch = abs(fwd[1])

    quads = []
    for si, sy in enumerate(systems):
        s = sy.s
        horizontal = s.get("render", {}).get("mode") == "horizontal"
        for q in sy.P:
            tt = q["age"] / q["life"]
            world = sy.pos + sy.R @ (q["p"] * sy.scale)
            rel = world - eye
            depth = float(rel @ fwd)
            if depth < 0.1:
                continue
            q["_w"] = world
            quads.append((depth, si, q, world, horizontal, tt))
        # trails: keep a short history of world positions
        if s.get("trail"):
            tl = s["trail"] if isinstance(s["trail"], dict) else {}
            keep = max(2, int(float(tl.get("lifetime", 0.1)) * 30) + 1)
            for q in sy.P:
                q["hist"].append(sy.pos + sy.R @ (q["p"] * sy.scale))
                q["hist"] = q["hist"][-keep:]
    quads.sort(key=lambda x: -x[0])

    def proj(w):
        rel = w - eye
        d = float(rel @ fwd)
        return np.array([W / 2 + focal * float(rel @ right) / d, H / 2 - focal * float(rel @ up) / d]), d

    for depth, si, q, world, horizontal, tt in quads:
        sy = systems[si]
        s = sy.s
        add = s.get("blend", "additive") == "additive"
        # colour over lifetime (default fade)
        col = list(q["col"])
        cl = s.get("colorOverLife")
        if cl is None and s.get("fade", [0.2, 0.3]):
            fi, fo = s.get("fade", [0.2, 0.3])
            a = min(1.0, tt / fi) if fi > 0 else 1.0
            a = min(a, (1 - tt) / fo) if fo > 0 else a
            col[3] *= max(0.0, a)
        elif cl:
            g = _grad(cl, tt)
            col = [col[0] * g[0], col[1] * g[1], col[2] * g[2], col[3] * g[3]]
        tint = s.get("tint", [1, 1, 1, 1])
        sz = q["size"] * _curve(s.get("sizeOverLife"), tt, 1.0) * float(max(sy.scale))
        # trail ribbon
        if s.get("trail") and len(q["hist"]) > 1:
            tl = s["trail"] if isinstance(s["trail"], dict) else {}
            pts = [proj(h)[0] for h in q["hist"]]
            layer = Image.new("L", (W, H), 0)
            dr = ImageDraw.Draw(layer)
            for k in range(len(pts) - 1):
                f = (k + 1) / len(pts)
                wpx = max(1, int(sz * float(tl.get("widthScale", 1.0)) * focal / depth * _curve(tl.get("width", [[0, 1], [1, 0.2]]), 1 - f) * 0.9))
                dr.line([tuple(pts[k]), tuple(pts[k + 1])], fill=int(255 * f * col[3]), width=wpx)
            m = np.asarray(layer.filter(ImageFilter.GaussianBlur(1.2)), np.float32)[..., None] / 255.0
            canvas += m * np.array(col[:3]) * 1.0
        px = int(max(2, min(sz * focal / depth, W * 0.9)))
        frame = 0
        if sy.fb:
            tx, ty = sy.fb["tiles"]
            n = tx * ty
            frame = int(((tt * float(sy.fb.get("cycles", 1.0))) % 1.0) * n) % n
        rot_deg = -math.degrees(q["rot"])
        spr = sy.sprite(frame, px, rot_deg)
        sx, sy_ = proj(world)[0]
        h_px = px
        if horizontal:
            h_px = max(2, int(px * (0.15 + 0.5 * pitch)))
            spr = np.asarray(Image.fromarray((spr * 255).astype(np.uint8)).resize((px, h_px), Image.BILINEAR), np.float32) / 255.0
        x0, y0 = int(sx - px / 2), int(sy_ - h_px / 2)
        xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + px), min(H, y0 + h_px)
        if xa >= xb or ya >= yb:
            continue
        sp = spr[ya - y0: yb - y0, xa - x0: xb - x0]
        a = sp[..., 3:4] * col[3] * tint[3 if len(tint) > 3 else 0]
        rgb = sp[..., :3] * np.array(col[:3]) * np.array(tint[:3])
        if add:
            canvas[ya:yb, xa:xb] += rgb * a
        else:
            canvas[ya:yb, xa:xb] = canvas[ya:yb, xa:xb] * (1 - a) + rgb * a
    return Image.fromarray((np.clip(canvas, 0, 1) ** (1 / 1.1) * 255).astype(np.uint8))


def preview(spec, out_gif, sheet=None, seconds=4.0, size=480, tex_dirs=(), bg="dark"):
    spec = fab_build.normalize(spec)
    systems = [Sys(s, tex_dirs) for s in spec["systems"]]
    dt = 1 / 30
    warm = max(float(s.get("duration", 5.0)) for s in spec["systems"] if s.get("prewarm")) if any(s.get("prewarm") for s in spec["systems"]) else 0.0
    cam = (np.array([0, 1.5, 4.6], np.float32), np.array([0, 1.0, 0], np.float32))
    frames, n = [], int(seconds * 30)
    for i in range(int(warm / dt)):
        for sy in systems:
            if sy.s.get("prewarm"):
                sy.step(-warm + i * dt, dt)
    t = 0.0
    for i in range(n):
        for sy in systems:
            sy.step(t, dt)
        t += dt
        if i % 3 == 0:
            frames.append(render(systems, size, cam, t, bg))
    frames[0].save(out_gif, save_all=True, append_images=frames[1:], duration=100, loop=0, disposal=2)
    if sheet:
        k = 6
        idx = [int(j * (len(frames) - 1) / (k - 1)) for j in range(k)]
        sm = size // 2
        sh = Image.new("RGB", (sm * 3, sm * 2))
        for j, ii in enumerate(idx):
            sh.paste(frames[ii].resize((sm, sm), Image.LANCZOS), ((j % 3) * sm, (j // 3) * sm))
        sh.save(sheet)
    return out_gif


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", help="spec .json or .fab")
    ap.add_argument("-o", "--out", default="preview.gif")
    ap.add_argument("--sheet", help="also write a 6-frame contact sheet PNG")
    ap.add_argument("--seconds", type=float, default=4.0)
    ap.add_argument("--size", type=int, default=480)
    ap.add_argument("--tex-dir", action="append", default=[])
    ap.add_argument("--bg", choices=list(BACKGROUNDS), default="dark", help="dark = night/sky test, day = bright map")
    a = ap.parse_args()
    if a.src.lower().endswith(".fab"):
        import fab_inspect
        tmp = os.path.splitext(a.out)[0] + "_tex"
        spec = fab_inspect.extract_spec(a.src, tmp)
        a.tex_dir.append(tmp)
    else:
        spec = json.load(open(a.src, encoding="utf8"))
    print("preview:", preview(spec, a.out, a.sheet, a.seconds, a.size, a.tex_dir, a.bg))


if __name__ == "__main__":
    main()
