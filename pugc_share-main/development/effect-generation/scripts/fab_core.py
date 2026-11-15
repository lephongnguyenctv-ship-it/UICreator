"""Spec <-> Unity 2018.4 ParticleSystem typetree. No Unity editor needed.

The typetrees are written with UnityPy on top of the objects found in the sample .fab, so every field the
engine expects is already present; this module only overrides the values the spec talks about.
Everything here is derived from universe_effect.fab (the artist's reference), not from an official spec.
"""
import copy
import hashlib
import math
import re

# ------------------------------------------------------------------ small helpers

SHAPES = {"sphere": 0, "hemisphere": 2, "cone": 4, "box": 5, "circle": 10, "edge": 12, "donut": 17, "rectangle": 18}
SHAPES_VERIFIED = {"sphere", "cone", "circle"}          # present in the sample
RENDER_MODES = {"billboard": 0, "stretch": 1, "horizontal": 2, "vertical": 3}
RENDER_VERIFIED = {"billboard", "horizontal"}
SPACES = {"local": 0, "world": 1}


def safe_name(name):
    s = re.sub(r"[^a-z0-9]+", "_", str(name).lower()).strip("_")
    return s or "effect"


def title_name(name):
    return "_".join(p.capitalize() for p in safe_name(name).split("_"))


def pid_for(seed):
    """Deterministic non-zero signed 64-bit path id."""
    v = int.from_bytes(hashlib.md5(seed.encode("utf8")).digest()[:8], "little", signed=True)
    return v or 1


def md5hex(s):
    return hashlib.md5(s.encode("utf8")).hexdigest()


def euler_to_quat(x, y, z):
    """Unity euler (degrees, Z then X then Y) -> (x, y, z, w)."""
    rx, ry, rz = (math.radians(a) * 0.5 for a in (x, y, z))
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    return (
        sx * cy * cz + cx * sy * sz,
        cx * sy * cz - sx * cy * sz,
        cx * cy * sz - sx * sy * cz,
        cx * cy * cz + sx * sy * sz,
    )


def quat_to_euler(qx, qy, qz, qw):
    sinx = 2 * (qw * qx - qy * qz)
    sinx = max(-1.0, min(1.0, sinx))
    x = math.degrees(math.asin(sinx))
    y = math.degrees(math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qx * qx + qy * qy)))
    z = math.degrees(math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qx * qx + qz * qz)))
    return [round(x, 3), round(y, 3), round(z, 3)]


def ref(pid, file_id=0):
    return {"m_FileID": file_id, "m_PathID": pid}


# ------------------------------------------------------------------ MinMaxCurve / MinMaxGradient

def _empty_curve():
    return {"m_Curve": [], "m_PreInfinity": 2, "m_PostInfinity": 2, "m_RotationOrder": 4}


def _keyframes(points, smooth):
    pts = [(float(t), float(v)) for t, v in points]
    n = len(pts)
    out = []
    for i, (t, v) in enumerate(pts):
        if smooth and 0 < i < n - 1:
            sl = (pts[i + 1][1] - pts[i - 1][1]) / max(1e-6, pts[i + 1][0] - pts[i - 1][0])
            ins = outs = sl
        elif smooth:
            ins = outs = 0.0
        else:
            ins = (v - pts[i - 1][1]) / max(1e-6, t - pts[i - 1][0]) if i > 0 else 0.0
            outs = (pts[i + 1][1] - v) / max(1e-6, pts[i + 1][0] - t) if i < n - 1 else 0.0
        out.append({"time": t, "value": v, "inSlope": ins, "outSlope": outs,
                    "weightedMode": 0, "inWeight": 0.0, "outWeight": 0.0})
    return out


def mm(value, smooth=False):
    """number -> constant, [lo, hi] -> random between constants, [[t, v], ...] -> curve."""
    if isinstance(value, (int, float)):
        return {"minMaxState": 0, "scalar": float(value), "minScalar": float(value),
                "maxCurve": _empty_curve(), "minCurve": _empty_curve()}
    if len(value) == 2 and all(isinstance(x, (int, float)) for x in value):
        lo, hi = float(min(value)), float(max(value))
        return {"minMaxState": 3, "scalar": hi, "minScalar": lo,
                "maxCurve": _empty_curve(), "minCurve": _empty_curve()}
    c = _empty_curve()
    c["m_Curve"] = _keyframes(value, smooth)
    return {"minMaxState": 1, "scalar": 1.0, "minScalar": 1.0, "maxCurve": c, "minCurve": _empty_curve()}


