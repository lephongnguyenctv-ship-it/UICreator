#!/usr/bin/env python
"""Build a Craftland Studio .fab from a JSON effect spec. No Unity editor needed.

    python fab_build.py spec.json [-o out_dir] [--copy-to <Craftland Assets>] [--platforms IOS,Android,PC,WebGL]
                                   [--tex-dir <folder with extra png>] [--strict]

How it works: the sample .fab (assets/template/universe_effect.fab, built by Unity 2018.4.11f1) is the template.
Its shaders (per platform) are kept; everything else (GameObjects, ParticleSystems, materials, textures, bundle
index) is regenerated with UnityPy. The result is the same package layout the Unity exporter produced.
"""
import argparse
import copy
import hashlib
import io
import json
import os
import shutil
import sys
import zipfile
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import UnityPy  # noqa: E402
from UnityPy.streams import EndianBinaryWriter  # noqa: E402

import fab_core as core  # noqa: E402
import fab_lint  # noqa: E402
import fab_textures as ft  # noqa: E402

ROOT = os.path.dirname(HERE)
TEMPLATE = os.path.join(ROOT, "assets", "template", "universe_effect.fab")
PLATFORMS = ["IOS", "Android", "PC", "WebGL"]      # order = preference for the hashes written in the index


# ------------------------------------------------------------------ spec normalisation (v1 -> v2)

def normalize(spec):
    spec = copy.deepcopy(spec)
    spec["name"] = core.safe_name(spec.get("name", "effect"))
    base = spec["name"][7:] if spec["name"].startswith("effect_") else spec["name"]
    spec.setdefault("prefab", "Effect_" + "".join(w.capitalize() for w in base.split("_")))
    spec.setdefault("folder", core.title_name(spec["name"]))
    for i, s in enumerate(spec["systems"]):
        s.setdefault("name", "System%d" % i)
        s["name"] = str(s["name"])
        if "additive" in s and "blend" not in s:
            s["blend"] = "additive" if s["additive"] else "alpha"
        s.setdefault("blend", "additive")
        s.setdefault("texture", "glow")
        if s.get("colorEnd") and "colorOverLife" not in s:
            c = s.get("color", [1, 1, 1, 1])
            c0 = c if isinstance(c, list) else [1, 1, 1, 1]
            s["colorOverLife"] = [[0.0] + [float(x) for x in c0[:3]] + [1.0], [1.0] + [float(x) for x in s["colorEnd"][:3]] + [float(s["colorEnd"][3]) if len(s["colorEnd"]) > 3 else 1.0]]
        if "sizeEnd" in s and "sizeOverLife" not in s and isinstance(s.get("size"), (int, float)) and s["size"]:
            s["sizeOverLife"] = [[0.0, 1.0], [1.0, max(0.0, s["sizeEnd"] / s["size"])]]
        if "spin" in s and "rotationOverLife" not in s:
            s["rotationOverLife"] = s["spin"] * 57.29578
        if "tilt" in s:
            s.setdefault("rotationEuler", s["tilt"])
        if s.get("trail") is True:
            s["trail"] = {}
    return spec


# ------------------------------------------------------------------ template

def load_template(path=TEMPLATE):
    z = zipfile.ZipFile(path)
    return {n: z.read(n) for n in z.namelist() if not n.endswith("/")}


def _by_type(sf):
    d = {}
    for o in sf.objects.values():
        d.setdefault(o.type.name, []).append(o)
    return d


def _clone(sf, proto, pid, tt):
    r = copy.copy(proto)
    r.path_id = pid
    r.data = None
    r.save_typetree(tt)
    sf.objects[pid] = r
    return r


def _rename_cab(bf, sf, old, new):
    """Rename a CAB inside the bundle (and its .resS)."""
    files = OrderedDict()
    for k, v in bf.files.items():
        files[k.replace(old, new)] = v
    bf.files = files
    sf.name = new


# ------------------------------------------------------------------ dependency bundle (materials, textures, shader)

