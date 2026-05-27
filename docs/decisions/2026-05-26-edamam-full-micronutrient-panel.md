# 2026-05-26 — Edamam full micronutrient panel on food log (ENG-738 Edamam half)

## Status

Resolved (implementation + tests + docs + cross-platform review). Backfill
of pre-change Edamam logs staged as a dry-run-default script; Grace runs it.

## Problem

Logging an Edamam food persisted only `fiber/sugar/sodium` into
`nutrition_micros` — so the meal-detail "Vitamins, minerals & more" card read
"Edamam did not publish vitamin or mineral data" for every Edamam-sourced
meal. That copy was inaccurate: the data IS available, we just never fetched
it.

Root cause: the search path uses Edamam's `/parser` endpoint, whose per-hit
`nutrients` block is intentionally minimal (`ENERC_KCAL / PROCNT / FAT /
CHOCDF / FIBTG / SUGAR / NA`). The full 35-field panel — fat breakdown,
cholesterol, all the vitamins + minerals — lives behind the SAME food
database's `/nutrients` POST endpoint, keyed by `foodId`, using the same
`EDAMAM_APP_ID` / `EDAMAM_APP_KEY` credentials. The code simply never called
it.

(A secondary web parity bug surfaced: web `searchEdamam` dropped the route's
minimal micros panel entirely, so before this change web Edamam logs
persisted NO micros while mobile kept the three. Fixed in the same change.)

## Fix

Mirror the USDA pattern (which threads `fdcFoodMicrosPer100g` via
`/api/usda/food`):

1. **`src/lib/edamam/client.ts`** — `fetchEdamamMicrosPer100g(config, foodId)`
   POSTs the food at exactly 100 g (gram-measure URI) to `/nutrients`, so the
   returned `totalNutrients[CODE].quantity` values are already per-100g. A pure
   `mapEdamamNutrientsToMicros` remaps each code to our canonical
   `nutrition_micros` key. **Units already match our keys (mg / mcg / g), so
   quantities are emitted verbatim — no unit conversion** (unlike OFF, which
   reports grams across the board and needs ×1000 / ×1e6). Codes not in the map
   are dropped; zero / non-finite values are dropped per the shared emit
   convention. Returns `{}` on ANY failure so it never throws into the log path.

2. **`app/api/edamam/food/route.ts`** (new) — auth-gated, per-user
   rate-limited `GET ?foodId=` route that calls `fetchEdamamMicrosPer100g` and
   returns `{ ok, microsPer100g }`. Mirrors `/api/usda/food`. Both web and
   mobile call it.

3. **Web `src/app/components/food-search/FoodSearchPanel.tsx`** — on Edamam
   select, `fetchEdamamMicros(foodId)` hits `/api/edamam/food`; the fetched
   superset is merged OVER the search-hit micros and attached as
   `microsPer100g` on the preview. The existing commit
   (`scaleMicrosForGrams(selection.microsPer100g ?? {}, grams)`) scales +
   persists it. Also threads the route's minimal micros through the search hit
   (web parity fix).

4. **Mobile `apps/mobile/lib/verifyRecipe.ts` + `components/food-search/
   FoodSearchPanel.tsx`** — `getEdamamFoodMicros(foodId)` (mirrors
   `getFoodMacros`) hits `/api/edamam/food`; the Edamam select branch merges
   it over the search-hit micros, identical to web.

### Code → key mapping (Edamam `totalNutrients` code → canonical key)

| Edamam | Canonical | | Edamam | Canonical |
|---|---|---|---|---|
| NA | sodiumMg | | VITB6A | vitaminB6Mg |
| CA | calciumMg | | FOLDFE | folateMcg |
| MG | magnesiumMg | | VITB12 | vitaminB12Mcg |
| K | potassiumMg | | VITD | vitaminDMcg |
| FE | ironMg | | TOCPHA | vitaminEMg |
| ZN | zincMg | | VITK1 | vitaminKMcg |
| P | phosphorusMg | | FASAT | saturatedFatG |
| VITA_RAE | vitaminAMcgRae | | FAMS | monoFatG |
| VITC | vitaminCMg | | FAPU | polyFatG |
| THIA | thiaminMg | | FATRN | transFatG |
| RIBF | riboflavinMg | | CHOLE | cholesterolMg |
| NIA | niacinMg | | FIBTG | fiberG |
| | | | SUGAR | sugarG |

## Nutrition correctness

- No invented values. The only data emitted is what Edamam's `/nutrients`
  returns; absent / zero / non-finite codes are dropped.
- No unit conversion — Edamam quantities are emitted verbatim per the
  unit-matched map. Misclassifying a unit would be a silent accuracy bug, so
  the map was verified against `MICRO_LINES` keys + the live request shape.
- 100 g basis means the returned quantities ARE per-100g; the commit path
  scales by `grams / 100` like every other source.

## Backfill

`scripts/backfill-edamam-micros.ts` (mirrors `backfill-off-micros.ts`):
re-finds each `source='Edamam'` entry by `recipe_title` on `/parser`, confirms
the same product via scale-invariant macro ratios (carbs/kcal + fat/kcal ±18%,
protein/kcal ±25%), calls `/nutrients`, derives grams from
`entry.calories / per100gKcal × 100`, scales the per-100g micros, and MERGES
into existing micros (never drops a real value). Dry-run by default; `--apply`
to write. Reads creds via `node --env-file=.env.local`.

## Tests

- `tests/unit/edamamClient.test.ts` — mapping fixture (verbatim units, code
  drop, zero/non-finite drop, null guard) + `fetchEdamamMicrosPer100g` request
  shape (100 g gram URI) + failure paths returning `{}`.
- `tests/unit/foodSearchPanelEdamamMicros.test.tsx` — web select→commit: tap
  fires `/api/edamam/food`, committed selection carries the full panel; a
  route failure still commits the food with search-hit micros.
- `apps/mobile/tests/unit/edamamMicrosCommit.test.ts` — mobile select→commit:
  drives the real `getEdamamFoodMicros` + real `scaleMicrosForGrams`, asserts a
  non-empty scaled `nutrition_micros`; all failure paths return `{}`.

## Cross-platform

Web and mobile both call the shared `/api/edamam/food` route with identical
merge-over-search-hit logic. No intentional divergence. The route mirrors
`/api/usda/food`; the client helpers mirror `fetchUsdaDetail` /
`getFoodMacros`.

## Owner

Grace + Claude. ENG-738 (Edamam half) — the USDA, OFF, FatSecret, and
generic-food halves of ENG-738 landed previously.
