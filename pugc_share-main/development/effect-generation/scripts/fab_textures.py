"""Texture side of the .fab pipeline: the artist's texture library, procedural fallbacks, mip chains and the
per-platform compressed encoders (PC/WebGL = DXT5, Android = ETC2 RGBA8, iOS = PVRTC 4bpp RGBA).
No Unity needed. Needs numpy, Pillow, etcpak.
"""
import math
import os

import numpy as np
from PIL import Image

import pvrtc

HERE = os.path.dirname(os.path.abspath(__file__))
LIB_DIR = os.path.join(os.path.dirname(HERE), "assets", "textures")

# Unity TextureFormat ids used by the sample's bundles
FORMAT = {"PC": 12, "WebGL": 12, "Android": 47, "IOS": 33}
MAX_SIDE = 512


def library():
    """name (lowercase, no extension) -> path of the artist's PNGs (assets/textures)."""
    out = {}
    if os.path.isdir(LIB_DIR):
        for f in sorted(os.listdir(LIB_DIR)):
            if f.lower().endswith(".png"):
                out[os.path.splitext(f)[0].lower()] = os.path.join(LIB_DIR, f)
    return out


# ------------------------------------------------------------------ procedural generator (auto-made textures)
# Every generator returns a float mask 0..1 (n x n). Masks are white RGB + this alpha, tinted by the start colour,
# like the artist's glow/cloud/sparkle. All of them fall to 0 before the border (PVRTC wraps around the edges).

def _grid(n):
    u = (np.arange(n) + 0.5) / n * 2 - 1
    return np.meshgrid(u, u)