def build_dep(tpl, platform, plan, cab_dep):
    env = UnityPy.load(tpl["%s/universe_effect/dependencie1.ab" % platform])
    bf = env.file
    sf = list(env.assets)[0]
    by = _by_type(sf)
    old_cab = sf.name
    tex_proto, mat_proto = by["Texture2D"][0], by["Material"][0]
    tex_base = tex_proto.read_typetree()
    shader_pid = by["Shader"][0].path_id
    ab_obj = by["AssetBundle"][0]
    mat_bases = {}
    for m in by["Material"]:
        tt = m.read_typetree()
        mat_bases[tt["m_Name"]] = tt
    add_base = mat_bases["M_UA_Glow"]
    alpha_base = mat_bases["M_UA_Earth"]

    for o in by["Texture2D"] + by["Material"]:
        del sf.objects[o.path_id]
    # WebGL bundles keep texture data inline; the other platforms stream it from a .resS file next to the CAB
    resS_old = next((k for k in bf.files if k.endswith(".resS")), None)
    flags = bf.files[resS_old].flags if resS_old else 0

    res = bytearray()
    container, preload = [], []

    def entry(path, items, asset_pid):
        container.append((path, {"preloadIndex": len(preload), "preloadSize": len(items),
                                 "asset": core.ref(asset_pid)}))
        preload.extend(items)

    stream_path = "archive:/%s/%s.resS" % (cab_dep, cab_dep)
    sizes = {}
    for t in plan["textures"]:
        data, w, h, mips, fmt = ft.encode_chain(t["image"], platform)
        tt = copy.deepcopy(tex_base)
        tt.update({"m_Name": t["asset_name"], "m_Width": w, "m_Height": h, "m_CompleteImageSize": len(data),
                   "m_TextureFormat": fmt, "m_MipCount": mips, "image data": b"" if resS_old else data})
        if resS_old:
            tt["m_StreamData"] = {"offset": len(res), "size": len(data), "path": stream_path}
            res += data
            while len(res) % 16:
                res += b"\0"
        else:
            tt["m_StreamData"] = {"offset": 0, "size": 0, "path": ""}
        _clone(sf, tex_proto, t["pid"], tt)
        sizes[t["asset_name"]] = (w, h, mips, len(data), fmt)
        entry("assets/%s/textures/%s.png" % (plan["folder_lc"], t["asset_name"].lower()), [core.ref(t["pid"])], t["pid"])

    for m in plan["materials"]:
        tt = copy.deepcopy(add_base if m["blend"] == "additive" else alpha_base)
        tt["m_Name"] = m["asset_name"]
        tt["m_Shader"] = core.ref(shader_pid)
        sp = tt["m_SavedProperties"]
        for k, v in sp["m_TexEnvs"]:
            if k == "_MainTex":
                v["m_Texture"] = core.ref(m["tex_pid"])
                v["m_Scale"] = {"x": 1.0, "y": 1.0}
                v["m_Offset"] = {"x": 0.0, "y": 0.0}
        floats = dict((k, v) for k, v in sp["m_Floats"])
        floats["_Mode"] = 4.0 if m["blend"] == "additive" else 2.0
        floats["_SrcBlend"] = 5.0
        floats["_DstBlend"] = 1.0 if m["blend"] == "additive" else 10.0
        floats["_ZWrite"] = 0.0
        floats["_Cull"] = 0.0
        floats["_FlipbookMode"] = 1.0 if m["flipbook_blend"] else 0.0
        sp["m_Floats"] = [(k, floats[k]) for k, _ in sp["m_Floats"]]
        sp["m_Colors"] = [(k, ({"r": m["tint"][0], "g": m["tint"][1], "b": m["tint"][2], "a": m["tint"][3]} if k == "_Color" else v))
                          for k, v in sp["m_Colors"]]
        tt["m_ShaderKeywords"] = "_ALPHABLEND_ON" + (" _REQUIRE_UV2" if m["flipbook_blend"] else "")
        tt["m_CustomRenderQueue"] = 3000
        _clone(sf, mat_proto, m["pid"], tt)
        t_ref = core.ref(m["tex_pid"])
        entry("assets/%s/materials/%s.mat" % (plan["folder_lc"], m["asset_name"].lower()),
              [core.ref(0, 1)] + [t_ref, core.ref(m["pid"]), core.ref(shader_pid)], m["pid"])

    ab = ab_obj.read_typetree()
    ab["m_Name"] = ab["m_AssetBundleName"] = "%s/dependencie1.ab" % plan["pkg"]
    ab["m_PreloadTable"] = preload
    ab["m_Container"] = container
    ab_obj.save_typetree(ab)

    if resS_old:
        w = EndianBinaryWriter()
        w.write_bytes(bytes(res))
        w.flags = flags
        bf.files[resS_old] = w
    _rename_cab(bf, sf, old_cab, cab_dep)
    return bf.save(packer="lz4"), sizes


