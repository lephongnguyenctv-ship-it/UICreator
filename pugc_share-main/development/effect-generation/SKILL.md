---
name: craftland-effect-pipeline
description: Turn a text prompt describing a particle effect (e.g. "effect ABC: glowing cyan ring orbiting with sparks") into a Craftland Studio .fab package WITHOUT Unity. Writes a JSON spec in the artist's style (layers, random gradients, fades, orbiting bodies, flipbooks, trails), lints it against the sample's budget, previews it, builds the .fab for IOS/Android/PC/WebGL with Python, and verifies it. Use whenever the user asks to create, generate, make, tweak, inspect or export an effect for Craftland / the game editor / .fab, or to read an existing .fab.
---

# Prompt -> Craftland `.fab` (Unity-free)

Input: a short description of an effect. Output: `<name>.fab` that Craftland Studio can import.

No Unity editor is needed. The reference `.fab` made by the artist (built with Unity 2018.4.11f1) is the template:
its per-platform shader is kept and everything else is rewritten with UnityPy. The result has the same package
layout the Unity exporter produced (the index files are byte-identical to the sample's format).

Read `references/artist-style.md` before writing a spec. It explains why the reference effect looks good and
stays light, and has copy-paste recipes.

## Setup (once)

Python 3.10+ and:

```bash
python -m pip install -r "<skill folder>/scripts/requirements.txt"
python "<skill folder>/scripts/selftest.py"
```

`selftest.py` rebuilds the artist's sample from its spec and checks it. If it prints `integrity: OK` and
`round-trip differences ... none`, the pipeline works on this machine.

## Pipeline

0. **Prompt intake: turn the user's request into a concrete effect brief before anything else.**
   Never design from a vague line like "cool fire effect". Silently extract the 9 fields below from the
   request; anything missing is either a clear default (state it) or one question.
   - **Purpose**: aura / buff / pickup / zone / hit, and where it sits (feet, around body, above head, ground).
     It sets footprint and brightness (`references/artist-style.md` 3b). Default: aura around the player.
   - **Subject**: what the effect IS (a ring, a flame, a portal), one noun phrase, no adjectives alone.
   - **Motion**: what moves and how (orbits, rises, pulses, bursts), with direction and speed feel (slow/med/fast).
   - **Palette**: dominant / secondary / accent hues (60/30/10) plus a near-white core. "Colourful" is not a
     palette: pick hues (mood table in artist-style 3b).
   - **Layers**: hero (1 particle or main shape) + 2-3 supports (glow, sparks, smoke, trail), sized big / medium / small.
   - **Timing**: looping or one-shot, duration in seconds, any build-up/fade.
   - **Textures**: library name, generator name, or user PNG per layer (see Textures table).
   - **Tier**: `low` / `mid` / `high` (budgets in "Device tiers").
   - **Success check**: 2-3 binary checks, e.g. "lint 0 errors", "max particles <= tier budget",
     "reads as <subject> in the dark AND day preview sheets".

   Ask **at most 3 questions**, in ONE `AskUserQuestion` call, only for fields that change the result and
   cannot be defaulted. **The tier question is mandatory** (options `low`, `mid`, `high`; do not assume `low`)
   unless the user already named the tier. Replace vague words with measurable values: "fast" -> speed 2-4,
   "small" -> size 0.3-0.6, "dense" -> particles near the tier's per-system cap, "glowing" -> additive + soft
   texture, "subtle" -> low alpha + few particles.

   Then write the brief back to the user as a short block (one line per field, defaults marked
   `(default)`), and build from THAT brief, not from the raw prompt. If the user's request contradicts the
   tier budget, say so and propose the cut; do not silently drop layers. Use the final tier as `"tier"` in
   the spec and pass `--tier <answer>` to `fab_lint.py` / `fab_build.py`.

   Example. Request: "effect lửa đẹp". Brief: Purpose: aura at the player's feet (default). Subject: campfire
   flame column. Motion: flame rises slowly, embers drift up fast. Palette: orange dominant, deep red base,
   yellow-white core, no extra accent (fire is analogous). Layers: flame (hero, `flame`, medium), glow (`glow`,
   big), 6 embers (`dot`, tiny). Timing: loop, flame 2.3 s / glow 3.1 s. Textures: generated `flame`, library
   `glow`. Tier: asked. Checks: lint 0 errors; <= tier particles; dark and day sheets read as fire.
1. **Design** the effect from the brief with `references/artist-style.md` section 3b (purpose, value ladder,
   60/30/10 colour, big/medium/small, motion rhythm, daylight) and the checklist at its end. Then the particle
   budget for the chosen tier and textures from the library.
2. **Write the spec** (JSON, schema below) to a work folder, for example `fx/<name>.json`.
3. **Lint**: `python scripts/fab_lint.py fx/<name>.json`. Fix every ERROR and read each WARNING. `art` lines are
   design advice: fix them, or tell the user why the effect breaks that rule on purpose.
4. **Preview** on both backgrounds:
   `python scripts/fab_preview.py fx/<name>.json -o fx/<name>.gif --sheet fx/<name>.png` and the same with
   `--bg day -o fx/<name>_day.gif --sheet fx/<name>_day.png` (bright map). Open both sheets and run the
   6-point art review in artist-style 3b; iterate until both pass. The preview is a rough software render, not
   the game: it checks composition, value and readability, not exact brightness.
5. **Build**: `python scripts/fab_build.py fx/<name>.json -o fx/out [--copy-to "<Craftland Assets folder>"]`.
   The build lints again, builds the 4 platforms, writes the `.fab`, prints a summary. An existing file at
   `--copy-to` is backed up to `fx/out/<name>.fab.bak`.
6. **Verify**: `python scripts/fab_inspect.py fx/out/<name>.fab --check` (build already prints the summary).
   It decodes every texture on every platform and checks that all references resolve and that materials use
   only the shader variants the bundle contains.
7. **Report** to the user: the `.fab` path and size, platforms, the summary (systems, max particles,
   materials, textures), lint warnings and remaining `art` notes, the art review result (one line each), where it was copied, and that they must **import it in Craftland
   Studio and look at it**. This skill cannot run the game.

Other commands:

```bash
python scripts/fab_inspect.py some.fab                       # what is inside
python scripts/fab_inspect.py some.fab --spec out.json --textures out_tex   # reverse: .fab -> spec + PNGs
python scripts/fab_preview.py some.fab -o some.gif           # preview an existing .fab
```

To learn from or tweak an existing effect: extract its spec with `--spec`, edit the JSON, build again.

## Spec schema

```json
{
  "name": "energy_ring",            // package + file name: a-z 0-9 _
  "prefab": "Effect_EnergyRing",    // optional, root GameObject name
  "systems": [ { ... }, { ... } ]
}
```

One entry in `systems` = one ParticleSystem child. All keys optional except `name`. Angles are **degrees**,
speeds in units/s, `orbit` in rad/s (the artist's values). "number or range": `0.5`, or `[0.3, 0.8]` for a
random value per particle.

| Key | Meaning |
|---|---|
| `name` | child GameObject name (unique) |
| `texture` | library name, procedural kind, or a PNG path (see below) |
| `blend` | `additive` (light, glow) or `alpha` (solid bodies). Default `additive` |
| `tint` | material colour `[r,g,b,a]`, default white |
| `position`, `tilt`, `scale` | local transform. `tilt` = euler degrees |
| `duration`, `loop`, `prewarm` | system duration (s), default `5`, `true`, `false` |
| `maxParticles`, `rate` | cap and particles per second |
| `bursts` | `[[time, count]]` or `[[time, min, max]]` (**unverified in game**) |
| `lifetime`, `speed`, `size` | number or range |
| `rotation` | start rotation (deg), number or range |
| `color` | `[r,g,b,a]`, `{"between":[c1,c2]}`, or `{"gradient":[[t,r,g,b,a],...],"random":true}` (random = pick one colour along the gradient per particle; without it the gradient runs over the lifetime) |
| `fade` | `[in, out]` fractions of lifetime for the alpha ramp. Default `[0.2, 0.3]`. `null` = none (only for 600 s bodies) |
| `colorOverLife` | explicit gradient `[[t,r,g,b,a],...]` or `{"color":[[t,r,g,b]],"alpha":[[t,a]]}`; replaces `fade` |
| `sizeOverLife` | curve `[[t, multiplier],...]` |
| `rotationOverLife` | deg/s, number or range |
| `velocity`, `orbit` | `[x,y,z]` linear velocity and orbital velocity (rad/s around local X/Y/Z) |
| `shape` | `"none"` or `{"type": sphere|cone|circle|..., "radius", "angle", "arc", "thickness", "scale", "rotation", "position"}` |
| `flipbook` | `{"tiles":[x,y], "cycles":1, "blend":true}` (texture sheet; `blend` = smooth frame blending) |
| `trail` | `true` or `{"lifetime","minVertexDistance","width":[[t,v],...],"widthScale","colorOverTrail","colorOverLife","texture"}` |
| `render` | `{"mode": billboard|horizontal (verified), stretch|vertical (unverified), "sortingOrder", "sortingFudge", "maxSize"}` |
| `smooth` | `true` = smooth tangents on this system's curves (default linear) |

The old v1 keys still work: `color`+`colorEnd`, `size`+`sizeEnd`, `orbitSpeed`, `spin`, `additive`, `tilt`,
`trail: true`, `shape` as a string with `radius`.

Textures, in lookup order: an existing file path, then the artist's library (`assets/textures`), then a
generator name, then **auto-generation**: a missing texture never stops the build. The name is matched by
keyword to a generator (`fire_ball` -> `flame`, `frost_crystal` -> `star6`, `magic circle` -> `ring`; unknown ->
`soft`), a white-RGB alpha mask is drawn (128 px, seeded by the name) and the build log says it was generated.
Force one with `"texture": {"gen": "lightning", "seed": 4, "size": 128, "name": "bolt"}`.

Library textures are 256x256 unless noted. `scripts/make_library_textures.py` regenerates the procedural ones (same bytes every run).
Names `dot`, `star6`, `flame`, `bubble` are library files now, so they override the generators of the same name.

| Name | What it is | Use | Flipbook tiles |
|---|---|---|---|
| `glow` | soft round falloff, white, 128 | light, dust, comet head | |
| `sparkle` | 4-ray star flare, white, 128 | stars, glints | |
| `cloud` | soft noisy cloud, white, 128 | nebula, smoke, aura volume | |
| `nebuladisc` | spiral galaxy disc, white | ground disc (`render.mode: horizontal`) | |
| `trail` | 128x32 streak, white, head left (iOS build squares it to 128x128) | trail ribbons | |
| `saturn` | coloured ringed planet, 128 | hero body, `blend: alpha` | |
| `earth_8x8` | coloured spinning Earth, 512 | hero body, `blend: alpha` | `[8,8]` |
| `sun_4x4` | coloured Sun | hero body, `blend: alpha` | `[4,4]` |
| `glow_soft` | soft round falloff (1-r)^2 | glow, light, soft dust | |
| `glow_hard` | bright core, short halo | hot core, muzzle/impact centre | |
| `dot` | solid disc, thin soft edge | particles, pixel sparks | |
| `ring_thin` | thin bright ring | halo, ripple, target marker | |
| `ring_thick` | wide flat-top ring | aura ring, ground zone | |
| `disc_soft` | filled disc, soft edge | ground fill, zone base | |
| `gradient_radial` | linear radial falloff | flat glow, fill light | |
| `gradient_linear` | ramp 0 left -> 1 right | wipes, beam ends, height fades | |
| `sparkle4` | 4-ray star | glints, twinkles | |
| `star6` | 6-ray star | magic/ice sparkles | |
| `flare_rays` | many thin random rays + core | sun flare, holy burst | |
| `lens_ring` | soft lens-flare halo ring | flare halo, buff ring | |
| `magic_circle` | rune ring + hexagram | spell circle (`horizontal`) | |
| `hex_shield` | hexagon of hex cells, bright rim | shield bubble, barrier | |
| `heal_cross` | plus sign with glow | heal pickup/buff | |
| `flame` | single teardrop flame | torch, flame column | |
| `fire_flipbook_4x4` | looping flame, noise scrolls up | fire column, burning | `[4,4]` |
| `smoke_puff` | lumpy smoke puff | smoke, dust cloud | |
| `smoke_flipbook_4x4` | looping churning puff | smoke column, fog | `[4,4]` |
| `explosion_flipbook_4x4` | kernel -> fireball -> ring -> gone | explosion, hit blast (`cycles: 1`) | `[4,4]` |
| `ember` | small stretched hot speck | embers, sparks rising | |
| `lightning_bolt` | vertical branched bolt | lightning strike | |
| `electric_arc` | horizontal arc, 3 strands | electric arc, taser link | |
| `beam_core` | horizontal beam, bright core | laser/beam body | |
| `shockwave` | ring, sharp outer edge, soft inside | shockwave (`horizontal` or billboard) | |
| `swirl_vortex` | 2-arm spiral + core | vortex, black hole, charge-up | |
| `portal` | bright rim, spiral streaks | portal, warp gate | |
| `slash_arc` | tapered crescent, bright leading end | melee slash | |
| `hit_burst` | spiky radial burst + ring | hit flash | |
| `impact_star` | 8-point comic star | crit/impact pop | |
| `crack_ground` | radial cracks, top-down | ground decal (`horizontal`) | |
| `water_droplet` | teardrop with rim + highlight | water drops, rain | |
| `splash` | top-down splat with droplets | water/goo splash | |
| `bubble` | ring bubble with highlight | bubbles | |
| `snowflake` | 6-arm snowflake | snow, frost | |
| `ice_shard` | faceted crystal shard | ice spikes, shards | |
| `leaf` | leaf with veins | falling leaves, nature buff | |
| `petal` | notched petal | petals, sakura | |
| `feather` | feather with barbs | feathers, wings | |
| `poison_bubble` | cluster of 4 bubbles | poison, toxic pool | |
| `debris_chunks` | 4 rock chunks in a 2x2 grid | rubble scatter | `[2,2]` optional |
| `dust_speck` | small irregular soft speck | dust motes | |
| `sand_grain_noise` | sparse grain speckle in a disc | sand, grit spray | |
| `noise_perlin_tile` | seamless value noise, reaches the border | tiled noise / dissolve | |
| `trail_streak` | 256x64 streak, head left, tapered | trail ribbons | |
| `coin` | colour gold coin with star | pickup, `blend: alpha` | |
| `gem` | colour blue cut gem | pickup, `blend: alpha` | |
| `heart_pickup` | colour red heart | pickup, `blend: alpha` | |
| generators | `soft dot ring disc star4 star6 cloud smoke flame swirl rays streak lightning bubble diamond heart crescent dust` | auto-made white masks, 128, tint with `color` | |

Generated textures are plain masks: good for glow, smoke, flame, sparks, rings. For anything that needs real art
(a logo, a character, a painted planet) tell the user the texture was generated and ask for a PNG (square, power of two,
<= 512, white RGB + soft alpha for masks), then pass `--tex-dir <folder>` or the file path. Prefer library
textures over generated ones when both fit.

## Device tiers (budget)

The tier is **chosen by the user** (pipeline step 0). `low` is only the tool's fallback when no tier is given
(weak phones). Set it with `--tier low|mid|high` on `fab_lint.py` / `fab_build.py`, or `"tier"` in the spec.
Over-budget is a WARNING: fix it before building, do not just ignore it.

| Tier | systems | max particles total | per system | textures (incl. trail) | trails | overdraw* |
|---|---|---|---|---|---|---|
| `low` (default) | <= 5 | <= 20 | <= 8 | <= 5 | <= 1 | <= 15 |
| `mid` | <= 8 | <= 50 | <= 20 | <= 6 | <= 2 | <= 40 |
| `high` | <= 12 | <= 100 | <= 30 | <= 8 | <= 3 | <= 120 |

*overdraw = sum of `maxParticles * size^2`. Big soft quads (discs, clouds) cost far more than tiny sparkles.
The numbers are a judgement, not measured on devices. The artist's full aura (64 particles, 9 systems) only fits
`high`; `examples/universe_aura_lite.json` is the same look in `low` (12 particles, 5 systems). To fit `low`:
keep 1-2 hero particles, 2-3 big soft layers, 5-8 tiny sparkles, at most one trail, reuse textures and tint them.

## Rules (from the sample, enforced by the linter)

- Hero bodies = 1 particle. Budgets per tier above.
- Only the shader in the template. Materials are `additive` or `alpha`, with optional blended flipbook.
- Modules used by the artist: Shape (sphere/cone/circle), Emission, Colour/Size/Rotation over Lifetime,
  Velocity (linear + orbital), Texture Sheet Animation, Trails. Anything else is a warning or an error.
- No scripts, meshes, lights, collision, noise, sub-emitters.

## Limits and unknowns (tell the user)

- The rules come from ONE reference `.fab`, not an official spec. Craftland may still reject something the
  linter accepts. Report what the editor shows.
- Nobody has loaded a generated `.fab` in the game yet. **First-run test**: build `examples/universe_aura.json`
  (it reproduces the artist's effect) and import it. If it shows up and looks like the original, the
  pipeline is sound; then import the new effect.
- The bundle hashes in the index are MD5 of the bundle bytes. Unity computed its own hash, which cannot be
  reproduced outside Unity. If the editor complains about a hash, use the Unity 2018 path below.
- iOS textures are PVRTC from a small built-in encoder (25-38 dB on the library textures, a bit softer than
  PowerVR's tool). DXT5 and ETC2 use etcpak.
- **iOS textures MUST be square + power of two.** PVRTC (iOS) rejects non-square sides: a 128x32 trail makes iPhone
  texture creation fail and the game **crashes**. Android (ETC2) and PC/simulator (DXT5) accept non-square, so the
  bug only shows on a real iPhone. The artist's sample is square on iOS for every texture, trail included (128x128).
  `encode_chain` (`fab_textures.py`) stretches non-square textures (`trail` 128x32, `trail_streak` 256x64,
  `electric_arc`, `beam_core`, custom PNGs) to a square (longest side) for IOS only; UVs are 0..1 so the look is
  unchanged. Still prefer square source PNGs for custom textures, and never hand-edit an iOS bundle to non-square.
- Bursts, stretched billboards, world space, gravity and other shapes were not in the sample.
- Only particle effects, one prefab per package.

## Optional: real Unity 2018.4 path

If the user has Unity 2018.4.x and wants Unity's own build, the old pipeline is in `scripts/unity2018_optional/`
(`export_fab.ps1`, C# builder/validator/exporter). It takes the older, simpler v1 spec (`examples/effect_abc.json`)
and produces a `.fab` with Unity's real bundle hashes. It needs Windows and an activated Unity 2018.4 license.
Run: `powershell -ExecutionPolicy Bypass -File "<skill>\scripts\unity2018_optional\export_fab.ps1" -SpecPath <spec> -OutDir <Assets>`.