def _fbm(n, seed, octaves=5, base=4):
    """Smooth value noise 0..1 (sum of bilinearly upsampled random grids)."""
    rng = np.random.RandomState(seed)
    out = np.zeros((n, n), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        g = rng.rand(base * 2 ** o + 1, base * 2 ** o + 1).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
        out += amp * np.asarray(img, np.float32) / 255
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / max(1e-6, out.max() - out.min())


def _window(r, edge=0.92):
    return np.clip((edge - r) / 0.12, 0, 1)


def _gen(kind, n, seed):
    x, y = _grid(n)
    r = np.sqrt(x * x + y * y)
    th = np.arctan2(y, x)
    if kind == "soft":
        return np.clip(1 - r, 0, 1) ** 2
    if kind == "dot":
        return np.clip((0.9 - r) / 0.08, 0, 1)
    if kind == "ring":
        d = (r - 0.7) / 0.08
        return np.exp(-d * d)
    if kind == "disc":
        return np.clip(1 - r, 0, 1) ** 1.5 * (0.5 + 0.5 * np.sin(3 * th + 8 * r))
    if kind == "star4":
        core = np.exp(-r * 8)
        rays = (np.exp(-np.abs(x) * 40) * np.clip(1 - np.abs(y), 0, 1) + np.exp(-np.abs(y) * 40) * np.clip(1 - np.abs(x), 0, 1)) * 0.6
        return core + rays
    if kind == "star6":
        core = np.exp(-r * 9)
        rays = sum(np.exp(-np.abs(np.sin(th - k * math.pi / 3)) * r * 55) * np.clip(1 - r, 0, 1) for k in range(3)) * 0.55
        return core + rays
    if kind == "cloud":
        return _window(r) * np.clip(1 - r, 0, 1) ** 0.6 * (0.25 + 0.75 * _fbm(n, seed))
    if kind == "smoke":
        f = _fbm(n, seed, 6, 3)
        return _window(r) * np.clip((f - 0.3) * 1.8, 0, 1) * np.clip(1 - r, 0, 1) ** 0.5
    if kind == "flame":                     # teardrop pointing up
        yy = (y + 1) / 2                    # 0 = top, 1 = bottom (image coords)
        w = 0.9 * np.sin(np.clip(yy, 0, 1) * math.pi * 0.9) ** 0.8 * (0.25 + 0.75 * yy)
        wob = (_fbm(n, seed, 4, 3) - 0.5) * 0.35
        d = np.abs(x + wob * (1 - yy)) / np.maximum(w, 1e-3)
        return np.cos(np.clip(d, 0, 1) * math.pi / 2) ** 2 * _window(r, 1.0) * np.clip(1.3 - yy * 0.4, 0, 1)
    if kind == "swirl":
        return np.clip(1 - r, 0, 1) ** 1.2 * (0.5 + 0.5 * np.sin(2 * th + 10 * r)) ** 2 * _window(r)
    if kind == "rays":
        return np.clip(1 - r, 0, 1) ** 1.3 * (0.5 + 0.5 * np.sin(14 * th)) ** 3 * _window(r)
    if kind == "streak":                    # horizontal comet streak, bright on the right
        xx = (x + 1) / 2
        return np.clip(1 - np.abs(y), 0, 1) ** 3 * xx ** 1.5 * np.clip(x + 1.0, 0, 1)
    if kind == "lightning":
        rng = np.random.RandomState(seed)
        path = np.cumsum(rng.randn(n)) * 0.02
        path -= np.linspace(path[0], path[-1], n)
        path = path / max(1e-6, np.abs(path).max()) * 0.3
        d = np.abs(x - path[:, None])
        return (np.exp(-(d / 0.035) ** 2) + 0.35 * np.exp(-(d / 0.14) ** 2)) * np.clip(1 - np.abs(y) ** 4, 0, 1) * _window(np.abs(x), 1.0)
    if kind == "bubble":
        rim = np.exp(-((r - 0.78) / 0.07) ** 2)
        hi = np.exp(-(((x + 0.3) ** 2 + (y + 0.3) ** 2) / 0.012))
        return np.clip(rim + 0.9 * hi + 0.08 * (r < 0.78), 0, 1) * _window(r, 0.95)
    if kind == "diamond":
        d = np.abs(x) + np.abs(y)
        return np.clip((0.85 - d) / 0.1, 0, 1) * (0.55 + 0.45 * np.clip(1 - r, 0, 1))
    if kind == "heart":
        xx, yy = x * 1.15, -y * 1.15 + 0.15
        v = (xx ** 2 + yy ** 2 - 0.55) ** 3 - xx ** 2 * yy ** 3
        return np.clip(-v * 6, 0, 1) ** 0.6 * _window(r, 1.05)
    if kind == "crescent":
        a = np.sqrt((x + 0.25) ** 2 + y ** 2)
        return np.clip((0.8 - r) / 0.06, 0, 1) * np.clip((a - 0.62) / 0.06, 0, 1)
    if kind == "dust":
        f = _fbm(n, seed, 3, 8)
        return np.clip(1 - r, 0, 1) ** 1.5 * np.clip((f - 0.5) * 3, 0, 1) * _window(r)
    raise KeyError(kind)


PROCEDURAL = ["soft", "dot", "ring", "disc", "star4", "star6", "cloud", "smoke", "flame", "swirl", "rays", "streak",
              "lightning", "bubble", "diamond", "heart", "crescent", "dust"]

# words in a texture request that point at a generator ("fire_ball" -> flame, "magic circle" -> ring ...)
ALIASES = {
    "flame": ["fire", "flame", "burn", "torch", "ember"], "smoke": ["smoke", "fog", "mist", "steam", "vapor"],
    "cloud": ["cloud", "nebula", "aura", "gas", "puff"], "star4": ["sparkle", "glint", "twinkle", "flare", "star", "shine"],
    "star6": ["snow", "ice", "frost", "crystal", "snowflake"], "ring": ["ring", "circle", "halo", "shockwave", "wave", "portal"],
    "swirl": ["swirl", "spiral", "vortex", "galaxy", "whirl", "tornado"], "rays": ["ray", "beam", "burst", "sun", "godray"],
    "streak": ["trail", "streak", "comet", "tail", "slash", "motion"], "lightning": ["lightning", "bolt", "thunder", "electric", "spark", "arc"],
    "bubble": ["bubble", "orb", "sphere", "bead"], "diamond": ["diamond", "gem", "shard", "jewel", "petal", "leaf"],
    "heart": ["heart", "love"], "crescent": ["moon", "crescent", "blade"], "dust": ["dust", "sand", "debris", "grain", "speck"],
    "disc": ["disc", "disk"], "dot": ["dot", "point", "pixel"], "soft": ["glow", "soft", "light", "blob", "blur"],
}


def guess_kind(name):
    """Best generator for a free-text texture name, or None."""
    low = str(name).lower()
    if low in PROCEDURAL:
        return low
    best, score = None, 0
    for kind, words in ALIASES.items():
        for w in words:
            if w in low and len(w) > score:
                best, score = kind, len(w)
    return best


def generate(kind, name="", size=128, seed=None):
    n = int(size)
    if seed is None:
        seed = sum(ord(c) * (i + 1) for i, c in enumerate(str(name) or kind)) % 9973
    a = np.clip(_gen(kind, n, int(seed)), 0, 1)
    if a.max() > 0:
        a = a / max(1.0, a.max())
    arr = np.dstack([np.full_like(a, 255)] * 3 + [a * 255]).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def _lib_with(extra_dirs):
    lib = library()
    for d in extra_dirs:
        if d and os.path.isdir(d):
            for f in os.listdir(d):
                if f.lower().endswith((".png", ".tga", ".jpg", ".jpeg")):
                    lib[os.path.splitext(f)[0].lower()] = os.path.join(d, f)
    return lib


def load_texture(ref, extra_dirs=()):
    """Resolve a texture reference to (RGBA PIL image, name, origin).

    ref is a string or {"gen": kind, "seed": n, "size": px, "name": str}. Order for strings: an existing file, the
    artist's library (assets/textures), a generator name, then AUTO-GENERATION: a generator guessed from the words
    in the name (fire -> flame, smoke, lightning...), else a soft glow. A missing texture never stops a build; the
    origin is "generated" and the caller reports it.
    """
    if isinstance(ref, dict):
        kind = ref.get("gen", "soft")
        if kind not in PROCEDURAL:
            raise KeyError("unknown generator '%s'. Use one of: %s" % (kind, ", ".join(PROCEDURAL)))
        name = ref.get("name", "gen_" + kind)
        return generate(kind, name, ref.get("size", 128), ref.get("seed")), name, "generated"
    lib = _lib_with(extra_dirs)
    if os.path.isfile(ref):
        return Image.open(ref).convert("RGBA"), os.path.splitext(os.path.basename(ref))[0], "file"
    key = ref.lower()
    if key in lib:
        return Image.open(lib[key]).convert("RGBA"), key, "library"
    kind = guess_kind(key) or "soft"
    return generate(kind, key), key, ("procedural" if key in PROCEDURAL else "generated")


def resolve_kind(ref, extra_dirs=()):
    """For the linter: (origin, generator kind or None). origin: library|file|procedural|generated."""
    if isinstance(ref, dict):
        return "generated", ref.get("gen", "soft")
    if os.path.isfile(ref):
        return "file", None
    if ref.lower() in _lib_with(extra_dirs):
        return "library", None
    if ref.lower() in PROCEDURAL:
        return "procedural", ref.lower()
    return "generated", guess_kind(ref) or "soft"


def to_pot(img, max_side=MAX_SIDE):
    """Resize to power-of-two sides (<= max_side). Returns (image, changed)."""
    def fit(n):
        p = 1 << max(3, round(math.log2(max(n, 1))))
        return min(p, max_side)
    w, h = fit(img.width), fit(img.height)
    if (w, h) == img.size:
        return img, False
    return img.resize((w, h), Image.LANCZOS), True


# ------------------------------------------------------------------ mips + encoders

def _mips(arr):
    """Premultiplied box-filter mip chain of an (h,w,4) uint8 array, largest first."""
    out = [arr]
    cur = arr.astype(np.float32)
    while cur.shape[0] > 1 or cur.shape[1] > 1:
        a = cur[..., 3:4] / 255.0
        pm = cur[..., :3] * a
        h, w = cur.shape[:2]
        nh, nw = max(1, h // 2), max(1, w // 2)

        def box(x):
            x = x[: nh * 2 if h > 1 else 1, : nw * 2 if w > 1 else 1]
            if h > 1:
                x = (x[0::2] + x[1::2]) / 2
            if w > 1:
                x = (x[:, 0::2] + x[:, 1::2]) / 2
            return x
        pm2, a2 = box(pm), box(a)
        rgb = np.where(a2 > 1e-4, pm2 / np.maximum(a2, 1e-4), 0)
        cur = np.concatenate([np.clip(rgb, 0, 255), a2 * 255], -1)
        out.append(np.rint(cur).astype(np.uint8))
    return out


def _pad4(arr):
    h, w = arr.shape[:2]
    ph, pw = (-h) % 4, (-w) % 4
    return np.pad(arr, ((0, ph), (0, pw), (0, 0)), mode="edge") if ph or pw else arr


def _enc_level(arr, platform):
    if platform in ("PC", "WebGL"):
        import etcpak
        a = _pad4(arr)
        return bytes(etcpak.compress_bc3(a.tobytes(), a.shape[1], a.shape[0]))
    if platform == "Android":
        import etcpak
        a = _pad4(arr)
        return bytes(etcpak.compress_etc2_rgba(a.tobytes(), a.shape[1], a.shape[0]))
    if platform == "IOS":
        # PVRTC minimum is 8x8; the last mips are padded by repeating their edge pixels
        a = np.pad(arr, ((0, max(0, 8 - arr.shape[0])), (0, max(0, 8 - arr.shape[1])), (0, 0)), mode="edge")
        return pvrtc.encode(a)
    raise KeyError(platform)


def encode_chain(img, platform):
    """PIL RGBA image (top-down) -> (bytes, width, height, mip count, unity format id)."""
    if platform == "IOS" and img.width != img.height:
        # PVRTC needs square POT: a 128x32 trail crashes iPhone texture creation. UVs are 0..1, so stretching is lossless
        s = max(img.size)
        img = img.resize((s, s), Image.LANCZOS)
    arr = np.flipud(np.array(img.convert("RGBA"), dtype=np.uint8))      # Unity stores rows bottom-up
    levels = _mips(arr)
    data = b"".join(_enc_level(l, platform) for l in levels)
    return data, arr.shape[1], arr.shape[0], len(levels), FORMAT[platform]