# ------------------------------------------------------------------ entry bundle (prefab)

def build_entry(tpl, platform, spec, plan, cab_entry, cab_dep):
    env = UnityPy.load(tpl["%s/universe_effect/entry0.ab" % platform])
    bf = env.file
    sf = list(env.assets)[0]
    by = _by_type(sf)
    old_cab = sf.name
    protos = {k: by[k][0] for k in ("GameObject", "Transform", "ParticleSystem", "ParticleSystemRenderer")}
    ps_base = next(o.read_typetree() for o in by["ParticleSystem"] if o.read_typetree()["TrailModule"]["enabled"])
    psr_base = protos["ParticleSystemRenderer"].read_typetree()
    tr_base = protos["Transform"].read_typetree()
    go_base = protos["GameObject"].read_typetree()
    ab_obj = by["AssetBundle"][0]
    for k in ("GameObject", "Transform", "ParticleSystem", "ParticleSystemRenderer"):
        for o in by[k]:
            del sf.objects[o.path_id]

    pkg = plan["pkg"]
    root_go, root_tr = core.pid_for(pkg + "/root/go"), core.pid_for(pkg + "/root/tr")
    child_trs, local = [], [root_go, root_tr]
    for i, s in enumerate(spec["systems"]):
        go, tr = core.pid_for("%s/%d/go" % (pkg, i)), core.pid_for("%s/%d/tr" % (pkg, i))
        ps, psr = core.pid_for("%s/%d/ps" % (pkg, i)), core.pid_for("%s/%d/psr" % (pkg, i))
        child_trs.append(tr)
        local += [go, tr, ps, psr]

        g = copy.deepcopy(go_base)
        g.update({"m_Name": s["name"], "m_Component": [{"component": core.ref(x)} for x in (tr, ps, psr)],
                  "m_Layer": 0, "m_IsActive": True})
        _clone(sf, protos["GameObject"], go, g)

        pos = s.get("position", [0, 0, 0])
        eul = s.get("rotationEuler", s.get("tilt", [0, 0, 0]))
        q = core.euler_to_quat(*eul)
        t = copy.deepcopy(tr_base)
        t.update({"m_GameObject": core.ref(go), "m_LocalRotation": dict(zip("xyzw", q)),
                  "m_LocalPosition": dict(zip("xyz", map(float, pos))),
                  "m_LocalScale": dict(zip("xyz", map(float, s.get("scale", [1, 1, 1])))),
                  "m_Children": [], "m_Father": core.ref(root_tr)})
        _clone(sf, protos["Transform"], tr, t)

        _clone(sf, protos["ParticleSystem"], ps, core.ps_from_spec(ps_base, s, go))

        r = copy.deepcopy(psr_base)
        rd = s.get("render", {})
        r["m_GameObject"] = core.ref(go)
        mat, trail_mat = plan["sys_mats"][i]
        r["m_Materials"] = [core.ref(mat, 1), core.ref(trail_mat, 1) if trail_mat else core.ref(0)]
        r["m_RenderMode"] = core.RENDER_MODES[rd.get("mode", "billboard")]
        r["m_SortingOrder"] = int(rd.get("sortingOrder", 0))
        r["m_SortingFudge"] = float(rd.get("sortingFudge", 0.0))
        r["m_MaxParticleSize"] = float(rd.get("maxSize", 0.5))
        r["m_MinParticleSize"] = float(rd.get("minSize", 0.0))
        if r["m_RenderMode"] == 1:
            r["m_LengthScale"] = float(rd.get("lengthScale", 2.0))
            r["m_VelocityScale"] = float(rd.get("velocityScale", 0.0))
        _clone(sf, protos["ParticleSystemRenderer"], psr, r)

    g = copy.deepcopy(go_base)
    g.update({"m_Name": spec["prefab"], "m_Component": [{"component": core.ref(root_tr)}], "m_Layer": 0, "m_IsActive": True})
    _clone(sf, protos["GameObject"], root_go, g)
    t = copy.deepcopy(tr_base)
    t.update({"m_GameObject": core.ref(root_go), "m_LocalRotation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0},
              "m_LocalPosition": {"x": 0.0, "y": 0.0, "z": 0.0}, "m_LocalScale": {"x": 1.0, "y": 1.0, "z": 1.0},
              "m_Children": [core.ref(x) for x in child_trs], "m_Father": core.ref(0)})
    _clone(sf, protos["Transform"], root_tr, t)

    ext_mats = sorted({m for pair in plan["sys_mats"] for m in pair if m})
    preload = [core.ref(x) for x in sorted(local)] + [core.ref(x, 1) for x in ext_mats]
    ab = ab_obj.read_typetree()
    ab["m_Name"] = ab["m_AssetBundleName"] = "%s/entry0.ab" % pkg
    ab["m_PreloadTable"] = preload
    ab["m_Container"] = [("assets/%s/%s.prefab" % (plan["folder_lc"], spec["prefab"].lower()),
                          {"preloadIndex": 0, "preloadSize": len(preload), "asset": core.ref(root_go)})]
    ab["m_Dependencies"] = ["%s/dependencie1.ab" % pkg]
    ab_obj.save_typetree(ab)

    for e in sf.externals:
        if e.path.lower().startswith("archive:/cab-"):
            e.path = "archive:/%s/%s" % (cab_dep.lower(), cab_dep.lower())
    _rename_cab(bf, sf, old_cab, cab_entry)
    return bf.save(packer="lz4")


