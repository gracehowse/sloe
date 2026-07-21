# Estimated grocery cost per recipe (ENG-1274)

**Date:** 2026-07-20  
**Area:** Recipes tab / recipe detail (web + mobile)  
**Status:** Resolved  
**Flag:** `recipe_estimated_cost_v1` (default-OFF on both platforms)

## Context

ENG-867 shipped import loading, cook-step chips, and graceful load — but the
**Est. Cost per recipe** signal carved out as ENG-1274. Julienne shows a US
pricing estimate on recipe detail; our prototype (`Sloe-App.html`) places
`≈ £1.60 / serving` + a clay PRO pill in the v3 hero meta row.

No live ingredient→price data source exists yet. Shipping a false-precise
number would violate the nutrition-trust posture.

## Decision

Ship a **static UK reference-price estimator** behind `recipe_estimated_cost_v1`,
gated as a **Pro signal** on the v3 recipe-detail hero meta row (web + mobile).

### Data source (v1)

- `src/lib/recipe/ingredientPriceTable.ts` — ~80 common UK grocery staples,
  indicative mid-market GBP per 100 g (or per-each for eggs). Not tied to a
  retailer; not live pricing.
- `src/lib/recipe/estimateRecipeCost.ts` — sums priced lines only.

### Honest posture (non-negotiable)

1. **High-confidence grams only** — reuses `measureToGramsConfidence === "high"`;
   count guesses and defaulted cup densities are excluded (same bar as shopping-list
   merge).
2. **Coverage gate** — need ≥2 priced lines AND ≥50% of ingredient lines priced;
   otherwise render nothing (no "£0.00" fiction).
3. **Range, not a penny** — per-serving label is `≈ £low–£high / serving` when the
   spread is meaningful; a single rounded midpoint when tight.
4. **Pro gating** — Pro users see the estimate + PRO pill; Free/Base see
   `Est. cost` + PRO pill, tapping opens the paywall. No number tease without
   entitlement.

### UI placement

- v3 hero title overlay meta row only (clock · kcal · serves · cost), matching
  the prototype. Legacy meta row unchanged when v3 is off.

### Follow-ups (not in v1)

- Live price feed / regional currency (ENG-1442 currency guard already exists for
  billing; recipe cost should adopt the user's locale when a data source lands).
- Library card surfacing (issue mentioned "recipe/library surface"; prototype
  scoped detail-only — extend in a follow-up once v1 validates).

## Validation

- Unit: `tests/unit/estimateRecipeCost.test.ts`
- Source pins: web `RecipeDetail.tsx`, mobile `recipe/[id].tsx` + `RecipeDetailHero.tsx`
- Ramp: force flag ON in dev, verify hero meta on a chicken-and-rice fixture recipe,
  confirm Free shows locked upsell and Pro shows a range.
