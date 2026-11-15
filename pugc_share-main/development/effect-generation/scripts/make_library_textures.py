#!/usr/bin/env python
"""Fill assets/textures/ with the 256 px procedural VFX library, then write a labelled contact sheet.

    python scripts/make_library_textures.py [--sheet fx/out/texture_library_sheet.png]

numpy + Pillow only, fixed seeds: every run writes the same bytes. Masks are white RGB + soft alpha that is 0 in
the outer 4 px (PVRTC wraps). noise_perlin_tile is the one exception: it is seamless, so it reaches the border.
The 8 artist PNGs already in the folder are never touched.
"""
import argparse
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fab_textures import LIB_DIR, _fbm, _gen, _grid, _window  # noqa: E402

N = 256          # library size
F = 64           # flipbook frame size (4x4 sheet of 256)
SS = 4           # supersampling for drawn shapes
ARTIST = {"cloud", "glow", "saturn", "sparkle", "nebuladisc", "sun_4x4", "earth_8x8", "trail"}
TILED = {"noise_perlin_tile"}                   # seamless: no border fade
COLOUR = {"coin", "gem", "heart_pickup"}        # painted colour, blend alpha


# ------------------------------------------------------------------ small helpers

def ss(v, e0, e1):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def polar(n=N):
    x, y = _grid(n)
    return x, y, np.hypot(x, y), np.arctan2(y, x)


def line(d, w):
    return np.clip(1 - d / w, 0, 1)


def blur(a, radius):
    """Separable Gaussian in numpy (Pillow's GaussianBlur has no float mode)."""
    h = int(math.ceil(3 * radius))
    k = np.exp(-0.5 * (np.arange(-h, h + 1) / radius) ** 2)
    k /= k.sum()
    a = np.apply_along_axis(np.convolve, 0, np.clip(a, 0, 1), k, "same")
    return np.apply_along_axis(np.convolve, 1, a, k, "same").astype(np.float32)


def glowed(core, radius, k):
    return np.maximum(core, k * blur(core, radius))


def rotate(a, deg):
    return np.asarray(Image.fromarray(a.astype(np.float32), "F").rotate(deg, Image.BICUBIC), np.float32)


def fade_border(a, px=4, ramp=8):
    """0 in the outer px pixels, smooth ramp to 1 over the next `ramp` pixels."""
    def w(n):
        d = np.minimum(np.arange(n), np.arange(n)[::-1])
        return ss(d.astype(np.float32), px - 1, px - 1 + ramp)
    return a * np.outer(w(a.shape[0]), w(a.shape[1]))


def tile_noise(n, seed, octaves=4, base=4):
    """Seamless value noise 0..1: _fbm's random grids, but wrapped, so it tiles and scrolls in a perfect loop."""
    rng = np.random.RandomState(seed)
    out, amp, tot = np.zeros((n, n), np.float32), 1.0, 0.0
    for o in range(octaves):
        g = base * 2 ** o
        big = np.tile(rng.rand(g, g).astype(np.float32), (3, 3))
        img = np.asarray(Image.fromarray(big, "F").resize((3 * n, 3 * n), Image.BICUBIC), np.float32)
        out += amp * img[n:2 * n, n:2 * n]      # middle copy: shifting by one period lands on identical samples
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / max(1e-6, out.max() - out.min())


def sheet(frames):
    """16 frames (F x F) -> 4x4 sheet, left to right, top to bottom; each frame fades inside its own cell."""
    fr = [fade_border(f, 4, 6) for f in frames]
    return np.block([fr[r * 4:r * 4 + 4] for r in range(4)])


class Pen:
    """Supersampled grey canvas in the -1..1 coordinates of _grid (y down). Widths are in final pixels."""

    def __init__(self, n=N, mode="L", bg=0):
        self.n, self.img = n, Image.new(mode, (n * SS, n * SS), bg)
        self.d = ImageDraw.Draw(self.img)

    def p(self, x, y):
        return ((x + 1) / 2 * self.n * SS, (y + 1) / 2 * self.n * SS)

    def line(self, pts, w, v=255):
        self.d.line([self.p(*q) for q in pts], fill=v, width=max(1, int(round(w * SS))), joint="curve")

    def poly(self, pts, v=255, outline=None, w=1):
        self.d.polygon([self.p(*q) for q in pts], fill=v, outline=outline, width=max(1, int(round(w * SS))))

    def ellipse(self, cx, cy, rx, ry, v=255, outline=None, w=1):
        self.d.ellipse([self.p(cx - rx, cy - ry), self.p(cx + rx, cy + ry)], fill=v, outline=outline,
                       width=max(1, int(round(w * SS))))

    def get(self):
        img = self.img.resize((self.n, self.n), Image.LANCZOS)
        a = np.asarray(img, np.float32) / 255
        return a


