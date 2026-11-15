---
doc_type: publishing_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-14
---

# Analysis Protocol

## Required Reasoning Sequence

1. Confirm scope: game/project, period, region selection, update/release context, and data maturity.
2. Check canonical DAU eligibility and grade Overall R2 and Survival Time with the canonical tier table. Distinguish a provisional website quality screen from an official rank.
3. Read Match Count and Survival Time together to assess session depth versus replay.
4. Inspect Core, New, and Revival R2, Survival Time, Match Count, counts, and shares.
5. Decide whether movement is rate-driven or mix-driven.
6. Inspect trend/release impact with like-for-like update-week comparison.
7. Find high-impact regions using volume share and gaps versus overall.
8. Use R7/R14/R30, conversion, percentile, completion, and activeness data to explain the mechanism when available.
9. Produce only the highest-impact issues and actions, in priority order.

## Output Requirements

- Start with a one- or two-sentence health headline.
- State rank eligibility, Overall R2 and Survival Time. Check the DAU gate with authorized evidence; if it is unavailable, state that official rank eligibility is unknown. Do not expose counts or weights to recipients without count permission.
- Name the key weak cohort/region and the relevant values.
- Clearly distinguish observation, interpretation, and recommended action.
- Recommend 3–5 concrete actions, ranked by impact.
- Do not reproduce every metric or invent causal claims. Say when evidence is missing.

## Suggested Compact Output

```text
Headline: [tier + overall health + primary issue]

What matters now
- [largest evidence-backed strength]
- [largest evidence-backed weakness]
- [cohort/mix or regional risk]

Actions
1. [highest-impact action tied to a metric]
2. [next action]
3. [measurement or experiment to validate]
```

## Source Basis

This skill was extracted from the `pugc_tracking` system's current
`config/skills/analysis_rules.json`, its performance-reader skill, and
specialised analysis prompts. It **supersedes** this knowledge base's earlier
`game_performance_reader.md` (retired; its region-reading logic is now
covered by files 01–04 here).

`config/skills/analysis_rules.json` lives in the external `pugc_tracking`
project, not in this repository. All threshold values needed for analysis are
already inlined in these files (see file 02) and are cross-checked against
this repository's own canonical
[`tier_list_definition.md`](../../general-knowledge/tier_list_definition.md).
If the live `pugc_tracking` rule engine changes, record its runtime behavior and flag drift here;
do not silently replace the canonical team's rank policy with an app-specific quality screen.
Website privacy/projection and implementation are covered in
[Analytics Website Builder](../../development/analytics-website-builder/README.md).

