# Artist style guide: what makes `universe_effect.fab` pretty AND light

Everything here is read from the artist's reference effect (`assets/template/universe_effect.fab`, spec in
`examples/universe_aura.json`). Copy the habits, not the subject. Numbers are what the artist used.

## 1. The budget the artist stayed inside

The reference effect fits the `high` tier. The tier of a new effect is asked from the user (SKILL.md step 0);
`low` (<= 20 particles, <= 5 systems, overdraw <= 15) is only the fallback. `examples/universe_aura_lite.json`
is the same look squeezed into `low`.

| Item | Reference effect | Rule of thumb (high tier) |
|---|---|---|
| Particle systems | 9 | 4-10 |
| Max particles, all systems | 64 | <= 100 |
| Max particles, one system | 25 | <= 30 |
| Textures | 8, 128-512 px (mostly 128) | <= 8, <= 512, share them |
| Materials | 8 | one per texture+blend |
| Shader | 1 (`Particles/Standard Unlit`) | never another |
| Scripts, meshes, lights, collision, noise | none | none |
| Big additive quads (overdraw) | 4 + 10 | keep the sum of `maxParticles * size^2` under ~120 |

## 2. How the look is built: layers, not one big system

The aura is five *layers*, each with one job:

1. **Ground disc** (`Nebula_Disc`): 4 huge soft quads, `render.mode = horizontal`, y = 0.03, size 2.4-3,
   slow spin (20-40 deg/s), colour picked at random from a magenta -> violet -> blue gradient, alpha 0.8.
2. **Volume** (`Nebula_Glow`): 10 cloud quads, size 0.6-1.0 growing 0.7 -> 1.1 over life, drifting slowly,
   alpha 0.45, same random gradient. Soft, low alpha, additive: this is the "glow".
3. **Fine detail** (`Stars`, `Star_Dust`): many tiny particles (0.03-0.2), short life, random colour from a
   white / cool blue / warm yellow gradient. `Star_Dust` is a narrow cone (angle 8) rising upwards.
4. **Hero bodies** (`Sun`, `Earth`, `Saturn`): **one** particle each, lifetime 600 s, spawned on the edge of a
   circle (`thickness 0`) and carried round by *orbital velocity*. Each orbit has its own tilt and height
   (y = 0.55 / 1.0 / 1.55), its own speed (0.55, -1, 0.8 rad/s; one reversed) so they never line up.
   `Earth` and `Sun` use a flipbook (8x8, 4x4) to spin without any mesh.
5. **Accents** (`Comet_A`, `Comet_B`): one particle, orbital speed 3 / -3.5 rad/s, with a short trail
   (0.1 s, width 0.5 tapering to 20 %, colour fading to transparent).

Why it stays cheap: hero objects cost 1 particle; the expensive-looking parts (clouds, disc) are few, big and
low-alpha; the many-particle layers are tiny.

## 3. Habits that make it look good

- **Every system fades in and out** (`fade`, default `[0.2, 0.3]`). Nothing pops. Only the 600 s bodies skip it.
- **Random colour from a gradient** (`color: {"gradient": [...], "random": true}`) instead of one flat colour:
  variety for free. Pick 2-3 harmonious stops. Do not mix more than one hue family per layer.
- **Ranges, not constants** for lifetime, size, speed, rotation (`[min, max]`). Uniform particles look fake.
- **Random start rotation** (`[0, 360]`) on clouds/discs/sparkles, plus a slow `rotationOverLife`.
- **Size over life** on clouds (0.7 -> 1.1): they swell as they fade.
- **Separate everything in space**: y offsets and tilts, so orbits and layers do not overlap or z-fight.
- **Prewarm** ambient loops (`"prewarm": true`) so the effect is full at frame 0.
- **Additive for light, alpha for solids**: glow/sparkle/cloud/disc/sun = `additive`; Earth/Saturn (opaque
  looking bodies) = `alpha`. Additive on a dark body washes it out.
- **White-RGB alpha masks** (glow, cloud, sparkle, trail, disc) are tinted by the start colour: one texture
  serves many colours. Coloured art (planets) is used untinted.