def bolt(rng, pts, depth, rough):
    """Midpoint displacement of a polyline: each pass splits every segment and pushes the midpoint sideways."""
    pts = [np.asarray(p, float) for p in pts]
    for _ in range(depth):
        out = [pts[0]]
        for p, q in zip(pts, pts[1:]):
            d = q - p
            out += [(p + q) / 2 + np.array([-d[1], d[0]]) * rng.uniform(-rough, rough), q]
        pts = out
    return pts


def ray_sum(r, th, rays):
    """Thin tapered rays (angle, length, half-width, gain) from the centre."""
    out = np.zeros_like(r)
    for ang, length, w, gain in rays:
        along, perp = r * np.cos(th - ang), np.abs(r * np.sin(th - ang))
        taper = np.clip(1 - along / length, 0, 1) * (along > 0)
        out += gain * np.exp(-(perp / (w * taper + 1e-3)) ** 2) * taper ** 0.6
    return out


def box(x, y, w, h):
    dx, dy = np.abs(x) - w, np.abs(y) - h
    return np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) + np.minimum(np.maximum(dx, dy), 0)


# ------------------------------------------------------------------ core

def glow_soft():
    return _gen("soft", N, 0)


def glow_hard():
    r = polar()[2]
    return np.maximum(ss(r, 0.42, 0.16), 0.45 * np.clip(1 - r, 0, 1) ** 3)


def dot():
    return _gen("dot", N, 0)


def ring_thin():
    return np.exp(-((polar()[2] - 0.76) / 0.03) ** 2)


def ring_thick():
    return np.exp(-((polar()[2] - 0.62) / 0.15) ** 4)


def disc_soft():
    return ss(polar()[2], 0.86, 0.55)


def gradient_radial():
    return np.clip(1 - polar()[2] / 0.94, 0, 1)


def gradient_linear():
    x = _grid(N)[0]
    return (x + 1) / 2                   # 0 left -> 1 right; fade_border trims the outer rim


# ------------------------------------------------------------------ light / magic

def sparkle4():
    return _gen("star4", N, 0)


def star6():
    return _gen("star6", N, 0)


def flare_rays():
    x, y, r, th = polar()
    rng = np.random.RandomState(11)
    rays = [(rng.uniform(0, 2 * math.pi), rng.uniform(0.35, 0.9), rng.uniform(0.008, 0.02), rng.uniform(0.4, 1))
            for _ in range(26)]
    return np.clip(ray_sum(r, th, rays) + np.exp(-r * 7) + 0.25 * _gen("rays", N, 0), 0, 1)


def lens_ring():
    x, y, r, th = polar()
    return (0.85 * np.exp(-((r - 0.7) / 0.035) ** 2) + 0.3 * np.exp(-((r - 0.58) / 0.12) ** 2)) * (0.82 + 0.18 * np.cos(5 * th))


def magic_circle():
    pen, rng = Pen(), np.random.RandomState(5)
    for rad, w in ((0.9, 2.4), (0.76, 1.6), (0.46, 1.6), (0.4, 1.0)):
        pen.ellipse(0, 0, rad, rad, v=None, outline=255, w=w)
    v = [(0.74 * math.cos(-math.pi / 2 + k * math.pi / 3), 0.74 * math.sin(-math.pi / 2 + k * math.pi / 3)) for k in range(6)]
    for tri in (v[0::2], v[1::2]):                                   # hexagram
        pen.line(tri + tri[:1], 1.6)
    cells, rmid = 28, 0.83
    for c in range(cells):                                           # rune band: 3 strokes on a 3x3 grid per cell
        a0 = 2 * math.pi * (c + 0.5) / cells
        for _ in range(3):
            (u0, v0), (u1, v1) = rng.randint(-1, 2, (2, 2))
            if (u0, v0) == (u1, v1):
                continue
            pts = [((rmid + vv * 0.035) * math.cos(a0 + uu * 0.045), (rmid + vv * 0.035) * math.sin(a0 + uu * 0.045))
                   for uu, vv in ((u0, v0), (u1, v1))]
            pen.line(pts, 1.4)
    for k in range(6):                                               # small node circles on the hexagram tips
        pen.ellipse(v[k][0], v[k][1], 0.035, 0.035, v=None, outline=255, w=1.2)
    return glowed(pen.get(), 3, 0.5)