def read_mm(c):
    """Inverse of mm(). Returns number, [lo, hi] or [[t, v], ...] (values multiplied by scalar)."""
    s = c["minMaxState"]
    if s == 0:
        return round(c["scalar"], 5)
    if s == 3:
        return [round(c["minScalar"], 5), round(c["scalar"], 5)]
    if s == 1:
        return [[round(k["time"], 4), round(k["value"] * c["scalar"], 5)] for k in c["maxCurve"]["m_Curve"]]
    return {"unsupported": "minMaxState %d" % s}


def _color(c):
    return {"r": float(c[0]), "g": float(c[1]), "b": float(c[2]), "a": float(c[3]) if len(c) > 3 else 1.0}


def _grad_struct(keys):
    """keys: [[t, r, g, b, a], ...] (<= 8). Alpha and colour keys share the same list."""
    keys = sorted(([float(x) for x in k] for k in keys), key=lambda k: k[0])
    if len(keys) > 8:
        raise ValueError("a gradient takes at most 8 keys")
    g = {}
    for i in range(8):
        k = keys[i] if i < len(keys) else (0, 0, 0, 0, 0)
        g["key%d" % i] = {"r": k[1], "g": k[2], "b": k[3], "a": k[4]}
    for i in range(8):
        t = int(round(keys[i][0] * 65535)) if i < len(keys) else 0
        g["ctime%d" % i] = t
    for i in range(8):
        t = int(round(keys[i][0] * 65535)) if i < len(keys) else 0
        g["atime%d" % i] = t
    g["m_Mode"] = 0
    g["m_NumColorKeys"] = max(2, len(keys))
    g["m_NumAlphaKeys"] = max(2, len(keys))
    return g


def _grad_struct_split(color_keys, alpha_keys):
    """Separate lists: colour keys [[t,r,g,b]], alpha keys [[t,a]] (as the artist's fade gradients use)."""
    g = {}
    for i in range(8):
        r = gg = b = a = 0.0
        if i < len(color_keys):
            r, gg, b = color_keys[i][1:4]
        if i < len(alpha_keys):
            a = alpha_keys[i][1]
        g["key%d" % i] = {"r": float(r), "g": float(gg), "b": float(b), "a": float(a)}
    for i in range(8):
        g["ctime%d" % i] = int(round(color_keys[i][0] * 65535)) if i < len(color_keys) else 0
    for i in range(8):
        g["atime%d" % i] = int(round(alpha_keys[i][0] * 65535)) if i < len(alpha_keys) else 0
    g["m_Mode"] = 0
    g["m_NumColorKeys"] = len(color_keys)
    g["m_NumAlphaKeys"] = len(alpha_keys)
    return g


def gradient_to_keys(g):
    """Inverse: gradient struct -> (colour keys [[t,r,g,b]], alpha keys [[t,a]])."""
    nc, na = g["m_NumColorKeys"], g["m_NumAlphaKeys"]
    ck = [[round(g["ctime%d" % i] / 65535, 4)] + [round(g["key%d" % i][c], 4) for c in "rgb"] for i in range(nc)]
    ak = [[round(g["atime%d" % i] / 65535, 4), round(g["key%d" % i]["a"], 4)] for i in range(na)]
    return ck, ak


def gradient_from_spec(spec):
    """Accepts [[t,r,g,b,a],...] (shared keys) or {"color": [[t,r,g,b]..], "alpha": [[t,a]..]}."""
    if isinstance(spec, dict):
        return _grad_struct_split(spec["color"], spec["alpha"])
    return _grad_struct(spec)


def gradient_to_spec(g):
    ck, ak = gradient_to_keys(g)
    shared = len(ck) == len(ak) and all(abs(c[0] - a[0]) < 1e-3 for c, a in zip(ck, ak))
    if shared:
        return [c + [a[1]] for c, a in zip(ck, ak)]
    return {"color": ck, "alpha": ak}


