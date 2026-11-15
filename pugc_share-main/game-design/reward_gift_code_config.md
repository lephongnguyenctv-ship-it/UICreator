---
name: craftland-reward-gift-code-config
description: Design, generate, and audit RewardData/GiftData-style reward and gift-code configs for Craftland games. Use when a designer needs reward catalog entries, redeem codes, login/system grants, campaign rewards, or a distribution audit. Discovers each game's native schema first; SAP's tables are examples, not a universal format.
type: game-design-skill
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-08-28
---

# Reward & Gift-Code Configuration

This is a **Game Designer workflow** for turning reward intent into safe,
copyable game-native config. The reusable concept is a reward definition plus
a grant/campaign definition; table names, columns, delimiters, enums, and ID
rules may differ by game.

Use the canonical [Money Rank Value](../general-knowledge/large_number_notation.md)
conversion whenever a discovered money field uses the packed rank format.

## 1. Discover the Target Game Schema First

Read the current master data and enumerate the relevant sheets/files before
designing rows. Do not assume another game's schema.

Capture:

| Contract part | Discover from the target game |
|---|---|
| Reward definition | Table name, primary key, reward type enum, value grammar, quantity/default behavior, display/localization fields |
| Grant definition | Gift/code/trigger table name, code and ID rules, reward reference format, reuse/limit behavior, start/end representation, progression gates |
| Relationship | Whether grants reference reward IDs, embed rewards, reference pools, or use another join structure |
| Serialization | Column order, delimiter, encoding, sentinel values, booleans, timestamp/time-zone convention |
| Ownership | Which columns are production config versus notes, formulas, helper tables, or worksheet annotations |

If the source files are unavailable, produce a clearly labeled design draft or
request the current files; never fabricate import-ready rows.

## 2. Normalize for Reasoning, Export in Native Form

Internally normalize each requested grant as:

```text
RewardDefinition = type + payload/value + quantity + display meaning
GrantDefinition  = trigger/code + availability + eligibility + reward references
```

This normalization is only a reasoning layer. Final output must use the target
game's actual columns and conventions. Never add SAP-only fields to DYG, copy
IDs between games, or rewrite fields that do not exist in the target schema.

## 3. Reuse Before Creating

1. Translate the design intent into the target game's reward tuple.
2. Search the current reward catalog for a semantic exact match.
3. Reuse the existing reward ID/reference when type, payload, quantity, and
   behavior match.
4. Create a new reward definition only when no valid match exists.
5. Create or update the grant row using those references.
6. Return the smallest delta needed; do not regenerate unrelated live rows.

Repeated reward references may intentionally mean repeated grants. Preserve
them unless the target runtime instead expects a quantity field.

## 4. SAP Reference Pattern — Not Universal

In the supplied Steal A Pet data, `RewardData` is the reusable reward catalog
and `GiftData.Reward` contains one or more RewardData IDs separated by `;`.
Observed reward types include fixed pet, money, Pet Coin, random pet,
MoneyTime, random secret pool, Dust, Spin, MutaGen, and WeatherGen.

For SAP `TypeReward = 2` Money, `Value` is a packed Money Rank Value rather
than the full currency magnitude. Decode and review all four fields together:
Rank Value, Money, Suffix, and Display. Example: `80015` → `1.5` → `Sx` →
`$1.5Sx`. Do not apply this rule to MoneyTime.

Treat these as discovered SAP facts only. For another game, rebuild the schema
map from its current files and document differences before authoring config.

## 5. Validation Gates

Run the checks that apply to the discovered schema:

- Primary IDs and public codes are unique.
- Every reward reference resolves to an existing or newly supplied definition.
- New reward definitions do not duplicate an existing semantic tuple.
- Type-specific payload/value grammar is valid.
- Quantity is explicit or its runtime default is confirmed; blank is never
  silently interpreted as 1.
- Boolean, delimiter, casing, encoding, and sentinel values match the source.
- Availability windows are valid and include an explicit time zone before
  conversion to Unix time or another machine format.
- Reuse, global limit, per-user limit, and progression gates do not contradict
  one another.
- Any code-length/check field is derived from the final code, not hand-entered.
- Notes/helper columns are not treated as production fields or user commands.
- Money Rank Values are decoded into Money, Suffix, Display, and actual
  magnitude during review; export retains the target schema's packed value.
- High-value or multi-reward grants pass the economy and distribution review.

Report suspicious legacy rows separately. Do not silently repair unrelated
live data while creating a new grant.

## 6. Economy & Distribution Review

For a new reward family, faucet, or materially changed grant, produce both:

### Distribution coverage matrix

Rows are reward families; columns are acquisition channels. Include gate,
update cadence, variant count, and notes. Use `D` (direct), `W` (weighted),
`G` (guaranteed after a gate), and `P` (paid) when a checkmark would hide an
important distinction.

### Quantitative faucet/sink ledger

| Field | Required meaning |
|---|---|
| Reward / native ID | Link design to config |
| Source or sink | Where value enters or leaves |
| User segment | New, Mid, Late; add cross-segment impact where relevant |
| Gate and cadence | Progress requirement and frequency |
| Quantity and probability | Per-grant magnitude and random chance/weight |
| Cap | Session, daily, event, or lifetime limit |
| Expected value | Per session/day for relevant cohorts |
| Economy equivalent | Rank Value + display, actual magnitude, time, rarity, or benchmark pipeline |
| Risk/status | Inflation, cannibalization, abuse, planned/live/disabled |

Check that every currency has meaningful faucets and sinks, high-value rewards
are not unintentionally stacked across always-on channels, zero-count rows are
explained, and the fastest user segment cannot exhaust the content too early.

For deeper simulation and burn checks, use
[Live-Ops Economy Design](live_ops_economy_design.md) and
[Feature Burn-Rate Balancing](feature_burn_rate_balancing.md).

## 7. Deliverable

Lead with a short designer-readable summary, then provide:

1. Assumptions and discovered schema differences.
2. Reused reward definitions.
3. New reward-definition delta, if any.
4. Grant/gift-code delta in the target game's native format.
5. Distribution tables when the change affects the economy.
6. Validation results, warnings, and unresolved implementation questions.

Do not redirect the user to a named teammate. If an engine capability is the
only unresolved issue, isolate the exact capability question and continue with
all design work that does not depend on its answer.