def hex_shield():
    x, y, r, th = polar()
    big = np.maximum(np.abs(x), 0.5 * np.abs(x) + 0.866 * np.abs(y))          # pointy-top hexagon "radius"
    px, py = x * 5, y * 5                                                     # cell lattice
    s = np.array([1.0, 1.732])
    a = np.stack([np.mod(px, s[0]) - 0.5, np.mod(py, s[1]) - 0.866])
    b = np.stack([np.mod(px - 0.5, s[0]) - 0.5, np.mod(py - 0.866, s[1]) - 0.866])
    g = np.where((a ** 2).sum(0) < (b ** 2).sum(0), a, b)
    cell = np.maximum(np.abs(g[0]), 0.5 * np.abs(g[0]) + 0.866 * np.abs(g[1]))
    inside = ss(big, 0.83, 0.8)
    return inside * (0.12 + 0.3 * big ** 3 + 0.5 * line(0.5 - cell, 0.07)) + line(np.abs(big - 0.815), 0.025) \
        + 0.35 * np.exp(-((big - 0.815) / 0.06) ** 2)


def heal_cross():
    x, y, r, th = polar()
    d = np.minimum(box(x, y, 0.2, 0.62), box(x, y, 0.62, 0.2)) - 0.06
    return ss(d, 0.012, -0.012) * (0.8 + 0.2 * ss(-d, 0, 0.12)) + 0.45 * np.exp(-np.maximum(d, 0) * 10) * (d > 0)


# ------------------------------------------------------------------ fire / smoke

def flame():
    return _gen("flame", N, 0)


def fire_flipbook_4x4():
    x, y = _grid(F)
    yy = (y + 1) / 2
    n1, n2 = tile_noise(F, 21, 4, 3), tile_noise(F, 22, 3, 4)
    frames = []
    for k in range(16):                     # noise scrolls up 4 px/frame = one full period in 16 frames
        a1, a2 = np.roll(n1, -4 * k, 0), np.roll(n2, -8 * k, 0)
        xx = x + (a2 - 0.5) * 0.4 * (1 - yy)
        yb = y - 0.25
        env = 1 - np.hypot(xx / 0.62, yb / np.where(yb < 0, 1.25, 0.55))
        frames.append(np.clip(env * 1.8 - (0.2 + 0.45 * (1 - yy)) * (1 - a1), 0, 1))
    return sheet(frames)


def smoke_puff():
    x, y, r, th = polar()
    f, f2 = _fbm(N, 31, 5, 3), _fbm(N, 32, 4, 6)
    edge = 0.6 + 0.25 * (f - 0.5)
    return ss(r, edge + 0.12, edge - 0.22) * (0.5 + 0.5 * f2) * _window(r)


def smoke_flipbook_4x4():
    x, y = _grid(F)
    r, th = np.hypot(x, y), np.arctan2(y, x)
    nz = tile_noise(F, 41, 4, 2)
    frames = []
    for k in range(16):                     # every term is periodic in k: frame 16 == frame 0
        ph = 2 * math.pi * k / 16
        rad = 0.62 + 0.07 * np.sin(3 * th + ph) + 0.05 * np.sin(5 * th - 2 * ph) + 0.03 * np.sin(7 * th + 3 * ph)
        frames.append(ss(r, rad + 0.12, rad - 0.25) * (0.4 + 0.6 * np.roll(nz, -4 * k, 0)))
    return sheet(frames)


def explosion_flipbook_4x4():
    x, y = _grid(F)
    r = np.hypot(x, y)
    nz = tile_noise(F, 51, 4, 4)
    frames = []
    for k in range(16):                     # small kernel -> fireball -> ring -> ~0 at frame 15, so it can repeat
        t = k / 16
        rad = 0.25 + 0.62 * (1 - (1 - t) ** 2.5)
        n = np.roll(nz, -2 * k, 0)
        shape = ss(r, rad * (1.05 + 0.5 * (n - 0.5)), rad * 0.5)
        hollow = 1 - 0.8 * t * ss(r, rad * 0.7, rad * 0.15)
        env = (0.3 + 0.7 * ss(t, 0, 0.15)) * (1 - t) ** 1.3
        frames.append(np.clip(shape * hollow * 1.5 - t * 1.1 * (1 - n), 0, 1) * env)
    return sheet(frames)