def mm_gradient(base, color):
    """MinMaxGradient from a spec colour value.

    [r,g,b,a]                              constant
    {"between": [c1, c2]}                   random between two colours
    {"gradient": keys, "random": bool}      gradient over lifetime, or a random pick along it (random=true)
    """
    g = copy.deepcopy(base)
    if isinstance(color, dict) and "gradient" in color:
        g["minMaxState"] = 4 if color.get("random") else 1
        g["maxGradient"] = gradient_from_spec(color["gradient"])
        g["minGradient"] = copy.deepcopy(g["maxGradient"])
    elif isinstance(color, dict) and "between" in color:
        g["minMaxState"] = 2
        g["minColor"] = _color(color["between"][0])
        g["maxColor"] = _color(color["between"][1])
    else:
        g["minMaxState"] = 0
        g["minColor"] = g["maxColor"] = _color(color)
    return g


def read_color(g):
    s = g["minMaxState"]
    if s == 0:
        c = g["maxColor"]
        return [round(c[k], 4) for k in "rgba"]
    if s == 2:
        return {"between": [[round(g[n][k], 4) for k in "rgba"] for n in ("minColor", "maxColor")]}
    if s in (1, 4):
        d = {"gradient": gradient_to_spec(g["maxGradient"])}
        if s == 4:
            d["random"] = True
        return d
    return {"unsupported": "minMaxState %d" % s}


# ------------------------------------------------------------------ ParticleSystem

MODULES = ["SizeModule", "RotationModule", "ColorModule", "UVModule", "VelocityModule", "InheritVelocityModule",
           "ForceModule", "ExternalForcesModule", "ClampVelocityModule", "NoiseModule", "SizeBySpeedModule",
           "RotationBySpeedModule", "ColorBySpeedModule", "CollisionModule", "TriggerModule", "SubModule",
           "LightsModule", "TrailModule", "CustomDataModule"]
USED_IN_SAMPLE = {"InitialModule", "ShapeModule", "EmissionModule", "ColorModule", "UVModule", "VelocityModule",
                  "SizeModule", "RotationModule", "TrailModule"}


def _as3(v, default):
    v = default if v is None else v
    return {"x": float(v[0]), "y": float(v[1]), "z": float(v[2])}


def _fade_keys(fade):
    """fade = [in, out] fractions of the lifetime -> alpha envelope 0 -> 1 -> 0 (white colour)."""
    fin, fout = float(fade[0]), float(fade[1])
    alpha = [[0.0, 0.0], [fin, 1.0]] if fin > 0 else [[0.0, 1.0]]
    if fin <= 0:
        alpha = [[0.0, 1.0]]
    if fout > 0:
        alpha += [[1.0 - fout, 1.0], [1.0, 0.0]]
    else:
        alpha += [[1.0, 1.0]]
    if len(alpha) < 2:
        alpha = [[0.0, 1.0], [1.0, 1.0]]
    # drop duplicate times
    clean = []
    for a in alpha:
        if clean and abs(clean[-1][0] - a[0]) < 1e-4:
            clean[-1] = a
        else:
            clean.append(a)
    return {"color": [[0.0, 1, 1, 1], [1.0, 1, 1, 1]], "alpha": clean}


def fade_from_alpha(ak):
    """Inverse of _fade_keys: returns [in, out] when the alpha keys form a standard envelope, else None."""
    t = [round(a[0], 3) for a in ak]
    v = [round(a[1], 3) for a in ak]
    if len(ak) == 4 and v == [0, 1, 1, 0] and t[0] == 0 and t[3] == 1:
        fin, fout = t[1], round(1 - t[2], 4)
        return [0, 0] if fin < 0.01 and fout < 0.01 else [fin, fout]       # (0,0)(0,1)(1,1)(1,0) = no fade
    if len(ak) == 3 and v == [0, 1, 1] and t[0] == 0 and t[2] == 1:
        return [t[1], 0]
    if len(ak) == 2 and v == [1, 1]:
        return [0, 0]
    return None


