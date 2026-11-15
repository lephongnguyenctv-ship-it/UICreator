---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/00-overview/02-working-principles.md"
---

# 02 — Source collaboration working principles

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

These principles record the source project's collaboration. Apply verified-data and disclosure practices
within the current task; project-specific approval, delivery, and taste rules are examples, not automatic
authorization or mandatory defaults for another project.

## 1. Never fabricate; validate before reporting
- Every number on a page comes from config, code, or the simulator. No "reasonable guesses" typed into a table.
- Before saying "boss dies in 35 s", run the script that computes it. Before saying "dev already applied X",
  diff the dev CSV against the mirror.
- If a sprite/file/column is missing, say it is missing. Do not invent an icon or a colour.

## 2. Read the real source before proposing
- The dev repo (read-only, `git show`/`git log` only) is the truth for *mechanics*. Config CSVs are the
  truth for *values*. The designer's description is the truth for *intent*.
- When they disagree, say so explicitly (e.g. "the design says boss triggers on kills; the code uses a
  120 s timer — which do you want?").
- Re-read code after every dev commit batch (see [Dev Sync](../05-playbooks/02_dev_sync.md)).

## 3. Flag and ask; do not silently fix
- Spot a problem outside the current request (a leak at Lv25–65, a giftable rare buff, a missing
  `IsGiftable` flag) → report it with evidence and a suggested fix, then wait for a go-ahead.
- Exception: purely derived data (rebuild outputs, fingerprints) may be regenerated freely.

## 4. Single source of truth
- One config mirror (`data/config/*.json`) → everything else derives from it. Pages must not hard-code
  numbers that exist in config. When a page needs a constant, it reads `game-engine-constants.json`.
- Shared rules live in one file and are linked, never copied.

## 5. Disclose what is what
Label every element the designer sees as one of:
- **real** — read from `.ui`/CSV/code;
- **proposal** — the agent's suggested value (not yet in the game);
- **approx / needs confirmation** — an estimate, a visual judgement, or a mechanic the agent could not verify.
On the website this is the "Đề xuất / Dev hiện tại" (proposal / current dev) toggle on every balance page,
and the red "dev: x" annotations under proposed values.

## 6. Keep a decision log
- One entry per decision (`D#`), with: date, who decided, the problem, the numbers before/after, the reason,
  and the simulated impact. Status markers: ✅ final, ⚠️ void/superseded (keep the entry, point to the
  replacement), "state" (a fact about code, not a decision).
- The changelog of the website references the decision IDs. The dev action-items file references them too.

## 7. Apply through scripts, not hands
- Every balance change is a script in `scripts/apply-*.js` that is idempotent (safe to re-run) and starts
  from a known baseline. Hand edits get lost at the next import.
- After applying: re-fit dependent values (boss HP, prices), rebuild all derived data, run the sync check.

## 8. Commit discipline
- The source project used local commits per delivered unit (version + decision ID). For a new project,
  follow the current task's commit/push authorization and repository workflow; importing this pack grants neither.
- If Git permissions block work, report the limitation. Do not overwrite `.git/` from a scratch copy.
- Bump the website version on every change the designer can see (`APP_VERSION`), and show it in the header
  so "restart the server" problems are obvious.

## 9. Communicate short, in the designer's language
- Replies in the designer's language (Vietnamese here), ≤ ~15 lines, tables over prose, one question max.
- Say what changed, the measured effect, what needs their decision, and what the dev must do. Do not
  recap the whole history.

## 10. The designer's taste rules
Explicit preferences collected over the project (yours will differ — collect them the same way):
- "No new UI/UX unless necessary — it gets confusing."
- "Less text; users don't read."
- "Rewards must always be worth more than what the player spent."
- "Hardcore players must not be able to max a sink in 6 months."
- "A +1 level must be felt (at least +1 damage)."
- "Plan first, apply only after I review" for anything structural.