def ember():
    x, y = _grid(N)
    return np.exp(-((x / 0.09) ** 2 + (y / 0.22) ** 2)) + 0.35 * np.exp(-((x / 0.3) ** 2 + (y / 0.5) ** 2))


# ------------------------------------------------------------------ energy

def lightning_bolt():
    rng, pen = np.random.RandomState(7), Pen()
    main = bolt(rng, [(0, -0.86), (0.04, 0.86)], 7, 0.22)
    pen.line(main, 3.0)
    for i in rng.choice(np.arange(20, len(main) - 30), 3, replace=False):
        p = main[i]
        ang = math.pi / 2 + rng.choice([-1, 1]) * rng.uniform(0.35, 0.8)
        q = p + rng.uniform(0.28, 0.45) * np.array([math.cos(ang), math.sin(ang)])
        pen.line(bolt(rng, [p, np.clip(q, -0.85, 0.85)], 5, 0.25), 1.6)
    core = pen.get()
    return np.maximum(glowed(core, 5, 0.6), 0.3 * blur(core, 14))


def electric_arc():
    rng, pen = np.random.RandomState(8), Pen()
    base = [(x, 0.15 - 0.4 * (1 - (x / 0.82) ** 2)) for x in np.linspace(-0.82, 0.82, 5)]
    for w in (2.6, 1.5, 1.0):
        pen.line(bolt(rng, base, 5, 0.3), w)
    for ex in (-0.82, 0.82):
        pen.ellipse(ex, 0.15, 0.05, 0.05)
    core = pen.get()
    return np.maximum(glowed(core, 4, 0.6), 0.3 * blur(core, 12))


def beam_core():
    x, y = _grid(N)
    return (np.exp(-(y / 0.07) ** 2) + 0.45 * np.exp(-(y / 0.3) ** 2)) * ss(np.abs(x), 0.95, 0.6)


def shockwave():
    r = polar()[2]
    ring = np.where(r < 0.8, 0.85 * (r / 0.8) ** 5, np.exp(-((r - 0.8) / 0.025) ** 2))
    return ring * (0.85 + 0.15 * _fbm(N, 63, 4, 6))


def swirl_vortex():
    r = polar()[2]
    return _gen("swirl", N, 0) + 0.6 * np.exp(-(r / 0.14) ** 2)


def portal():
    x, y, r, th = polar()
    f = _fbm(N, 61, 5, 4)
    spiral = (0.5 + 0.5 * np.sin(5 * th + 14 * r + 4 * f)) ** 3
    return np.exp(-((r - 0.78) / 0.04) ** 2) + 0.7 * spiral * np.clip(r / 0.78, 0, 1) ** 1.5 * ss(r, 0.86, 0.74) \
        + 0.15 * ss(r, 0.8, 0.7) + 0.3 * np.exp(-((r - 0.78) / 0.12) ** 2)


# ------------------------------------------------------------------ melee / impact

def slash_arc():
    x, y, r, th = polar()
    th0, th1 = math.radians(-160), math.radians(10)     # top-left round to right; bright leading end on the right
    s = (th - th0) / (th1 - th0)
    w = 0.22 * np.sin(np.pi * np.clip(s, 0, 1)) ** 0.7
    u = (0.8 - r) / np.maximum(w, 1e-3)
    on = (s > 0) & (s < 1)
    return np.where(on, np.clip(1 - u, 0, 1) ** 1.8 * ss(u, -0.06, 0.02), 0) * (0.3 + 0.7 * np.clip(s, 0, 1))


def hit_burst():
    x, y, r, th = polar()
    rng = np.random.RandomState(71)
    rays = [(2 * math.pi * i / 14 + rng.uniform(-0.15, 0.15), rng.uniform(0.45, 0.88), rng.uniform(0.03, 0.06), 1)
            for i in range(14)]
    return np.clip(ray_sum(r, th, rays) + 0.9 * np.exp(-(r / 0.16) ** 2) + 0.5 * np.exp(-((r - 0.35) / 0.04) ** 2), 0, 1)


def impact_star():
    rng, pen = np.random.RandomState(73), Pen()
    def star(scale):
        return [((0.85 + rng.uniform(-0.08, 0.04) if k % 2 == 0 else 0.34) * scale * math.cos(k * math.pi / 8 - math.pi / 2),
                 (0.85 + rng.uniform(-0.08, 0.04) if k % 2 == 0 else 0.34) * scale * math.sin(k * math.pi / 8 - math.pi / 2))
                for k in range(16)]
    pen.poly(star(1.0), 150)
    pen.poly(star(0.55), 255)
    return glowed(pen.get(), 4, 0.5)


