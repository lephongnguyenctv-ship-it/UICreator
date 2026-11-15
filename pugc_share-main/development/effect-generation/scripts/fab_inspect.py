#!/usr/bin/env python
"""Read a .fab without Unity: summary, spec extraction, texture export, integrity check.

    python fab_inspect.py file.fab                     # summary of every platform
    python fab_inspect.py file.fab --spec out.json     # write the effect back as a spec (reverse of fab_build)
    python fab_inspect.py file.fab --textures out_dir  # decode the PC textures to PNG
    python fab_inspect.py file.fab --check             # integrity check (references resolve, index matches)
"""
import argparse
import json
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import UnityPy  # noqa: E402

import fab_core as core  # noqa: E402


def _load(z, plat, name):
    pkg = _pkg(z)
    return UnityPy.load(z.read("%s/%s/%s" % (plat, pkg, name)))


def _pkg(z):
    for n in z.namelist():
        if n.endswith(".pck"):
            return n[:-4]
    raise ValueError("not a .fab (no .pck)")


def platforms(z):
    return [p for p in ("IOS", "Android", "PC", "WebGL") if any(n.startswith(p + "/") for n in z.namelist())]


def read_effect(path, plat=None):
    """Returns dict: prefab name, systems [(name, GO pos/rot/scale, PS typetree, PSR typetree)], mats, textures."""
    z = zipfile.ZipFile(path)
    plat = plat or ("PC" if "PC" in platforms(z) else platforms(z)[0])
    ent, dep = _load(z, plat, "entry0.ab"), _load(z, plat, "dependencie1.ab")
    esf, dsf = list(ent.assets)[0], list(dep.assets)[0]
    names, objs = {}, {}
    for o in esf.objects.values():
        objs[o.path_id] = o
        if o.type.name == "GameObject":
            names[o.path_id] = o.read_typetree()["m_Name"]
    trans = {o.read_typetree()["m_GameObject"]["m_PathID"]: o.read_typetree() for o in esf.objects.values() if o.type.name == "Transform"}
    ps = {o.read_typetree()["m_GameObject"]["m_PathID"]: o.read_typetree() for o in esf.objects.values() if o.type.name == "ParticleSystem"}
    psr = {o.read_typetree()["m_GameObject"]["m_PathID"]: o.read_typetree() for o in esf.objects.values() if o.type.name == "PSR" or o.type.name == "ParticleSystemRenderer"}
    mats, texs = {}, {}
    for o in dsf.objects.values():
        if o.type.name == "Texture2D":
            texs[o.path_id] = o
        elif o.type.name == "Material":
            mats[o.path_id] = o.read_typetree()
    root = next(p for p, t in trans.items() if t["m_Father"]["m_PathID"] == 0)
    systems = []
    for child in trans[root]["m_Children"]:
        gid = esf.objects[child["m_PathID"]].read_typetree()["m_GameObject"]["m_PathID"]
        systems.append((names[gid], trans[gid], ps[gid], psr[gid]))
    return {"prefab": names[root], "systems": systems, "mats": mats, "texs": texs, "ent": esf, "dep": dsf,
            "platform": plat, "zip": z, "pkg": _pkg(z)}


def _mat_info(fx, pid):
    if not pid:
        return None
    m = fx["mats"][pid]
    sp = m["m_SavedProperties"]
    tex_pid = next(v["m_Texture"]["m_PathID"] for k, v in sp["m_TexEnvs"] if k == "_MainTex")
    fl = dict(sp["m_Floats"])
    tex = fx["texs"][tex_pid].read()
    return {"material": m["m_Name"], "texture": tex.m_Name, "tex_obj": tex, "blend": "additive" if fl["_Mode"] == 4.0 else "alpha",
            "flipbook_blend": fl["_FlipbookMode"] == 1.0, "keywords": m["m_ShaderKeywords"],
            "tint": [round(v, 3) for k, v in sp["m_Colors"] if k == "_Color" for v in v.values()]}


def clean_tex_names(names):
    """T_UA_Glow, T_UA_Sun_4x4 -> Glow, Sun_4x4 (drops 'T_' and a common package token)."""
    stripped = [n[2:] if n.startswith("T_") else n for n in names]
    toks = [s.split("_") for s in stripped]
    if len(stripped) > 1 and len({t[0] for t in toks}) == 1 and all(len(t) > 1 for t in toks):
        stripped = ["_".join(t[1:]) for t in toks]
    return dict(zip(names, stripped))


def extract_spec(path, tex_dir=None):
    fx = read_effect(path)
    tex_names = clean_tex_names([t.read().m_Name for t in fx["texs"].values()])
    if tex_dir:
        os.makedirs(tex_dir, exist_ok=True)
        for t in fx["texs"].values():
            tt = t.read()
            tt.image.save(os.path.join(tex_dir, tex_names[tt.m_Name] + ".png"))
    out = {"name": fx["pkg"], "prefab": fx["prefab"], "systems": []}
    for name, tr, ps, psr in fx["systems"]:
        s = core.ps_to_spec(ps, name)
        info = _mat_info(fx, psr["m_Materials"][0]["m_PathID"])
        s["texture"] = tex_names[info["texture"]].lower()
        s["blend"] = info["blend"]
        if info["tint"] != [1.0, 1.0, 1.0, 1.0]:
            s["tint"] = info["tint"]
        if "flipbook" in s:
            s["flipbook"]["blend"] = info["flipbook_blend"]
        if "trail" in s and len(psr["m_Materials"]) > 1 and psr["m_Materials"][1]["m_PathID"]:
            ti = _mat_info(fx, psr["m_Materials"][1]["m_PathID"])
            s["trail"]["texture"] = tex_names[ti["texture"]].lower()
        pos = [round(tr["m_LocalPosition"][k], 4) for k in "xyz"]
        if pos != [0, 0, 0]:
            s["position"] = pos
        eul = core.quat_to_euler(*(tr["m_LocalRotation"][k] for k in "xyzw"))
        if any(abs(a) > 1e-3 for a in eul):
            s["rotationEuler"] = eul
        sc = [round(tr["m_LocalScale"][k], 4) for k in "xyz"]
        if sc != [1, 1, 1]:
            s["scale"] = sc
        rd = {}
        if psr["m_RenderMode"]:
            rd["mode"] = {v: k for k, v in core.RENDER_MODES.items()}.get(psr["m_RenderMode"], "billboard")
        if psr["m_SortingOrder"]:
            rd["sortingOrder"] = psr["m_SortingOrder"]
        if rd:
            s["render"] = rd
        out["systems"].append(s)
    return out