- **Thickness**: `shape.thickness 0` = exact radius (orbits), `0.4` = shell-ish (stars around you), `1` = filled.

## 3b. Art direction: design before numbers

Section 3 is how the artist *built* it. This is how to *design* it so it reads in the game, not only on a black
preview. `fab_lint.py` checks the starred rules and prints them as `art` lines (advice, never blocks a build).

**Purpose first.** The job of the effect sets its size, brightness and how much it may cover:

| Purpose | Footprint | Brightness | Rule |
|---|---|---|---|
| Aura / cosmetic on a player | radius ~1-1.3, height 0-1.6 (like the reference) | medium | never cover the face/upper body: hero layers above head or below waist, centre column sparse |
| Buff / status | small, around feet or above head | medium-high, short | one clear symbol + colour; must read in 0.5 s |
| Pickup / loot marker | ground ring + vertical beam | high | readable from far: tall thin shape, strong silhouette, slow pulse |
| Zone / area | ground disc = exact gameplay radius | low-medium | edge brighter than centre; players must see the ground through it |
| Hit / impact (one-shot) | small, 0.3-0.8 s | peak high, then gone | anticipation -> impact -> dissipation (below) |

**Value (light/dark) beats colour.\*** Every good effect has a value ladder: a small **near-white hot core**
(all channels >= 0.7) -> saturated mid layer -> darker, lower-alpha outer layer. Additive layers stacked on one
saturated hue clip to a flat blob; white in the middle is what makes it "glow". Keep saturated full-bright colours
(`[1,0,1]`) off big additive quads: use value ~0.6-0.8 or alpha <= 0.5 there.\*