def crack_ground():
    rng, pen = np.random.RandomState(81), Pen()

    def walk(p, ang, length, width, depth):
        pts, steps = [np.asarray(p, float)], 10
        for _ in range(steps):
            ang += rng.uniform(-0.45, 0.45)
            pts.append(pts[-1] + length / steps * np.array([math.cos(ang), math.sin(ang)]))
        for j in range(steps):
            pen.line([pts[j], pts[j + 1]], width * (1 - j / steps) + 0.7)
        if depth:
            for j in rng.choice(np.arange(2, steps - 2), 2, replace=False):
                walk(pts[j], ang + rng.choice([-1, 1]) * rng.uniform(0.4, 0.9), length * 0.45, width * 0.5, depth - 1)

    for i in range(7):
        a = 2 * math.pi * i / 7 + rng.uniform(-0.3, 0.3)
        walk((0.1 * math.cos(a), 0.1 * math.sin(a)), a, rng.uniform(0.55, 0.72), 4.5, 1)
    pen.poly([(0.13 * (1 + 0.3 * rng.rand()) * math.cos(k * math.pi / 6), 0.13 * (1 + 0.3 * rng.rand()) * math.sin(k * math.pi / 6))
              for k in range(12)], 200)
    return glowed(pen.get(), 1, 0.6) * ss(polar()[2], 0.95, 0.55)


# ------------------------------------------------------------------ nature / elements

def water_droplet():
    x, y = _grid(N)
    cy, rb = 0.25, 0.52
    inside = np.where(y < cy, np.abs(x) - rb * np.clip((y + 0.85) / (cy + 0.85), 0, 1) ** 1.3, np.hypot(x, y - cy) - rb)
    fill = ss(inside, 0.012, -0.012) * (y > -0.86)
    rim = ss(-inside, 0.12, 0.0)
    hi = np.exp(-(((x + 0.18) / 0.08) ** 2 + ((y - 0.12) / 0.15) ** 2))
    return fill * (0.35 + 0.5 * rim + 0.9 * hi)


def splash():
    rng, pen = np.random.RandomState(91), Pen()
    pen.poly([(0.28 * (1 + 0.25 * rng.uniform(-1, 1)) * math.cos(k * math.pi / 12),
               0.28 * (1 + 0.25 * rng.uniform(-1, 1)) * math.sin(k * math.pi / 12)) for k in range(24)], 210)
    for _ in range(12):
        a, length = rng.uniform(0, 2 * math.pi), rng.uniform(0.45, 0.78)
        d = np.array([math.cos(a), math.sin(a)])
        for j in range(6):
            pen.line([d * (0.2 + (length - 0.2) * j / 6), d * (0.2 + (length - 0.2) * (j + 1) / 6)], 4.0 * (1 - j / 6) + 0.8)
        e = rng.uniform(0.025, 0.045)
        pen.ellipse(*(d * (length + e)), e, e)
    for _ in range(10):
        a, rr, e = rng.uniform(0, 2 * math.pi), rng.uniform(0.5, 0.85), rng.uniform(0.015, 0.035)
        pen.ellipse(rr * math.cos(a), rr * math.sin(a), e, e)
    return glowed(pen.get(), 3, 0.35)


def bubble():
    return _gen("bubble", N, 0)


def snowflake():
    pen = Pen()
    for k in range(6):
        ang = k * math.pi / 3 - math.pi / 2
        d = np.array([math.cos(ang), math.sin(ang)])
        pen.line([(0, 0), d * 0.84], 3.2)
        for t, length in ((0.3, 0.2), (0.5, 0.26), (0.68, 0.18), (0.82, 0.08)):
            for s in (-1, 1):
                b = ang + s * math.pi / 3
                pen.line([d * t, d * t + length * np.array([math.cos(b), math.sin(b)])], 2.2)
    hexa = [(0.14 * math.cos(k * math.pi / 3), 0.14 * math.sin(k * math.pi / 3)) for k in range(6)]
    pen.line(hexa + hexa[:1], 2.0)
    return glowed(pen.get(), 4, 0.4)


def ice_shard():
    pen = Pen()
    tip, bot = (0.05, -0.88), (-0.02, 0.88)
    left = [tip, (-0.17, -0.35), (-0.2, 0.58), bot]
    right = [tip, (0.22, -0.3), (0.17, 0.62), bot]
    pen.poly(left, 140)
    pen.poly(right, 225)
    pen.line(left + right[::-1], 1.2)
    pen.line([tip, (0.0, 0.0), bot], 1.6)
    return glowed(pen.get(), 4, 0.3)


