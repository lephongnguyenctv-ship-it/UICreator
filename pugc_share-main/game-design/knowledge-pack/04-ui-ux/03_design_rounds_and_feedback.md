---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.1.0
last_updated: 2026-10-23
source: "plant-vs-zombie/GDD/knowledge-pack/04-ui-ux/03-design-rounds-and-feedback.md"
---

# 03 — Design rounds & feedback loop

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

## The loop
1. Designer gives a reference (screenshot, another game's HUD, a sketch) and a one-line intent.
2. Agent produces **2–4 options** on one page, each with a label, a one-line trade-off, and a scene
   preview. Keep options structurally different (not colour variants).
3. Designer picks one and lists tweaks ("Lv bigger", "move element icon left", "add the word zombie",
   "1.2–1.3× wider").
4. Agent applies tweaks, bumps version, deletes other options from code, logs the decision.
5. Repeat for the next widget. Typical: 3–5 rounds per widget, 5 minutes each.

## Recurring requests (expect them)
| Request | Response pattern |
|---|---|
| "Dock it to the top like a match timer" | top-center anchor at 0%, trapezoid dark panel, two square accent buttons at the ends |
| "Too long / weird" | switch 1 line → 2 lines, narrow the panel, drop the label text |
| "Make X bigger and clearer" | increase font 2–3 px, add outline, give it its own coloured box |
| "Remove this text, users don't read" | delete, keep only the number + icon |
| "Needs a pause so players feel the reward" | staged timeline with explicit gaps; print the timeline in ms on the page |
| "Two states must look different" | remove an element in one state (icon), change colour role (yellow countdown vs white counter) |
| "Merge these two pages/tables" | keep one page, add a selector that changes the other table's column |
| "Vertical instead of a grid" | family header rows + tier rows; selected-pool column with bar + "global x%" |

## Documenting each round
In the screen's `mapping` array: one row per visual element — what it is, where it comes from (sprite /
`.ui` node / new), and status `real` / `approx` / `new`. In the changelog: version, what changed, why
(quote the designer's request). Keep the superseded options' reasoning in a comment above the function so
the next agent does not propose them again.

## Later rounds (2026-10, source project)
| Situation | What worked |
|---|---|
| Rebuild the main HUD layout | Start from a **real in-game screenshot** at the game's canvas size, mark system-owned zones (dashed) you must not cover, then place features relative to existing widgets |
| New reward toast ("received 2× Ultimate Seed") | 3 options → pill sliding down; then 2 rounds of "still too big": shrink both width and height and dock it next to an existing HUD widget (next-boss bar) instead of free space |
| Converter screen (recycler) | Reuse the closest existing popup frame (merge screen); show refunds as a compact horizontal icon list without "%"; hide the leftover-point probability (hidden bonus) — a "+55 % for 1 more" line confused the designer |
| "Do players know that more input = more output?" | One progress bar toward the next reward tier — no explanatory text |
| Bulk actions | A **Quick fill** button that fills only eligible items (skip locked; prefer cheapest; consider skipping items currently equipped) |
