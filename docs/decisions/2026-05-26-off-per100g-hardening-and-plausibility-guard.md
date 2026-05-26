# OFF per-100g hardening + post-scale plausibility guard (P0)

**Date:** 2026-05-26
**Area:** Nutrition pipeline / correctness
**Status:** Resolved
**Owner:** nutrition-engine (root-cause) → senior product engineer (implementation)

## Problem

A recipe-import ingredient ("Chobani Greek yogurt", 500 g, OFF source) displayed
**1,325 kcal / 265 g protein** — physically impossible (265 g protein from 500 g
of yogurt = 53% protein by weight; should be ~300 kcal / ~50 g).

nutrition-engine traced every per-100g→grams conversion and confirmed the code
divides by 100 exactly once everywhere. The inflation comes from **OFF source
data**: products with `nutrition_data_per: "serving"` whose `*_100g` fields
actually hold per-serving (per-500g) values. The code trusted `energy-kcal_100g`
as genuine per-100g, so the legitimate ×5 grams-scale turned a per-500g base into
×25.

## Resolution

Three layers, all shipped with web ↔ mobile parity:

1. **OFF per-100g basis reconcile** (`src/lib/openFoodFacts/reconcilePer100g.ts`) —
   reconstructs the true per-100g from `(*_serving) / (serving_quantity/100)`,
   cross-checks against published `*_100g`, and prefers the reconstructed value
   (flagging the row low-confidence) when they disagree by >25% on a per-serving
   basis. Wired into OFF search + barcode on both platforms. Removed the
   `?? n["energy-kcal"]` / `?? n.proteins` per-serving fallbacks in
   `fetchProductByBarcode.ts` that masqueraded as per-100g.

2. **Post-scale plausibility guard** (`checkScaledLogPlausibility` in
   `macroPlausibility.ts`) — runs on POST-SCALE macros for a known gram weight.
   Thresholds: kcal/g > 9.1, protein > grams×0.95, derived per-100g ceilings
   (kcal 900 / protein 90 / carbs 100 / fat 100), and a source-basis cross-check
   (scaled kcal within 25% of `sourcePer100g.calories × grams/100` — the most
   direct catch). Generous on purpose: pure oil + protein isolate pass; the
   1,325/265 case fails.

3. **Guard wired at both write boundaries** — recipe-verify pipeline
   (`verifyIngredients.ts`, every source branch; failure rejects the candidate)
   and barcode/direct-log commit (mobile `barcode.tsx` + `BarcodeScannerModal.tsx`,
   web `today-barcode-dialog.tsx`; soft-flag "Double-check these numbers" warning
   with Edit / Log-anyway — never silent, never hard-block).

Plus a **parity footgun fix**: mobile `verifyRecipe.scaleMacros` (takes grams)
renamed to `scaleMacrosByGrams` so it can't be confused with web
`verifyIngredients.scaleMacros` (takes a factor).

## Tests

- `tests/unit/macroPlausibility.test.ts` — guard pass (oil, isolate, normal
  yogurt) + fail (the 1,325/265 case, density, ceilings) cases.
- `tests/unit/offReconcilePer100g.test.ts` — the OFF 500 g per-serving-basis row
  fixture proving reconstruction yields a sane per-100g basis, not the ×25
  inflation.
- `apps/mobile/tests/unit/offPlausibilityGateParity.test.ts` — source-pin parity
  that reconcile + guard are wired at every ingest/commit point on web + mobile,
  and that mobile exports `scaleMacrosByGrams` not a bare grams-taking
  `scaleMacros`.

## Follow-ups

- Sim-validate the barcode warning UX on mobile + web before push (Grace).
- Consider a backfill audit of already-persisted `nutrition_entries` rows that
  may carry pre-fix inflated OFF values (separate task; out of scope here).

## Related

- [Nutrition approximation policy §G1/G2](../product/nutrition-approximation-policy.md)
- F-77 — the per-100g Atwater gate this builds on (`macroPlausibility.ts`).