def leaf():
    x, y = _grid(N)
    t = (y + 0.85) / 1.6
    w = 0.4 * np.sin(np.pi * np.clip(t, 0, 1)) ** 0.85 * (1 - 0.25 * t)
    body = ss(np.abs(x) - w, 0.012, -0.012) * (t > 0) * (t < 1)
    rib = line(np.abs(x), 0.014) * (t > 0.02)
    veins = line(np.abs(np.sin((y + np.abs(x) * 0.9) * np.pi * 5)), 0.15)
    stem = line(np.abs(x), 0.014) * (y > 0.7) * (y < 0.92)
    return rotate(np.maximum(body * (0.9 - 0.35 * rib - 0.2 * veins), stem * 0.9), 30)


def petal():
    x, y = _grid(N)
    taper = np.where(y > -0.3, np.abs(x) - 0.45 * np.clip((0.8 - y) / 1.1, 0, 1) ** 1.2, 1)
    inside = np.minimum(np.hypot(x, y + 0.3) - 0.45, taper)
    body = ss(inside, 0.012, -0.012) * ss(np.hypot(x, y + 0.8), 0.1, 0.15) * (y < 0.8)
    return body * (0.65 + 0.35 * ss(y, 0.8, -0.2)) * (1 - 0.15 * line(np.abs(x), 0.01))


def feather():
    x, y = _grid(N)
    dx = x - (0.12 * y ** 2 - 0.06)
    t = (y + 0.88) / 1.65
    w = np.where(dx < 0, 0.26, 0.32) * np.sin(np.pi * np.clip(t, 0, 1) ** 0.8) ** 0.6
    vane = ss(np.abs(dx) - w, 0.04, -0.03) * (t > 0) * (t < 0.88)
    barbs = 0.6 + 0.4 * np.sin((y + np.abs(dx) * 0.7) * 120) ** 2
    shaft = line(np.abs(dx), 0.014) * (t > -0.02) * (t < 1.0)
    return rotate(np.maximum(vane * barbs * 0.85, shaft), 25)


def poison_bubble():
    a = np.zeros((N, N), np.float32)
    for cx, cy, size in ((-0.12, 0.12, 150), (0.42, -0.38, 80), (-0.5, -0.45, 56), (0.5, 0.45, 44)):
        b = _gen("bubble", size, 0)
        x0, y0 = int(round((cx + 1) / 2 * N - size / 2)), int(round((cy + 1) / 2 * N - size / 2))
        a[y0:y0 + size, x0:x0 + size] = np.maximum(a[y0:y0 + size, x0:x0 + size], b / b.max())
    return a


# ------------------------------------------------------------------ debris / utility

def debris_chunks():
    """2x2 grid of four rock chunks (each in its own 128 px cell): a scatter sprite, or tiles [2,2]."""
    rng, cells = np.random.RandomState(101), []
    for _ in range(4):
        pen = Pen(N // 2)
        verts = [(rng.uniform(0.55, 0.82) * math.cos(a), rng.uniform(0.55, 0.82) * math.sin(a))
                 for a in np.sort(rng.uniform(0, 2 * math.pi, 7))]
        c = (rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2))
        for p, q in zip(verts, verts[1:] + verts[:1]):
            pen.poly([c, p, q], int(rng.randint(110, 256)))
        cells.append(fade_border(pen.get(), 4, 6))
    return np.block([[cells[0], cells[1]], [cells[2], cells[3]]])


def dust_speck():
    x, y = _grid(N)
    rng = np.random.RandomState(105)
    a = np.zeros_like(x)
    for _ in range(5):
        cx, cy, s = rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), rng.uniform(0.08, 0.18)
        a += rng.uniform(0.4, 1) * np.exp(-(((x - cx) ** 2 + (y - cy) ** 2) / s ** 2))
    return a


def sand_grain_noise():
    r = polar()[2]
    rng = np.random.RandomState(111)
    g = (rng.rand(N, N) > 0.93) * rng.uniform(0.4, 1, (N, N))
    return blur(g, 0.6) * ss(r, 0.92, 0.3) * (0.6 + 0.4 * _fbm(N, 112, 4, 4))


def noise_perlin_tile():
    return tile_noise(N, 121, 6, 4)


