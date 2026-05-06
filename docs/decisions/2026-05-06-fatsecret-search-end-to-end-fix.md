# 2026-05-06 — FatSecret search end-to-end fix + multi-source food data quality

**Status:** Resolved · **Area:** food-search, nutrition data sources

## Context

TestFlight session 2026-05-06: tester searching "big mac" found that
FatSecret returned no results, USDA / Edamam macros showed raw
floats like `P 7.967347722423224g`, the meal-detail "Vitamins,
minerals & more" panel always read "did not publish", and Pret-style
Edamam entries surfaced as "1 sandwich (1 g) = 2 kcal".

Six diagnoses + fixes shipped in lock-step (PRs #98 – #103).

## Diagnoses + fixes

### 1. FatSecret silently empty in production (PR #98)
Route read `FATSECRET_CONSUMER_SECRET` (legacy OAuth 1.0a name) but
Vercel value had been renamed to OAuth 2.0 canonical
`FATSECRET_CLIENT_SECRET`. Code now reads either pair.

### 2. USDA Branded raw float decimals (PR #98)
`resolveFoodSearchHeadline` now rounds per-100g + per-serving macros
to 1dp. `P 8g` instead of `P 7.967347722423224g`.

### 3. "Vitamins, minerals & more" empty for every USDA / Edamam / FatSecret log (PR #98)
Only OFF (barcode) was passing `microsPer100g` through. Built three
new extractors (`fdcFoodMicrosPer100g`, `fatSecretServingMicrosPer100g`,
`edamamFoodMicrosPer100g`), wired through routes → client →
`onPickResult` preview → commit. USDA Big Mac now shows 17/35
fields populated. Edamam only ships fiber/sugar/sodium on
`/parser` — accurate, not a bug.

### 4. OAuth 2.0 token fall-through diagnostic (PR #99)
The `if (!res.ok) return null` in `getOAuth2Token` silently
fell through to OAuth 1.0a signing on token failure, masking the
real cause. Production logs now state status code + last 6 chars of
client_id + truncated body, so we can distinguish credentials-wrong
(400 invalid_client) from IP allowlist (403) from rate limit (429).

### 5. Edamam serving `quantity: 1` count-as-grams bug (PR #100)
Pret A Manger entries shipped `servingSizes: [{label:"Serving",
quantity:1}]` — quantity was the count of items, not the gram
weight. `pickEdamamPrimaryServing` now rejects `quantity < 3`,
falling back to the per-100g basis. 204 kcal/100g default instead
of 2 kcal/sandwich.

### 6. FatSecret empty-result diagnostic (PR #101)
Distinguishes "FatSecret data API rejected our IP and returned
empty silently" (`shape=no_foods_key`) from "the query genuinely
had no matches" (`shape=total_results=0`).

### 7. FATSECRET_CLIENT_SECRET trailing whitespace in Vercel (Grace, manual)
PR #99's diagnostic surfaced `key_tail=592a2  body={"error":"invalid_client"}`
(double-space — env value had trailing whitespace). Re-saving the
env var in Vercel cleared it.

### 8. Per-source dedup so FatSecret entries aren't dropped (PR #102)
Cross-source dedup normalised by name only — USDA's "Mcdonald's,
Big Mac" and FatSecret's "McDonald's · Big Mac" both reduced to
`mcdonaldsbigmac` and the FatSecret row was eliminated. Dedup key is
now `${source}|${normalisedName}` everywhere (mobile + web). Same-
source dupes still collapse; cross-source survives so user can pick
between USDA / Edamam / FatSecret panels — matches MFP / Cronometer /
Lose It UX.

### 9. Edamam stub filter (PR #102)
"Big Mac Salad" / second "McDonald's · Big Mac" surfaced un-clickable
because Edamam shipped them with calories=0 + zero macros. Filter at
the merge stage — `calories <= 1 AND protein+carbs+fat < 0.5g` is
clearly broken data, dropped.

### 10. FatSecret per-serving-only foods (PR #103)
McDonald's Big Mac in FatSecret has NO `metric_serving_amount` —
`food.get` returns "1 serving" with no gram weight. Route used to
422 ("no_metric_serving"), making the entry untappable. Now route
sets `macrosPer100g: null` + adds `macrosPerServing` so caller can
log "1 serving = 580 kcal" without scaling. Wired through 5 commit
sites (Today log, create-recipe, recipe wizard, import-shared,
recipe verify).

## Net behaviour

For "big mac" search after all 6 PRs deploy:

- USDA "Big Mac (McDonalds)" — per-100g, full vitamins/minerals
- USDA "Mcdonald's, Big Mac" — per-100g, full vitamins/minerals
- Edamam "McDonald's · Big Mac" — per-100g, fiber/sugar/sodium only
- FatSecret "McDonald's · Big Mac" — `1 serving = 580 kcal`,
  Premier panel (sat fat, cholesterol, calcium, iron, potassium)
  when food.get publishes them

## Outcomes

- Production FatSecret search functional for the first time since
  the integration was wired (Lane-A 2026-04-30).
- Meal-detail panel populates for USDA / FatSecret / Edamam /
  OFF logs going forward (existing logs aren't backfilled).
- 22 new test pins (USDA micros: 9, FatSecret micros: 5,
  per-source dedup: 2, food-search rounding: 2, Edamam serving floor:
  4) lock the regression bar.

## Followups

- **Upgrade Edamam tier** if richer micros for restaurant items
  becomes important. Current Food Database `/parser` doesn't ship
  vitamins or minerals beyond sodium; the Nutrition Analysis API
  does but uses a different ingredient-line input shape. Worth a
  separate decision when nutrition completeness moves higher in the
  priority stack.
- **FatSecret Premier vitamin units** — A/C/D currently NOT emitted
  because FatSecret returns inconsistent units (sometimes %DV,
  sometimes mcg/IU) and we won't fabricate. Could revisit if a
  unit-detection heuristic emerges.

## PR list

- #98: env-rename + macro rounding + micros pull-through
- #99: OAuth 2.0 token failure-mode diagnostic
- #100: Edamam <3g serving floor (count-as-grams bug)
- #101: FatSecret empty-result diagnostic
- #102: per-source dedup + Edamam stub filter
- #103: FatSecret per-serving-only food support