def ps_from_spec(base, s, go_pid):
    """Build a ParticleSystem typetree for one spec system, starting from `base` (a template ParticleSystem)."""
    t = copy.deepcopy(base)
    smooth = bool(s.get("smooth"))
    t["m_GameObject"] = ref(go_pid)
    t["lengthInSec"] = float(s.get("duration", 5.0))
    t["simulationSpeed"] = float(s.get("simulationSpeed", 1.0))
    t["looping"] = bool(s.get("loop", True))
    t["prewarm"] = bool(s.get("prewarm", False)) and t["looping"]
    t["playOnAwake"] = True
    t["startDelay"] = mm(float(s.get("delay", 0.0)))
    t["moveWithTransform"] = SPACES[s.get("space", "local")]
    t["scalingMode"] = 0
    t["autoRandomSeed"] = True

    for m in MODULES:
        if m in t and isinstance(t[m], dict):
            t[m]["enabled"] = False

    # ---- initial
    i = t["InitialModule"]
    i["enabled"] = True
    i["startLifetime"] = mm(s.get("lifetime", 2.0))
    i["startSpeed"] = mm(s.get("speed", 0.0))
    size = mm(s.get("size", 0.3))
    i["startSize"] = size
    i["startSizeY"] = copy.deepcopy(size)
    i["startSizeZ"] = copy.deepcopy(size)
    i["startRotationX"] = mm(0.0)
    i["startRotationY"] = mm(0.0)
    rot = s.get("rotation", 0.0)
    i["startRotation"] = mm([math.radians(x) for x in rot] if isinstance(rot, list) else math.radians(rot))
    i["randomizeRotationDirection"] = 0.0
    i["maxNumParticles"] = int(s.get("maxParticles", 10))
    i["size3D"] = False
    i["rotation3D"] = False
    i["gravityModifier"] = mm(float(s.get("gravity", 0.0)))
    i["startColor"] = mm_gradient(i["startColor"], s.get("color", [1, 1, 1, 1]))

    # ---- shape
    sh = s.get("shape", "none")
    sh = {"type": sh} if isinstance(sh, str) else dict(sh)
    st = t["ShapeModule"]
    st["enabled"] = sh.get("type", "none") != "none"
    if st["enabled"]:
        st["type"] = SHAPES[sh["type"]]
        st["angle"] = float(sh.get("angle", 25.0))
        st["length"] = float(sh.get("length", 5.0))
        st["radiusThickness"] = float(sh.get("thickness", 1.0))
        st["donutRadius"] = float(sh.get("donutRadius", 0.2))
        st["m_Position"] = _as3(sh.get("position"), [0, 0, 0])
        st["m_Rotation"] = _as3(sh.get("rotation"), [0, 0, 0])
        st["m_Scale"] = _as3(sh.get("scale"), [1, 1, 1])
        st["boxThickness"] = _as3(sh.get("boxThickness"), [0, 0, 0])
        st["radius"]["value"] = float(sh.get("radius", s.get("radius", 1.0)))
        st["arc"]["value"] = float(sh.get("arc", 360.0))
        st["randomDirectionAmount"] = float(sh.get("randomDirection", 0.0))
        st["sphericalDirectionAmount"] = float(sh.get("sphericalDirection", 0.0))

    # ---- emission
    em = t["EmissionModule"]
    em["enabled"] = True
    em["rateOverTime"] = mm(float(s.get("rate", 0.0)))
    em["rateOverDistance"] = mm(0.0)
    bursts = s.get("bursts") or []
    em["m_BurstCount"] = len(bursts)
    em["m_Bursts"] = [_burst(b, base) for b in bursts]

    # ---- color over lifetime
    col = t["ColorModule"]
    col_spec = s.get("colorOverLife")
    if col_spec is None:
        fade = s.get("fade", [0.2, 0.3])
        col_spec = _fade_keys(fade) if fade else None
    if col_spec:
        col["enabled"] = True
        col["gradient"]["minMaxState"] = 1
        g = gradient_from_spec(col_spec)
        col["gradient"]["maxGradient"] = g
        col["gradient"]["minGradient"] = copy.deepcopy(g)

    # ---- size over lifetime
    if s.get("sizeOverLife"):
        sz = t["SizeModule"]
        sz["enabled"] = True
        sz["curve"] = mm(s["sizeOverLife"], smooth)
        sz["separateAxes"] = False

    # ---- rotation over lifetime (deg/s in the spec)
    if s.get("rotationOverLife") not in (None, 0, [0, 0]):
        r = t["RotationModule"]
        r["enabled"] = True
        v = s["rotationOverLife"]
        r["curve"] = mm([math.radians(x) for x in v] if isinstance(v, list) else math.radians(v))
        r["separateAxes"] = False

    # ---- velocity over lifetime: linear + orbital (rad/s)
    vel = s.get("velocity")
    orb = s.get("orbit")
    if "orbitSpeed" in s and orb is None:                      # v1 spec: orbit around the local Y axis
        orb = [0, s["orbitSpeed"], 0]
    if vel or orb:
        v = t["VelocityModule"]
        v["enabled"] = True
        for k, val in zip("xyz", vel or [0, 0, 0]):
            v[k] = mm(float(val))
        for k, val in zip("XYZ", orb or [0, 0, 0]):
            v["orbital" + k] = mm(float(val))
        for k in ("orbitalOffsetX", "orbitalOffsetY", "orbitalOffsetZ", "radial"):
            v[k] = mm(0.0)
        v["speedModifier"] = mm(1.0)
        v["inWorldSpace"] = False

    # ---- flipbook (Texture Sheet Animation)
    fb = s.get("flipbook")
    if fb:
        u = t["UVModule"]
        u["enabled"] = True
        u["mode"] = 0
        u["timeMode"] = 0
        u["tilesX"], u["tilesY"] = int(fb["tiles"][0]), int(fb["tiles"][1])
        u["animationType"] = 0
        u["cycles"] = float(fb.get("cycles", 1.0))
        u["frameOverTime"] = mm([[0.0, 0.0], [1.0, 0.9999]])
        u["startFrame"] = mm(0.0)
        u["randomRow"] = True
        u["rowIndex"] = 0

    # ---- trails
    tr = s.get("trail")
    if tr:
        tr = {} if tr is True else tr
        m = t["TrailModule"]
        m["enabled"] = True
        m["mode"] = 0
        m["ratio"] = float(tr.get("ratio", 1.0))
        m["lifetime"] = mm(float(tr.get("lifetime", 0.1)))
        m["minVertexDistance"] = float(tr.get("minVertexDistance", 0.03))
        m["textureMode"] = 0
        m["worldSpace"] = bool(tr.get("worldSpace", False))
        m["dieWithParticles"] = True
        m["sizeAffectsWidth"] = True
        m["inheritParticleColor"] = bool(tr.get("inheritColor", False))
        width = tr.get("width", [[0.0, 1.0], [1.0, 0.2]])
        m["widthOverTrail"] = mm(width, smooth)
        m["widthOverTrail"]["scalar"] = float(tr.get("widthScale", 1.0))
        defaults = {"colorOverTrail": [[0, 1, 1, 1, 1], [1, 1, 1, 1, 0]],       # fades out towards the tail
                    "colorOverLife": [[0, 1, 1, 1, 1], [1, 1, 1, 1, 1]]}
        for key, name in (("colorOverTrail", "colorOverTrail"), ("colorOverLife", "colorOverLifetime")):
            m[name]["minMaxState"] = 1
            g = gradient_from_spec(tr.get(key) or defaults[key])
            m[name]["maxGradient"] = g
            m[name]["minGradient"] = copy.deepcopy(g)
    return t