def summary(path):
    z = zipfile.ZipFile(path)
    fx = read_effect(path)
    lines = [".fab: %s (%.1f KB)" % (path, os.path.getsize(path) / 1024),
             "package: %s  prefab: %s  platforms: %s" % (fx["pkg"], fx["prefab"], ", ".join(platforms(z)))]
    for plat in platforms(z):
        sz = {n.split("/")[-1]: i.file_size for n, i in ((i.filename, i) for i in z.infolist()) if n.startswith(plat + "/") and n.endswith(".ab")}
        lines.append("  %-8s entry0 %6.1f KB   dependencie1 %6.1f KB" % (plat, sz.get("entry0.ab", 0) / 1024, sz.get("dependencie1.ab", 0) / 1024))
    total = 0
    for name, tr, ps, psr in fx["systems"]:
        i = ps["InitialModule"]
        total += i["maxNumParticles"]
        mods = [m.replace("Module", "") for m in ("ColorModule", "SizeModule", "RotationModule", "VelocityModule", "UVModule", "TrailModule") if ps[m]["enabled"]]
        info = _mat_info(fx, psr["m_Materials"][0]["m_PathID"])
        lines.append("  %-14s max %-3d life %-9s size %-10s %-8s tex %-16s mods %s" % (
            name, i["maxNumParticles"], core.read_mm(i["startLifetime"]), core.read_mm(i["startSize"]), info["blend"], info["texture"], "+".join(mods)))
    lines.append("  total max particles: %d, materials: %d, textures: %d" % (total, len(fx["mats"]), len(fx["texs"])))
    return "\n".join(lines)


def check(path):
    """Structural checks. Returns list of problems (empty = OK)."""
    problems = []
    z = zipfile.ZipFile(path)
    pkg = _pkg(z)
    idx = {n: z.read(n) for n in z.namelist() if not n.endswith("/") and "/" not in n}
    for need in ("FEPrefabManifest.json", pkg + ".pck", pkg + "_assets.txt", pkg + "_bundles.txt", pkg + "_meta.txt", "Manifest.json"):
        if need not in idx:
            problems.append("missing %s" % need)
    plats = platforms(z)
    if not plats:
        problems.append("no platform folders")
    for plat in plats:
        try:
            fx = read_effect(path, plat)
        except Exception as e:  # noqa: BLE001
            problems.append("%s: cannot read (%s)" % (plat, e))
            continue
        dep_ids = set(fx["dep"].objects.keys())
        ent_ids = set(fx["ent"].objects.keys())
        mat_ids = set(fx["mats"].keys())
        for name, tr, ps, psr in fx["systems"]:
            for slot in psr["m_Materials"]:
                if slot["m_PathID"] and (slot["m_FileID"] != 1 or slot["m_PathID"] not in mat_ids):
                    problems.append("%s/%s: material reference %s does not resolve" % (plat, name, slot["m_PathID"]))
            if ps["InitialModule"]["maxNumParticles"] < 1:
                problems.append("%s/%s: maxNumParticles < 1" % (plat, name))
        ext = [e.path for e in fx["ent"].externals]
        dep_cab = fx["dep"].name.lower()
        if not any(dep_cab in p.lower() for p in ext):
            problems.append("%s: entry external does not point at %s (%s)" % (plat, dep_cab, ext))
        for pid, t in fx["texs"].items():
            tt = t.read()
            try:
                img = tt.image
                if img.width != tt.m_Width:
                    problems.append("%s: texture %s decodes to wrong size" % (plat, tt.m_Name))
            except Exception as e:  # noqa: BLE001
                problems.append("%s: texture %s does not decode (%s)" % (plat, tt.m_Name, e))
        shaders = [o for o in fx["dep"].objects.values() if o.type.name == "Shader"]
        if len(shaders) != 1:
            problems.append("%s: expected 1 shader, found %d" % (plat, len(shaders)))
        for m in fx["mats"].values():
            if m["m_ShaderKeywords"] not in ("_ALPHABLEND_ON", "_ALPHABLEND_ON _REQUIRE_UV2"):
                problems.append("%s: material %s uses keywords '%s' (shader only has the sample's two variants)" % (plat, m["m_Name"], m["m_ShaderKeywords"]))
    return problems


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fab")
    ap.add_argument("--spec")
    ap.add_argument("--textures")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if a.spec or a.textures:
        spec = extract_spec(a.fab, a.textures)
        if a.spec:
            with open(a.spec, "w", encoding="utf8") as f:
                json.dump(spec, f, indent=2)
            print("spec written to", a.spec)
    print(summary(a.fab))
    if a.check:
        p = check(a.fab)
        print("CHECK:", "OK" if not p else "\n  " + "\n  ".join(p))
        sys.exit(1 if p else 0)


if __name__ == "__main__":
    main()