def trail_streak():
    """256x64, head on the LEFT like the artist's Trail.png (u = 0 is the trail head)."""
    u = (np.arange(N) + 0.5) / N
    v = (np.arange(64) + 0.5) / 64 * 2 - 1
    U, V = np.meshgrid(u, v)
    core = np.exp(-(V / (0.18 * (1 - U) + 0.05)) ** 2)
    stripes = tile_noise(64, 131, 3, 4)[:, (np.arange(N) // 4) % 64]
    return (1 - U) ** 1.6 * (core + 0.35 * np.exp(-(V / 0.6) ** 2) * (1 - U)) * (0.8 + 0.2 * stripes)


# ------------------------------------------------------------------ pickups (colour, blend alpha)

def _lerp(c0, c1, t):
    return np.asarray(c0, np.float32) + (np.asarray(c1, np.float32) - c0) * np.clip(t, 0, 1)[..., None]


def coin():
    x, y, r, th = polar()
    R = 0.82
    alpha = ss(r, R + 0.012, R - 0.012)
    light = np.clip(0.5 - 0.4 * (x + y) / R, 0, 1)                  # lit from the top-left
    rim = ss(r, R - 0.13, R - 0.1)
    shade = np.where(rim > 0.5, 1 - light, light)                   # bevel: rim lit the other way
    pen = Pen()
    pen.poly([((0.42 if k % 2 == 0 else 0.18) * math.cos(k * math.pi / 5 - math.pi / 2),
               (0.42 if k % 2 == 0 else 0.18) * math.sin(k * math.pi / 5 - math.pi / 2)) for k in range(10)], 255)
    star = pen.get()
    shade = np.clip(shade * (1 - 0.35 * star) + 0.45 * star * light + 0.15 * star, 0, 1)
    rgb = _lerp((150, 90, 8), (255, 214, 74), shade)
    rgb = _lerp(rgb, (255, 250, 210), 0.8 * np.exp(-(((x + 0.35) / 0.1) ** 2 + ((y + 0.35) / 0.22) ** 2)))
    rgb = _lerp(rgb, (110, 60, 5), ss(r, R - 0.03, R))               # dark outline
    return rgb, alpha


def gem():
    girdle = [(-0.82, -0.2), (-0.45, -0.2), (0.0, -0.2), (0.45, -0.2), (0.82, -0.2)]
    table = [(-0.55, -0.6), (-0.2, -0.6), (0.2, -0.6), (0.55, -0.6)]
    tip = (0.0, 0.82)
    col, alpha = Pen(mode="RGB", bg=(12, 50, 110)), Pen()
    outline = [table[0], table[-1], girdle[-1], tip, girdle[0]]
    alpha.poly(outline, 255)
    facets = [([table[1], table[2], (0.3, -0.2), (-0.3, -0.2)], (120, 230, 255)),     # table front
              ([table[0], table[1], (-0.3, -0.2), girdle[0]], (70, 170, 240)),
              ([table[2], table[3], girdle[-1], (0.3, -0.2)], (40, 120, 210)),
              ([girdle[0], girdle[1], tip], (30, 110, 200)), ([girdle[1], girdle[2], tip], (90, 200, 250)),
              ([girdle[2], girdle[3], tip], (50, 150, 230)), ([girdle[3], girdle[4], tip], (20, 80, 170))]
    for pts, c in facets:
        col.poly(pts, c, outline=(150, 235, 255), w=1)
    col.line(outline + outline[:1], 3, (12, 50, 110))
    rgb = np.asarray(col.img.resize((N, N), Image.LANCZOS), np.float32)
    x, y = _grid(N)
    rgb = _lerp(rgb, (255, 255, 255), 0.9 * np.exp(-(((x + 0.3) / 0.06) ** 2 + ((y + 0.45) / 0.06) ** 2)))
    return rgb, alpha.get()


def heart_pickup():
    x, y = _grid(N)
    xx, yy = x * 1.4, -y * 1.4 + 0.15                                 # classic heart curve, solid fill
    hard = ss(-np.cbrt((xx ** 2 + yy ** 2 - 1) ** 3 - xx ** 2 * yy ** 3), 0, 0.03)   # cbrt: the cubic is flat at its edge
    inner = np.clip(blur(hard, 10) * 1.4, 0, 1)
    rgb = _lerp((150, 10, 30), (240, 45, 65), inner)
    rgb = _lerp(rgb, (255, 150, 160), 0.6 * np.clip(-(x + y) * 0.6, 0, 1) * inner)
    rgb = _lerp(rgb, (255, 255, 255), 0.85 * np.exp(-(((x + 0.32) / 0.1) ** 2 + ((y + 0.28) / 0.07) ** 2)))
    rgb = _lerp(rgb, (110, 5, 20), np.clip((0.75 - inner) * 3, 0, 1))  # dark rim
    return rgb, hard


# ------------------------------------------------------------------ table (order = contact sheet order)

TEXTURES = [glow_soft, glow_hard, dot, ring_thin, ring_thick, disc_soft, gradient_radial, gradient_linear,
            sparkle4, star6, flare_rays, lens_ring, magic_circle, hex_shield, heal_cross,
            flame, fire_flipbook_4x4, smoke_puff, smoke_flipbook_4x4, explosion_flipbook_4x4, ember,
            lightning_bolt, electric_arc, beam_core, shockwave, swirl_vortex, portal,
            slash_arc, hit_burst, impact_star, crack_ground,
            water_droplet, splash, bubble, snowflake, ice_shard, leaf, petal, feather, poison_bubble,
            debris_chunks, dust_speck, sand_grain_noise, noise_perlin_tile, trail_streak,
            coin, gem, heart_pickup]


def build(fn):
    name = fn.__name__
    out = fn()
    if name in COLOUR:
        rgb, a = out
        a = fade_border(np.clip(a, 0, 1))
        arr = np.dstack([np.clip(rgb, 0, 255), a[..., None] * 255])
    else:
        a = np.clip(out, 0, None)
        a = a / max(1e-6, a.max())
        if name not in TILED:
            a = fade_border(a)
        arr = np.dstack([np.full_like(a, 255)] * 3 + [a * 255])
    return Image.fromarray(np.rint(arr).astype(np.uint8), "RGBA")


def check(name, img):
    """The library rules: size, mode, transparent 4 px border, white RGB under every mask pixel, not empty."""
    arr = np.asarray(img)
    want = (256, 64) if name == "trail_streak" else (N, N)
    assert img.size == want and img.mode == "RGBA", (name, img.size, img.mode)
    al = arr[..., 3]
    assert al.max() > 200, (name, "nearly empty", al.max())
    if name not in TILED:
        assert al[:4].max() == al[-4:].max() == al[:, :4].max() == al[:, -4:].max() == 0, (name, "border not clear")
    if name not in COLOUR:
        assert (arr[..., :3][al > 0] == 255).all(), (name, "mask RGB not white")


def contact_sheet(path, cell=150, cols=8):
    from PIL import ImageFont
    lib = sorted((os.path.splitext(f)[0].lower(), os.path.join(LIB_DIR, f)) for f in os.listdir(LIB_DIR) if f.lower().endswith(".png"))
    rows = (len(lib) + cols - 1) // cols
    lab = 16
    out = Image.new("RGBA", (cols * cell, rows * (cell + lab)), (48, 48, 48, 255))
    draw, font = ImageDraw.Draw(out), ImageFont.load_default()
    for i, (name, f) in enumerate(lib):
        im = Image.open(f).convert("RGBA")
        im.thumbnail((cell - 10, cell - 10), Image.LANCZOS)
        x0, y0 = (i % cols) * cell, (i // cols) * (cell + lab)
        draw.rectangle([x0 + 4, y0 + 4, x0 + cell - 5, y0 + cell - 5], outline=(70, 70, 70, 255))
        out.alpha_composite(im, (x0 + (cell - im.width) // 2, y0 + (cell - im.height) // 2))
        tag = "%s %dx%d" % (name, *Image.open(f).size)
        draw.text((x0 + 5, y0 + cell), tag, fill=(220, 220, 220, 255), font=font)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.convert("RGB").save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sheet", default=os.path.join(os.path.dirname(HERE), "fx", "out", "texture_library_sheet.png"))
    args = ap.parse_args()
    names = [fn.__name__ for fn in TEXTURES]
    clash = [n for n in names if n in ARTIST]
    assert not clash and len(set(names)) == len(names), ("would overwrite artist PNGs / duplicate names", clash)
    for fn in TEXTURES:
        img = build(fn)
        check(fn.__name__, img)
        img.save(os.path.join(LIB_DIR, fn.__name__ + ".png"))
        print("wrote %-24s %dx%d" % (fn.__name__ + ".png", *img.size))
    contact_sheet(args.sheet)
    print("%d textures in %s\ncontact sheet: %s" % (len(TEXTURES), LIB_DIR, args.sheet))


if __name__ == "__main__":
    main()
