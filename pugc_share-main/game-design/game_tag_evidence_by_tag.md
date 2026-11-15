---
name: craftland-game-tag-evidence
description: Detail of Craftland Game Tag Success Analysis — per-tag evidence for high-success, middle-tier and high-risk tags, the Social Interaction paradox and the Shooting tag problem (210 games, 2024–2025).
type: game-design-knowledge
domain: craftland-ugc
status: authoritative
version: 1.0.0
last_updated: 2026-11-03
---

# Game Tag Evidence by Tag

> Detail file of [Craftland Game Tag Success Analysis](game_tag_success_analysis.md) — read that file first. Content moved verbatim on
> 2026-11-03 to keep the parent short; section numbers (§) refer to the parent's numbering.

## 3. High-Success Tags (Invest With Confidence)

### Tycoon + Farm + Simulation
The only tag cluster to produce T0 games. Both T0 titles (FreeGarden,
StealAPet) carry **Tycoon + Simulation + Social Interaction** together.

- Tycoon avg R2 = **37.9%** — the highest of any tag.
- Farm: 100% success rate (small n=2, but consistent).
- **Why it works:** Gameplay loop repeats naturally (grow → harvest → sell →
  upgrade). Players have an intrinsic reason to return without external prompts.
  Session length is self-extending: T0 games average **65.5 minutes** of
  survival time, more than double any lower tier.
- **Critical pattern:** Tycoon works best when paired with Social Interaction.
  A Tycoon game without a social/competitive layer typically plateaus at T2-.
- **Design target:** Build for the loop first. The "farm" or "tycoon" theme is
  secondary to the compulsion loop.

### Unlimited Gloowall + Clash Squad (combo)
Both T1 games (OldPeakRamadan, GlooWar) carry **all three** tags:
Unlimited Gloowall + Clash Squad + Shooting.

- 50% success rate for Unlimited Gloowall; 33% for Clash Squad.
- **Why it works:** Leverages player familiarity with CS mode (zero learning
  curve) while adding a twist (infinite gloowall) that changes strategy
  significantly. Low friction, high novelty.
- **Design implication:** The "twist" must change gameplay in a meaningful way,
  not just cosmetically.

### Headshot Only
- 57.1% success rate; 4/7 games at T1-.
- **Why it works:** Skill-based mechanic creates replay motivation. Players
  want to improve, not just experience content once.
- **Best combos:** Headshot + Clash Squad (ClashSquad:Headshot T1-), Headshot +
  Shooting on known maps (OldPeakCarnival T1-).

### FFA + BR-like (Structured Shooting)
- Both tags: 40% success rate, avg R2 ~29–31% — significantly above generic
  Shooting (19.3%).
- **Why they outperform Shooting:** Both impose a structural arc on each
  session (elimination-based tension, shrinking zones). This naturally extends
  session time and increases stakes per match.
- **Examples:** BermudaDuosquad T1-, LastSafeZone T1-, HarborTown series T1-.

## 4. Middle-Tier Tags (Reliable Rotation, Low Ceiling)

### Deathmatch + Sniper
- Deathmatch: 8.3% success, but 91.7% reach T2 or better. avg R2 = 27.1%.
- Sniper: 0% T1+, but 100% land at T2. Safe floor, hard ceiling.
- **Design note:** These are "utility" modes — reliable mid-tier rotation
  fodder. Don't expect T1; don't expect T4 either if executed cleanly.

### Horror + Zombie
- Horror: T1- is achievable (EscapeHorrorTown, NightmareEscape series). Avg R2 = 21.2%.
- Zombie: Clusters at T2 (ZombieUprising, ZombieGraveyard). Avg R2 = 20%.
- **Winning formula:** Horror + narrative escape structure (not walking
  simulator). Zombie + Shooting mechanics the player already knows.
- **Failure pattern:** Horror without clear gameplay objective (Door T4,
  FourFriends T4). Zombie without combat loop (BioWarriorVSHumanity T4).

### Hide & Seek + Party Game
- H&S: 0% T1+, 54% cluster at T2-. Reliable but low ceiling.
- Party Game: 11% T1+. Success cases combine with Horror narrative
  (NightmareEscape T1-) or competitive social mechanics (SquidGameVN T1-).
