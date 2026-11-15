---
name: craftland-large-number-notation
description: Canonical two-way conversion for Craftland Money Rank Value. Use when decoding a packed money config into Money, Suffix, Display, or actual magnitude, or when encoding Money plus Suffix back into Rank Value. Defines the rank-1-to-12 suffix table and Excel formulas.
type: shared-definition
domain: craftland-ugc
status: authoritative
version: 1.1.0
last_updated: 2026-08-28
---

# Craftland Money Rank Value

Craftland money config does **not** store the full raw currency amount.
`Rank Value` is a packed number containing:

- the **suffix rank** in the ten-thousands portion; and
- the displayed **Money coefficient** in the remainder, stored in tenths.

## Canonical Suffix Lookup

| Suffix | Rank |
|---|---:|
| *(empty)* | 1 |
| `k` | 2 |
| `m` | 3 |
| `B` | 4 |
| `T` | 5 |
| `Q` | 6 |
| `i_Qi` | 7 |
| `Sx` | 8 |
| `Sp` | 9 |
| `Oc` | 10 |
| `No` | 11 |
| `De` | 12 |

Preserve this exact spelling and casing in config-facing work. In particular,
rank 7 uses the supplied token `i_Qi`, not an inferred replacement.

## Decode Rank Value

For Rank Value `r`:

```text
Rank    = FLOOR(r / 10000)
Money   = MOD(r, 10000) / 10
Suffix  = lookup Rank in the canonical table
Display = "$" + Money + Suffix
```

Excel, matching the source sheet:

```excel
=MOD(AA14,10000)/10
```

```excel
=XLOOKUP(FLOOR.MATH(AA14/10000),Y3:Y14,X3:X14,"")
```

If Money is in `AB14` and Suffix is in `AC14`:

```excel
="$"&TEXT(AB14,"0.##")&AC14
```

### Verified example

| Rank Value | Money | Suffix | Display |
|---:|---:|---|---|
| `80015` | `1.5` | `Sx` | `$1.5Sx` |

Reason: `FLOOR(80015/10000) = 8`, while
`MOD(80015,10000)/10 = 1.5`.

## Encode Money + Suffix to Rank Value

```text
Rank Value = SuffixRank × 10000 + ROUND(Money × 10, 0)
```

If Money is in `AB14`, Suffix is in `AC14`, suffixes are `X3:X14`, and ranks
are `Y3:Y14`:

```excel
=LET(
    money,AB14,
    suffix,AC14,
    rank,XLOOKUP(suffix,X3:X14,Y3:Y14,""),
    rank*10000+ROUND(money*10,0)
)
```

Example: `1.5` + `Sx` → `8 × 10000 + 15` → `80015`.

## Convert to or from Actual Magnitude

Actual magnitude is useful for simulation and comparison, but it is not the
native config representation:

```text
ActualValue = Money × 1000^(Rank − 1)
```

Thus `80015` represents `1.5 × 1000^7 = 1.5 × 10^21`.

To encode a positive actual value `n` into Rank Value:

```text
p         = clamp(FLOOR(LOG10(n) / 3), 0, 11)
Rank      = p + 1
Money     = n / 1000^p
RankValue = Rank × 10000 + ROUND(Money × 10, 0)
```

Excel:

```excel
=LET(
    n,G2,
    p,IF(n=0,0,MAX(0,MIN(INT(LOG10(ABS(n))/3),11))),
    rank,p+1,
    money,n/1000^p,
    rank*10000+ROUND(money*10,0)
)
```

The packed format preserves the coefficient to **one decimal place** because
Money is recovered by dividing the remainder by 10. Do not claim a
precision-safe round trip for values requiring more precision.

## Operating Rules

- For RewardData money fields that use Money Rank Value, output the packed
  Rank Value, decoded Money, exact suffix token, and Display during review.
- Export the packed Rank Value—not the full magnitude—when the target config
  schema expects this format.
- Do not apply this encoding to `MoneyTime` or to another game's money field
  until its current schema confirms the same representation.
- Reject or flag ranks outside `1–12`, unknown suffixes, negative Money when
  the target system disallows it, and non-integer packed values unless the
  live schema explicitly supports them.
