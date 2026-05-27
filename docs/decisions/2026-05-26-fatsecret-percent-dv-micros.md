# FatSecret calcium/iron/vitamins are %DV — convert, don't skip

**Date:** 2026-05-26
**Area:** Engineering (nutrition)
**Status:** Resolved
**Supersedes:** the 2026-05-06 "intentionally skip calcium/iron/vitamins — unit ambiguity" carve-out in `fatsecretNormalize.ts`.

## Context

FatSecret Premier `food.get.v4` returns `calcium`, `iron`, `vitamin_a`, `vitamin_c`, `vitamin_d` on the serving. On 2026-05-06 these were **deliberately not emitted**: a TestFlight check of the McDonald's Big Mac (`food.get` calcium="9", iron="22") was read as evidence the units were inconsistent ("sometimes mg, sometimes %DV, sometimes IU, no flag"), so emitting them risked fabricated values. The honest gap (show "not published") was chosen over a possibly-wrong number.

That left a real gap users hit: FatSecret foods never showed calcium/iron/vitamins even though FatSecret had them.

## Re-investigation (2026-05-26, live API)

Verified `food.get` against **6 foods** spanning generic / branded / fortified. Every value is cleanly **%DV** (FatSecret's documented %RDI), and converting with the **FDA 2016 Daily Values** reproduces USDA reality to within a few %:

| Food | Field | raw (%DV) | ×DV → absolute | real (USDA) |
|------|-------|-----------|----------------|-------------|
| Cheddar | calcium | 55 | 55% × 1300mg = **715mg** | ~720mg |
| Spinach | iron | 15 | 15% × 18mg = **2.7mg** | 2.7mg |
| Spinach | vitamin A | 52 | 52% × 900µg = **468µg** | 469µg |
| Orange | vitamin C | 59 | 59% × 90mg = **53.1mg** | ~53mg |
| Big Mac | calcium | 9 | 9% × 1300mg = **117mg** | ~115mg |
| Total cereal | iron | 100 | 100% × 18mg = **18mg** | 18mg (fortified) |

The original "inconsistent units" conclusion was a **mis-estimate of the Big Mac's real calcium** (~115mg, not the ~280mg assumed) — 9%DV = 117mg is correct. FatSecret is consistently %DV.

## Decision

Emit calcium/iron/vitamins A/C/D, converting %DV → absolute via the FDA Daily Values:

| Field | Daily Value | Output key |
|-------|-------------|-----------|
| calcium | 1300 mg | `calciumMg` |
| iron | 18 mg | `ironMg` |
| vitamin A | 900 µg RAE | `vitaminAMcgRae` |
| vitamin C | 90 mg | `vitaminCMg` |
| vitamin D | 20 µg | `vitaminDMcg` |

Both extractors (`fatSecretServingMicrosPer100g` — converts then scales per-serving→per-100g; and `fatSecretServingMicrosAbsolute` — converts, no scale). Sodium/potassium/cholesterol stay as-is (already absolute mg). Zero/absent values still dropped.

## Validation

`tests/unit/fatsecretNormalize.test.ts` pins the conversions against the verified real values (cheddar/spinach/Big Mac). Existing FatSecret logs backfilled via `scripts/backfill-fatsecret-micros.ts`. Shared normaliser → web + mobile parity automatic.
