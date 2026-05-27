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

## ENG-738 follow-on — micros/fiber/sugar/sodium SCALE fix (2026-05-26)

Layer 1 above reconciled only the four **macros** (kcal/protein/carbs/fat). The
**micros + fiber/sugar/sodium** at every OFF call site were still read straight
off the raw `*_100g` fields — which on a `nutrition_data_per:"serving"` row hold
per-serving values — so they were at the wrong scale for serving-basis products
(the same root cause, one layer deeper).

Fix:

1. `reconcileOffPer100g` now also returns **`per100gFactor`** — the multiplier
   that converts a raw `*_100g` value to true per-100g. It is the *same*
   transform `reconcileOne` applied to the macros: when the row was `corrected`
   (serving-basis, mislabeled) it is `recon.calories / rawEnergyKcal100g`
   (guarded `rawEnergy > 0`), falling back to `100 / serving_quantity` when
   energy is absent; otherwise `1` (the common per-100g case — a no-op). A
   degenerate ratio (NaN / ≤0) clamps to `1`, never scaling by garbage.

2. `parseOffMicrosPer100g(n, factor = 1)` takes the factor and multiplies the
   raw `*_100g` read before unit-conversion + rounding. Every OFF call site now
   derives `const f = recon.per100gFactor` and applies it to the micros call and
   to the raw `fiber/sugar/sodium` (and `caffeine/alcohol`) reads. Macros keep
   using `recon.*` — **macro reconciliation behaviour is unchanged.**

3. Fixed the last divergent call site: web `FoodSearchPanel.searchOff` was
   reading raw `*_100g` with **no reconcile at all** and its OFF fetch omitted
   `nutrition_data_per` / `serving_quantity`. It now requests those fields,
   reconciles macros, and scales micros by `f` — consistent with the other four
   sites.

Call sites touched (all read `recon.per100gFactor`):
`searchProducts.ts`, `fetchProductByBarcode.ts`, web `FoodSearchPanel.tsx`,
and the two OFF mappings in mobile `verifyRecipe.ts` (search + `lookupBarcode`).
The two helpers live under `src/lib/openFoodFacts/` and are imported byte-for-
byte by mobile via `@suppr/shared/openFoodFacts/*`, so the logic is shared.

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

ENG-738 micro-scale tests:

- `tests/unit/offReconcilePer100g.test.ts` — `per100gFactor` derivation:
  energy-ratio form, `100/serving` energy-absent fallback, factor=1 for
  per-100g / no-serving rows, and the never-degenerate clamp.
- `tests/unit/parseOffMicros.test.ts` — the **correctness gate**: a known
  `serving_quantity:30` serving-basis OFF product whose `*_100g` micro fields
  hold per-30g values; asserts reconciled micros equal raw × (100/30) (true
  per-100g) and that a per-100g twin leaves micros unchanged (factor 1). Plus
  the factor-default and garbage-factor guards on `parseOffMicrosPer100g`.
- `apps/mobile/tests/unit/offMicrosServingScaleParity.test.ts` — the mobile twin
  of the gate, run through the `@suppr/shared/*` resolution path.
- `apps/mobile/tests/unit/offMicrosPullThroughParity.test.ts` — source-pin parity
  that every OFF call site derives `const f = recon.per100gFactor` and applies it
  to micros + fiber/sugar/sodium (incl. the newly-reconciled web FoodSearchPanel).

## Follow-ups

- Sim-validate the barcode warning UX on mobile + web before push (Grace).
- Consider a backfill audit of already-persisted `nutrition_entries` rows that
  may carry pre-fix inflated OFF values (separate task; out of scope here).

## Related

- [Nutrition approximation policy §G1/G2](../product/nutrition-approximation-policy.md)
- F-77 — the per-100g Atwater gate this builds on (`macroPlausibility.ts`).