**Colour: 60 / 30 / 10.\*** 60 % dominant hue (volume, disc), 30 % secondary (detail, bodies), 10 % accent
(spark tips, trail heads, the hero's rim). The accent is analogous (+-40-60 deg) for calm, complementary for
energy. One hue family everywhere looks flat. Mood -> palette starters (hero, secondary, accent):

| Mood | Palette |
|---|---|
| cosmic / magic | magenta, violet-blue, warm white-yellow (the reference) |
| void / dark | deep violet, magenta, cold cyan accent; dark alpha smoke for contrast |
| fire | orange, deep red base, yellow-white core |
| ice / frost | cyan, pale blue, white core, a touch of lilac |
| holy / heal | warm gold, cream white, soft green or sky-blue accent |
| poison / toxic | acid green, dark teal, magenta accent sparks |
| electric | electric blue, white core, violet accent |

**Shape: big / medium / small.\*** One big soft shape (disc, cloud volume), a few medium readable bodies (hero,
orbs), many tiny sparks. Largest size >= 4x the smallest, or nothing stands out. Read the silhouette: at a
glance the effect should be one simple shape (ring, column, dome, spiral), not a cloud of equal dots.

**Motion: contrast and rhythm.** Mix slow big (disc 20-40 deg/s, clouds drifting) with fast small (comets 3 rad/s,
sparks). Give each layer a direction (rise, orbit, spin) and reverse one so they never line up. Loop periods must
not be equal or multiples (2.3 / 3.1 / 4.7 s, not 2 / 4 / 4)\*: layers in lockstep pulse visibly.
Use `sizeOverLife` as easing: `[[0,0.7],[1,1.1]]` swell for smoke, `[[0,0],[0.15,1],[1,0.8]]` pop-then-settle for
sparks, `[[0,1],[1,0]]` shrink for embers.

**One-shot timing (impact, cast, pickup).** 3 beats: anticipation (0-15 %: small gather or glow), impact
(15-30 %: biggest, brightest, fastest frame: hot core + burst of sparks), dissipation (30-100 %: slow fade, smoke
or embers drifting out). Fast in, slow out. Bursts are unverified in game (see section 5): until tested, fake the
impact with high `rate` + short `duration` + `loop: false`.

**Daylight maps.\*** Free Fire maps are mostly bright. Additive light on a bright ground loses most of its
contrast: thin trails and low-alpha mist vanish. Always also preview with `--bg day`. Fixes: higher alpha on the
hero, darker and more saturated mid tones, thicker trails, or one `alpha` layer (dark smoke, coloured body) as a
contrast backing.

**Art review of the preview sheet** (do this every iteration, say the answers to the user):

1. Squint: is there one clear shape and one brightest point (the hero)? If two things compete, dim one.
2. Value ladder: white core -> saturated -> dark edge visible?
3. Colour: dominant / secondary / accent visible, accent small?
4. Density: are there empty frames, or a frame where everything piles up? Even it out with rate/lifetime ranges.
5. Day sheet: does the hero still read? If not, apply the daylight fixes.
6. Gameplay: is the player's body/face covered? Does the footprint match the purpose table?

## 4. Recipes (spec fragments)

Ambient cloud
```json
{"name":"Cloud","texture":"cloud","blend":"additive","position":[0,1,0],"maxParticles":10,"rate":3,
 "lifetime":[2.5,3.5],"duration":3.5,"prewarm":true,"speed":[0.02,0.08],"size":[0.6,1.0],"rotation":[0,360],
 "rotationOverLife":[-23,23],"sizeOverLife":[[0,0.7],[1,1.1]],"fade":[0.3,0.3],
 "color":{"gradient":[[0,0.9,0.3,0.8,0.45],[0.5,0.5,0.25,0.95,0.45],[1,0.2,0.5,1,0.45]],"random":true},
 "shape":{"type":"sphere","radius":0.55,"scale":[1,1.5,1]}}
```
Sparkles
```json
{"name":"Sparkles","texture":"sparkle","blend":"additive","maxParticles":20,"rate":12,"lifetime":[0.8,1.6],
 "duration":2,"prewarm":true,"size":[0.08,0.2],"rotation":[0,34],"fade":[0.3,0.4],
 "color":{"gradient":[[0,1,1,1,1],[0.5,0.6,0.8,1,1],[1,1,0.85,0.55,1]],"random":true},
 "shape":{"type":"sphere","radius":1.1,"thickness":0.4}}
```
Rising dust
```json
{"name":"Dust","texture":"glow","blend":"additive","maxParticles":25,"rate":10,"lifetime":[1.5,2.5],
 "speed":[0.2,0.5],"size":[0.03,0.07],"fade":[0.2,0.4],
 "shape":{"type":"cone","angle":8,"radius":0.9,"rotation":[-90,0,0]}}
```
Orbiting body (flipbook)
```json
{"name":"Planet","texture":"earth_8x8","blend":"alpha","position":[0,1,0],"tilt":[-5,0,-7],"maxParticles":1,
 "rate":10,"lifetime":600,"size":0.22,"fade":null,"orbit":[0,-1,0],
 "shape":{"type":"circle","radius":1.0,"thickness":0,"rotation":[90,0,0]},
 "flipbook":{"tiles":[8,8],"cycles":75,"blend":true}}
```
Comet with trail
```json
{"name":"Comet","texture":"glow","blend":"additive","position":[0,1.2,0],"tilt":[35,0,15],"maxParticles":1,
 "rate":10,"lifetime":[3,5],"size":[0.14,0.18],"color":[0.7,0.9,1,1],"fade":[0.08,0.15],"orbit":[0,3.5,0],
 "shape":{"type":"circle","radius":1.25,"thickness":0,"rotation":[90,0,0]},
 "trail":{"lifetime":0.1,"minVertexDistance":0.03,"width":[[0,1],[1,0.2]],"widthScale":0.5,
          "colorOverTrail":[[0,1,1,1,1],[0.5,0.45,0.8,1,0.7],[1,0.45,0.8,1,0]]}}
```
Ground disc
```json
{"name":"Disc","texture":"nebuladisc","blend":"additive","position":[0,0.03,0],"render":{"mode":"horizontal"},
 "maxParticles":4,"rate":0.6,"lifetime":6,"duration":6,"prewarm":true,"size":[2.4,3],"rotation":[0,360],
 "rotationOverLife":[20,40],"fade":[0.3,0.3],
 "color":{"gradient":[[0,0.95,0.35,0.85,0.8],[0.5,0.45,0.3,1,0.8],[1,0.25,0.6,1,0.8]],"random":true}}
```

## 5. Hard constraints (engine side)

- **Shader variants.** The shader inside the `.fab` was compiled with only two keyword sets:
  `_ALPHABLEND_ON` and `_ALPHABLEND_ON _REQUIRE_UV2` (flipbook blending). Anything else renders pink or wrong:
  no soft particles, no emission, no normal map, no colour overlay, no alpha test, no distortion. The builder
  only ever writes those two sets and `fab_inspect.py --check` fails on anything else.
- **Blend** is `additive` (Src Alpha / One) or `alpha` (Src Alpha / One Minus Src Alpha). Nothing else.
- **Modules used by the artist** (safe): Main, Shape (sphere, cone, circle), Emission, Colour over Lifetime,
  Size over Lifetime, Rotation over Lifetime, Velocity over Lifetime (linear + orbital), Texture Sheet
  Animation, Trails. Render modes: billboard, horizontal.
- **Not seen in the sample (the linter warns):** bursts, stretched/vertical billboards, world simulation
  space, gravity, box/hemisphere/edge/donut/rectangle shapes. They are written with the same Unity 2018
  serializer, so they are probably fine, but nobody has loaded them in the game. Test in the editor first.
- **Never:** scripts, meshes, TrailRenderer, lights, collision, noise, sub-emitters, other shaders.
- **Textures:** power-of-two sides, <= 512, keep 128 when you can. **iOS PVRTC also needs SQUARE** (a 128x32 trail
  crashes iPhones; Android/PC accept it); the sample's iOS textures are all square, trail 128x128. The builder squares
  non-square textures on iOS automatically. The builder encodes DXT5
  (PC/WebGL), ETC2 (Android), PVRTC 4bpp (iOS), with mips, like the sample.
- **256 vs 128:** the library is 256 px so shapes with fine lines (runes, cracks, snowflake, hex cells) and 4x4
  flipbooks (64 px frames) stay readable when a particle fills a big part of the screen. Use 256 for heroes, ground
  decals, flipbooks and anything sized >= 1 unit; for tiny or blurry particles (sparks, dust, soft glows under
  0.3 units) the 128 px artist textures or generators look the same and cost a quarter of the memory. A 256 texture
  is ~4x the memory of a 128 one, so the per-effect budget still holds: <= 8 distinct textures, and reuse + tint
  one texture before adding another.

## 6. Missing textures are generated

If no library or file texture matches, the builder draws one (see SKILL.md, 18 generators). Generated masks follow the
artist's rule: white RGB, soft alpha that is 0 well before the border. Colour them with `color`, never bake colour in.
They are simpler than hand-painted art, so keep the hero on library art when one exists.

## 6b. Making your own textures

Put a PNG in a folder and use `--tex-dir <folder>` (then `"texture": "name"`), or give the file path in
`"texture"`. Make alpha masks **white RGB + soft alpha that reaches 0 well before the border** (PVRTC wraps
around the edges). Colour art (bodies) keeps its colour and should use `blend: alpha`. A flipbook is a grid of
equal frames (`flipbook.tiles`), power-of-two total size, frames read left to right, top to bottom.

## 7. Prompt -> spec checklist for an agent

0. Fix the **purpose** (aura, buff, pickup, zone, hit) and its footprint from section 3b.
1. Name the **hero** (what the player should see) and give it a layer. Name 2-3 support layers (glow, detail,
   accent). Stop there: 4-8 systems. Plan big / medium / small sizes and the value ladder (white core).
2. Pick a **palette** of 2-3 hues from the prompt (mood table in 3b): dominant, secondary, small accent; write
   one gradient per layer from it.
3. Give each layer a **budget** (`maxParticles`) from section 1; hero bodies are 1 particle.
4. Choose **textures** from the library first; ask for a PNG only if nothing fits.
5. Add **motion** with modules only (orbit, rotationOverLife, sizeOverLife, speed). No scripts. Slow big + fast
   small, one reversed direction, non-multiple loop periods.
6. Run `fab_lint.py` (fix budget warnings, answer each `art` line or say why it is intended), then
   `fab_preview.py` on `--bg dark` AND `--bg day`, do the art review in 3b, adjust, only then `fab_build.py`.