# ------------------------------------------------------------------ plan (textures + materials shared between systems)

def make_plan(spec, tex_dirs, log):
    pkg = spec["name"]
    plan = {"pkg": pkg, "folder_lc": spec["folder"].lower(), "textures": [], "materials": [], "sys_mats": []}
    tex_by_ref, mat_by_key = {}, {}

    def texture(ref):
        key = json.dumps(ref, sort_keys=True) if isinstance(ref, dict) else (ref.lower() if not os.path.isfile(ref) else os.path.abspath(ref))
        if key not in tex_by_ref:
            img, name, origin = ft.load_texture(ref, tex_dirs)
            if origin == "generated":
                log("  texture '%s' not found: auto-generated as '%s'. Pass a PNG to replace it." % (name, ft.resolve_kind(ref, tex_dirs)[1]))
            img, changed = ft.to_pot(img)
            if changed:
                log("  texture '%s' resized to %dx%d (power of two, <= %d)" % (name, img.width, img.height, ft.MAX_SIDE))
            asset = "T_%s_%s" % (core.title_name(pkg).replace("_", ""), core.title_name(name).replace("_", ""))
            if any(t["asset_name"] == asset for t in plan["textures"]):
                asset += "_%d" % len(plan["textures"])
            t = {"image": img, "asset_name": asset, "pid": core.pid_for(pkg + "/tex/" + key), "origin": origin}
            plan["textures"].append(t)
            tex_by_ref[key] = t
        return tex_by_ref[key]

    def material(ref, blend, tint, fb_blend):
        t = texture(ref)
        key = (t["asset_name"], blend, tuple(tint), fb_blend)
        if key not in mat_by_key:
            n = "M_" + t["asset_name"][2:] + ("" if blend == "additive" else "_Alpha") + ("_Flip" if fb_blend else "")
            n += "" if all(m["asset_name"] != n for m in plan["materials"]) else "_%d" % len(plan["materials"])
            m = {"asset_name": n, "pid": core.pid_for(pkg + "/mat/" + repr(key)), "tex_pid": t["pid"], "blend": blend,
                 "tint": tint, "flipbook_blend": fb_blend}
            plan["materials"].append(m)
            mat_by_key[key] = m
        return mat_by_key[key]["pid"]

    for s in spec["systems"]:
        tint = [float(x) for x in s.get("tint", [1, 1, 1, 1])]
        tint += [1.0] * (4 - len(tint))
        fb = s.get("flipbook")
        mat = material(s["texture"], s["blend"], tint, bool(fb and fb.get("blend", True)))
        trail = s.get("trail")
        tmat = None
        if trail is not None and trail is not False:
            tmat = material(trail.get("texture", "trail"), trail.get("blend", "additive"), [1.0, 1.0, 1.0, 1.0], False)
        plan["sys_mats"].append((mat, tmat))
    return plan


