---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/05-playbooks/03-playtest-feedback.md"
---

# Playbook 03 — Turning playtest feedback into balance

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../README.md#integration-and-applicability).

Feedback arrives as feelings: "first boss takes too long", "too many carrots", "shop is far",
"reward smaller than what I paid", "Lv1–3 feel hard", "animation too fast to notice the reward".

1. **Locate the feeling in data**: which level/minute, which sim metric (boss kill time, species count,
   minutes to unlock, reward value vs cost, HP ratio).
2. **Find the cause in config/code**, not in the sim: e.g. boss HP jump ×1.9 at Lv3; cracked seed 70/30
   yields 2 species; teleport at Lv8 while "buy 1" mission is at Lv2; reward 1,500 for a 2,400 purchase.
3. **Decide the smallest config lever**: unlock level, pool rate, weight/stock, reward row, HP ease
   multiplier — before touching formulas. Prefer variety over power (element variants have equal stats).
4. **Keep humans in mind**: bots play optimally; apply explicit ease factors for early levels and say the
   rule ("half-bot player still wins until Lv9").
5. **Check side effects** with the simulator: pacing targets, boss win rate, coin held, species timeline.
   Report before/after in one table.
6. **Apply, rebuild, document, prepare the authorized export** (playbook 01 steps 5–10).
7. **Ask one question** when two levers both work (remove vs reduce rarity; roll-twice vs stat bump) —
   designers usually prefer the one with no code change and no motivation loss.