def _burst(b, base):
    """[time, count] or [time, min, max]. The element layout is taken from the template (see fab_build)."""
    time = float(b[0])
    lo = int(b[1])
    hi = int(b[2]) if len(b) > 2 else lo
    return {"time": time, "countCurve": mm([float(lo), float(hi)]) if lo != hi else mm(float(lo)),
            "cycleCount": 1, "repeatInterval": 0.01, "probability": 1.0}


def ps_to_spec(t, name):
    """Inverse of ps_from_spec for the modules the sample uses. Unmodelled enabled modules go to `_unmodelled`."""
    i, sh, em = t["InitialModule"], t["ShapeModule"], t["EmissionModule"]
    s = {"name": name}
    s["duration"] = round(t["lengthInSec"], 4)
    s["loop"] = t["looping"]
    if t["prewarm"]:
        s["prewarm"] = True
    if t["moveWithTransform"]:
        s["space"] = "world"
    s["maxParticles"] = i["maxNumParticles"]
    s["rate"] = read_mm(em["rateOverTime"])
    if em["m_Bursts"]:
        s["bursts"] = [[round(b["time"], 3), read_mm(b["countCurve"])] for b in em["m_Bursts"]]
    s["lifetime"] = read_mm(i["startLifetime"])
    s["speed"] = read_mm(i["startSpeed"])
    s["size"] = read_mm(i["startSize"])
    rot = read_mm(i["startRotation"])
    if rot not in (0, 0.0):
        s["rotation"] = [round(math.degrees(x), 3) for x in rot] if isinstance(rot, list) and rot and not isinstance(rot[0], list) else (
            round(math.degrees(rot), 3) if isinstance(rot, float) else rot)
    gv = read_mm(i["gravityModifier"])
    if gv not in (0, 0.0):
        s["gravity"] = gv
    s["color"] = read_color(i["startColor"])
    if sh["enabled"]:
        inv = {v: k for k, v in SHAPES.items()}
        d = {"type": inv.get(sh["type"], "type%d" % sh["type"]), "radius": round(sh["radius"]["value"], 4)}
        if sh["type"] == 4:
            d["angle"] = round(sh["angle"], 3)
        if sh["arc"]["value"] != 360.0:
            d["arc"] = sh["arc"]["value"]
        if sh["radiusThickness"] != 1.0:
            d["thickness"] = round(sh["radiusThickness"], 3)
        for key, src in (("scale", "m_Scale"), ("rotation", "m_Rotation"), ("position", "m_Position")):
            v = [round(sh[src][k], 3) for k in "xyz"]
            if v != ([1, 1, 1] if key == "scale" else [0, 0, 0]):
                d[key] = v
        s["shape"] = d
    else:
        s["shape"] = "none"
    col = t["ColorModule"]
    if col["enabled"]:
        spec = gradient_to_spec(col["gradient"]["maxGradient"])
        ck, ak = gradient_to_keys(col["gradient"]["maxGradient"])
        fade = fade_from_alpha(ak) if all(c[1:] == [1, 1, 1] for c in ck) else None
        if fade is not None:
            s["fade"] = fade
        else:
            s["colorOverLife"] = spec
    else:
        s["fade"] = None
    if t["SizeModule"]["enabled"]:
        s["sizeOverLife"] = read_mm(t["SizeModule"]["curve"])
    if t["RotationModule"]["enabled"]:
        r = read_mm(t["RotationModule"]["curve"])
        s["rotationOverLife"] = [round(math.degrees(x), 3) for x in r] if isinstance(r, list) and r and not isinstance(r[0], list) else round(math.degrees(r), 3)
    v = t["VelocityModule"]
    if v["enabled"]:
        lin = [read_mm(v[k]) for k in "xyz"]
        orb = [read_mm(v["orbital" + k]) for k in "XYZ"]
        if any(lin):
            s["velocity"] = lin
        if any(orb):
            s["orbit"] = orb
    u = t["UVModule"]
    if u["enabled"]:
        s["flipbook"] = {"tiles": [u["tilesX"], u["tilesY"]], "cycles": u["cycles"]}
    tm = t["TrailModule"]
    if tm["enabled"]:
        tr = {"lifetime": read_mm(tm["lifetime"]), "minVertexDistance": round(tm["minVertexDistance"], 4),
              "width": read_mm(tm["widthOverTrail"])}
        if tm["widthOverTrail"]["scalar"] != 1.0:
            tr["widthScale"] = round(tm["widthOverTrail"]["scalar"], 4)
            tr["width"] = [[p[0], round(p[1] / tm["widthOverTrail"]["scalar"], 4)] for p in tr["width"]]
        tr["colorOverTrail"] = gradient_to_spec(tm["colorOverTrail"]["maxGradient"])
        s["trail"] = tr
    extra = [m for m in MODULES if t[m]["enabled"] and m not in USED_IN_SAMPLE]
    if extra:
        s["_unmodelled"] = extra
    return s