# ------------------------------------------------------------------ package index files

class Pb:
    def __init__(self):
        self.b = bytearray()

    def _v(self, v):
        while v >= 0x80:
            self.b.append((v & 0x7F) | 0x80)
            v >>= 7
        self.b.append(v)

    def _bytes(self, f, data):
        self._v(f << 3 | 2)
        self._v(len(data))
        self.b += data

    def uint(self, f, v):
        self._v(f << 3)
        self._v(v)

    def s(self, f, v):
        self._bytes(f, v.encode("utf8"))

    def m(self, f, p):
        self._bytes(f, bytes(p.b))


def index_files(pkg, folder, prefab, hashes, sizes):
    dep, ent = pkg + "/dependencie1.ab", pkg + "/entry0.ab"
    path = "Assets/%s/%s.prefab" % (folder, prefab)
    guid = hashlib.md5(path.encode()).hexdigest()
    out = OrderedDict()
    out["FEPrefabManifest.json"] = ('{"Name":null,"UUID":null,"Type":null,"Version":0,"IsFFBuildinRes":false,'
                                    '"Children":null,"Sprite":null,"AnimationClip":null,"SubMeshCount":0}').encode()
    bundles = Pb()
    d = Pb(); d.s(1, dep); d.s(2, hashes[dep]); d.uint(3, sizes[dep]); bundles.m(1, d)
    e = Pb(); e.s(1, ent); e.s(2, hashes[ent]); e.uint(3, sizes[ent]); e.s(4, dep); bundles.m(1, e)
    pck = Pb()
    pck.s(1, pkg); pck.s(2, "fab_" + pkg); pck.uint(4, 1); pck.s(7, "1"); pck.m(9, bundles)
    a = Pb(); a.s(1, guid); a.uint(2, 15); a.s(3, path); a.s(4, ent); a.uint(5, 1); pck.m(10, a)
    out[pkg + ".pck"] = bytes(pck.b)
    out[pkg + "_assets.txt"] = ("%s|ABGameObjectRes|%s|%s\r\n" % (guid, path, ent)).encode()
    out[pkg + "_bundles.txt"] = ("%s|%s|0\r\n%s|%s|1|%s\r\n" % (hashes[dep], dep, hashes[ent], ent, dep)).encode()
    out[pkg + "_meta.txt"] = ("Name:%s\r\nUUID:fab_%s\r\nPackageType:UnityBundle\r\nUseableType:ClientOnly\r\n"
                              "Version:1\r\nPlatform:Any\r\n" % (pkg, pkg)).encode()

    def q(s):
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'

    def node(name, uuid, typ, ver, children):
        c = "null" if children is None else "[" + ",".join(children) + "]"
        return ('{"Name":%s,"UUID":%s,"Type":%s,"Version":%d,"IsFFBuildinRes":false,"Children":%s,'
                '"Sprite":null,"AnimationClip":null,"SubMeshCount":0}' % (q(name), q(uuid), q(typ), ver, c))
    leaf = node(prefab + ".prefab", guid, "ABGameObjectRes", 0, None)
    tree = node(pkg, "fab_" + pkg, "Folder", 1, [node("Assets", "", "Folder", 0, [node(folder, "", "Folder", 0, [leaf])])])
    out["Manifest.json"] = tree.encode()
    return out, guid