- **Design note:** Pure H&S is a T2-/T3 mode. To reach T1-, it must fuse with
  another stronger mechanic (BR elimination, horror tension, social competition).

## 5. High-Risk Tags (Strong Evidence of Failure)

### Casual — Avoid
- **29 games, 28 T4 (96.6%). Avg R2 = 6.9%** — lowest of all tags.
- Examples: BlockPuzzle, IOBlackHole, HungryFish, RunGuysRun, CookingFrenzy.
- **Root cause:** Fundamental context mismatch. Free Fire players enter
  Craftland with expectations of action and competition. Casual/puzzle games
  do not meet that expectation. There is no evidence in the dataset that this
  can be overcome.
- **Verdict: Do not build. No exceptions in 29 attempts.**

### IP / Trending — High Risk Without Gameplay Depth
- IP: 66.7% T4. Trending: 57.1% T4. Both avg R2 ~16–17%.
- Failure examples: Brainrot.io, Toiletman, A-maze-ingBrainrot, TrollSahur —
  viral concept, no replay loop.
- **The trap:** IP/trending generates first-session curiosity but cannot
  sustain D2 retention without a real gameplay system underneath.
- **The exception pattern:** SquidGameVN T1- (Squid Game IP + full mini-game
  competition system). NinjaVSZombies T2 (Ninja IP + Zombie Shooting mechanics).
- **Rule:** IP/Trending can only serve as the *skin*, never the *core*. If
  the game would fail without the IP, it will fail with it too — just slower.

### Music / Concert — Consistent Failure
- 9 games: 0% T1+, 55.6% T4. Avg R2 = 15.5%.
- KaraokeBattle localized versions (VN/TH) reach T2- thanks to regional
  audience match, but all non-localized versions are T4.
- **Root cause:** Passive/spectator experience. No engagement loop, novelty
  exhausted after one session.

### Parkour
- 0% T1+, 57.1% T4. Avg R2 = 17.2%.
- PetsParkour (T4) is the only dedicated parkour game. Others combine
  Parkour as a side tag without it becoming the core.
- **Note:** Parkour as secondary mechanic within another mode is untested at
  scale but not recommended as primary identity.

### Racing
- 3 games: 0% T1+, 100% T3/T4. Avg R2 = 12.7%.
- **Root cause:** Free Fire's engine/controls are not optimized for racing. The
  experience is mechanically inferior to any dedicated racing game.

## 6. The Social Interaction Paradox

Social Interaction appears in **33 games** with a bimodal distribution:

- **T0** (FreeGarden, StealAPet) — when combined with Tycoon/Simulation.
- **T4** (12 games) — when used as the *primary* mechanic (concerts, islands,
  karaoke, seasonal lobbies).

**Conclusion:** Social Interaction is a multiplier tag, not a core game tag.
It amplifies a strong gameplay loop (Tycoon → T0) but cannot sustain a game
on its own (ValentineIsland → T4, SpecialIsland → T4, ColorFestival → T4).
Do not treat "social experience" as a game design pillar in isolation.

## 7. The Shooting Tag Problem

Shooting is the **most-used tag** (97 games, 46% of dataset) but has a
**57.7% T4 rate**. The average R2 of 19.3% sits just below T2- threshold.

The difference between T1- Shooting games and T4 Shooting games is entirely
about **sub-mechanic differentiation**:

| T1-/T2 Shooting Examples | Differentiating Mechanic |
|---|---|
| OldPeakRamadan, GlooWar | Unlimited Gloowall twist |
| ClashSquad:Headshot | Headshot-only rule |
| BermudaDuosquad | BR-like structure |
| HarborTownVIP | FFA format on known map |
| ZombieUprising, ZombieGraveyard | PvE Zombie layer |

| T4 Shooting Examples | Why It Failed |
|---|---|
| RampageClassic, CrazyBattle | Generic team deathmatch, no hook |
| SoloKingV2, ChaosCrossfire | Generic solo/TDM, no differentiation |
| FPPCS, KingoftheBlock | Standard CS with no twist |
| 1Dews4Fluxo | Trending IP + generic shooting |

**Rule:** Never greenlight a Shooting game without a clearly articulated
sub-mechanic that is different from vanilla Free Fire modes. "We'll make
a good shooting game" is not sufficient.
