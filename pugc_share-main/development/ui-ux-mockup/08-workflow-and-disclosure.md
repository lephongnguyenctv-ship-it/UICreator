# 08 — Working With the Designer + the Disclosure Convention

The technical parts (files 02–07) only have value if paired with the right WAY OF WORKING with the
designer — because the designer doesn't read code, they judge results by looking at them and by
whether they can trust what was built. This is the part that decides whether the designer keeps using
an AI agent for this kind of work at all.

## Principle #0: pick the build mode first, and say it

Before drawing anything, state per screen: **Mode A (rebuild from a real `.ui` file)** or **Mode B (new
design, kit composition only)** — see [09-design-tokens-and-layout.md](09-design-tokens-and-layout.md). Most
"misaligned everywhere" rework came from Mode B screens built with invented absolute coordinates. When you
present options, every option is built from kit components, so the chosen one needs no re-layout.

## Principle #1: never fabricate when data is missing

When an asset, color, coordinate, or some detail is missing or uncertain:

- **Don't** silently pick a value that "looks reasonable" and use it as if it were a known fact.
- **Do** either (a) ask the designer before building it, or (b) build a temporary version with the
  most reasonable value you can, AND clearly flag it as an assumption, in a place the designer will
  actually see it (not buried in some log file nobody reads).

## The 3-label convention: real / approx / new

Attach one of these three labels to EVERY non-obvious detail (color, coordinate, asset, behavior) when
documenting/mapping a screen:

| Label | Meaning |
|---|---|
| `real` | Taken directly from real data (a `.ui` file, pixel-measured from a reference image, explicitly confirmed by the designer). |
| `approx` | An estimate made because real data was missing — NEEDS the designer to confirm it. |
| `new` | A new proposal from the AI agent (not present in the original game, or a deliberate change per the designer's request) — the designer needs to know this is NOT a recreation of something that already exists. |

Apply this label consistently in every screen's mapping (see the example in file 07) — this is the only
way for the designer (or a dev receiving the handoff later) to know at a glance what's trustworthy and
what needs double-checking.

## The working loop: draft → feedback → finalize

When a request has multiple reasonable ways to do it (no single "correct" answer — e.g. where to place
one button in an already-crowded layout), propose 2–4 CLEAR OPTIONS (labeled A/B/C...) instead of
silently picking one and building it. After the designer chooses or gives feedback, FINALIZE it into a
single version — don't keep multiple unchosen options lying around in the code (clean up the options
that weren't picked).

When the designer gives feedback via an annotated screenshot (circled areas, numbered points...), read
EVERY annotation carefully and address EACH point EXACTLY — don't lump them together or skip any,
including small ones.

When the designer directly asks for your opinion ("should this go here or there, which makes more
sense?"), give a definite answer WITH a clear reason instead of asking the question back — but still
label it clearly as your proposal (the `new` label), not as an assumed-correct answer.

## Discipline around editing files/committing

- **Don't delete or rename files yourself** if the working environment doesn't safely support it
  (e.g. the file lives on a drive mounted from the designer's machine, not the AI agent's own scratch
  workspace) — creating NEW files is safe, but deleting/renaming EXISTING files may need an
  intermediate step (copy to a scratch area, edit there, copy back) to avoid unintentionally damaging
  data outside the AI agent's control.
- **Don't commit without being explicitly asked.** Batch up multiple small changes and only commit when
  the designer says "ok"/"go ahead and commit" — don't auto-commit after every small edit, and never
  `push` on your own (only commit locally, so the designer can review and push whenever they're ready).
- **Don't touch unrelated files/changes** already sitting in the repo (leftover scratch files, someone
  else's unfinished experiment...) — even when it looks like "helpful cleanup." Only commit exactly
  what was asked for.
- **Verify first (file 06), then report "done"** — never report completion before running verification.

## When reporting results to the designer

- Be concise and get straight to the point: what was done, what was verified, and what still needs
  their own review/confirmation.
- If there's a technical trade-off involved (e.g. sacrificing exact 1:1 size to guarantee it never
  overflows the frame — see file 05), state that trade-off plainly in your response, don't let the
  designer discover it on their own later.
- If there's an important gap/assumption still unconfirmed, restate it clearly rather than hoping they
  notice it buried in a mapping/comment.