def write_fab(path, index, bundles):
    names = list(index.keys())
    first = ["FEPrefabManifest.json"] + [n for n in names if n.endswith(".pck")] + [n for n in names if n.endswith("_assets.txt")] + \
            [n for n in names if n.endswith("_bundles.txt")] + [n for n in names if n.endswith("_meta.txt")] + ["Manifest.json"]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for n in first:
            z.writestr(n, index[n])
        done = set()
        for plat, name, data in bundles:
            if plat not in done:
                z.writestr(plat + "/", b"")
                z.writestr("%s/%s/" % (plat, name.split("/")[0]), b"")
                done.add(plat)
            z.writestr("%s/%s" % (plat, name), data)


# ------------------------------------------------------------------ main build

def build(spec_in, out_dir, platforms=None, tex_dirs=(), strict=False, log=print, tier=None):
    spec = normalize(spec_in)
    report = fab_lint.lint(spec, tex_dirs, tier)
    for line in report["lines"]:
        log(line)
    if report["errors"] or (strict and report["warnings"]):
        raise SystemExit("spec rejected (%d errors, %d warnings). Fix the spec and run again." % (len(report["errors"]), len(report["warnings"])))

    tpl = load_template()
    pkg = spec["name"]
    plan = make_plan(spec, tex_dirs, log)
    cab_dep, cab_entry = "CAB-" + core.md5hex(pkg + "/dep"), "CAB-" + core.md5hex(pkg + "/entry")
    bundles, hashes, sizes, tex_sizes = [], {}, {}, {}
    for plat in [p for p in PLATFORMS if not platforms or p in platforms]:
        log("[fab] building %s ..." % plat)
        dep, tex_sizes[plat] = build_dep(tpl, plat, plan, cab_dep)
        ent = build_entry(tpl, plat, spec, plan, cab_entry, cab_dep)
        for name, data in ((pkg + "/dependencie1.ab", dep), (pkg + "/entry0.ab", ent)):
            bundles.append((plat, name, data))
            if name not in hashes:                  # first platform wins, like the sample (IOS)
                hashes[name] = hashlib.md5(data).hexdigest()
                sizes[name] = len(data)
    index, guid = index_files(pkg, spec["folder"], spec["prefab"], hashes, sizes)
    os.makedirs(out_dir, exist_ok=True)
    fab = os.path.join(out_dir, pkg + ".fab")
    write_fab(fab, index, bundles)
    return fab, spec, plan, tex_sizes


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec")
    ap.add_argument("-o", "--out", default=None, help="output folder (default: next to the spec)")
    ap.add_argument("--copy-to", default=None, help="Craftland project Assets folder; an existing file is backed up")
    ap.add_argument("--platforms", default=None, help="comma list, default all four")
    ap.add_argument("--tex-dir", action="append", default=[], help="extra folder with .png textures")
    ap.add_argument("--strict", action="store_true", help="treat lint warnings as errors")
    ap.add_argument("--tier", choices=list(fab_lint.TIERS), help="device budget low|mid|high (default: spec 'tier' or low)")
    a = ap.parse_args()

    spec = json.load(open(a.spec, encoding="utf8"))
    out_dir = a.out or os.path.join(os.path.dirname(os.path.abspath(a.spec)), "fab_out")
    fab, spec, plan, tex_sizes = build(spec, out_dir, a.platforms.split(",") if a.platforms else None, a.tex_dir, a.strict, tier=a.tier)

    import fab_inspect
    print(fab_inspect.summary(fab))
    if a.copy_to:
        os.makedirs(a.copy_to, exist_ok=True)
        dest = os.path.join(a.copy_to, os.path.basename(fab))
        if os.path.exists(dest):
            bak = os.path.join(out_dir, os.path.basename(fab) + ".bak")
            shutil.copy2(dest, bak)
            print("[fab] existing file backed up to", bak)
        shutil.copy2(fab, dest)
        print("[fab] copied to", dest)
    print("[fab] done. Import the .fab in Craftland Studio and check that '%s' appears." % spec["prefab"])


if __name__ == "__main__":
    main()
