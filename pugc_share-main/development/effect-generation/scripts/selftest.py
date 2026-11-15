#!/usr/bin/env python
"""Quick health check: dependencies, then rebuild the artist's sample from its spec and compare.

    python selftest.py

Exit code 0 = the Unity-free pipeline works on this machine.
"""
import importlib
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

missing = []
for mod, pip in (("UnityPy", "UnityPy"), ("PIL", "Pillow"), ("numpy", "numpy"), ("etcpak", "etcpak"), ("texture2ddecoder", "texture2ddecoder")):
    try:
        importlib.import_module(mod)
    except ImportError:
        missing.append(pip)
if missing:
    sys.exit("Missing packages: %s\nInstall: %s -m pip install -r %s" % (", ".join(missing), sys.executable, os.path.join(HERE, "requirements.txt")))

import fab_build  # noqa: E402
import fab_inspect  # noqa: E402

spec = os.path.join(os.path.dirname(HERE), "examples", "universe_aura.json")
out = tempfile.mkdtemp(prefix="fab_selftest_")
import json
fab, _, _, _ = fab_build.build(json.load(open(spec, encoding="utf8")), out, log=lambda *_: None)
problems = fab_inspect.check(fab)
a = fab_inspect.extract_spec(os.path.join(os.path.dirname(HERE), "assets", "template", "universe_effect.fab"))
b = fab_inspect.extract_spec(fab)
diffs = [(x["name"], k) for x, y in zip(a["systems"], b["systems"]) for k in set(x) | set(y) if k != "texture" and x.get(k) != y.get(k)]
import fab_lint  # noqa: E402
# art review: the artist's own effect is the calibration point (no notes); a flat one-hue additive blob gets them
art_ref = fab_lint.art_review(fab_build.normalize(json.load(open(spec, encoding="utf8")))["systems"])
flat = [{"name": "S%d" % i, "blend": "additive", "maxParticles": 8, "size": 1.0, "duration": 2,
         "color": [1, 0, 1, 1]} for i in range(3)]
art_flat = fab_lint.art_review(flat)
assert not art_ref, art_ref
for key in ("hot core", "one hue", "size contrast", "constant", "clip", "all layers additive", "in sync"):
    assert any(key in n for n in art_flat), (key, art_flat)
print("art review: OK")
print("integrity:", "OK" if not problems else problems)
print("round-trip differences vs the artist's sample:", diffs or "none")
print("built:", fab)
sys.exit(1 if problems or diffs else 0)
