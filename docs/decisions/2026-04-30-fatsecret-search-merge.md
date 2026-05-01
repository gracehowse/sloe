# Decision log: FatSecret added as 4th source in food-search merge

**Date:** 2026-04-30
**Status:** Resolved (shipped — Lane-A wire-up)
**Trigger:** Production smoke test by Grace — every food search ("salmon", "Big Mac", "Starbucks", "Trader Joe's …") returned USDA-only despite valid Premier Free FatSecret credentials. Root cause: no `/api/fatsecret/search` route existed, and FatSecret was wired into autocomplete only — full-search results never entered the merged results UI.

---

## Decision

Wire FatSecret in as the 4th source in the food-search merge alongside USDA, Open Food Facts, and Edamam. Adds two new server routes (`/api/fatsecret/search`, `/api/fatsecret/food`) and touches both `FoodSearchPanel` files (web + mobile) plus the shared `verifyRecipe.ts` fan-out helper.

## Why this needed a fix at all

The 2026-04-26 FatSecret Premier Free upgrade landed the autocomplete typeahead row but stopped short of putting full-search results into the merge. The pre-Lane-A pipeline shape was:

```ts
// web FoodSearchPanel.tsx (pre-Lane-A)
const [usda, off, edamam, custom] = await Promise.all([
  searchUsda(q, 1),
  searchOff(q, 1),
  searchEdamam(q, 1),
  customPromise,
]);
```

```ts
// mobile verifyRecipe.ts → searchFoods (pre-Lane-A)
const usdaP = searchUsda(t, { page });
const offP = searchOpenFoodFacts(t, { page });
const edamamP = searchEdamam(t, { page });
```

FatSecret's `/foods.search` is the most reliable branded-foods source — branded queries that USDA can't serve generically (`Big Mac`, `Starbucks grande latte`, `Trader Joe's mandarin orange chicken`) only land good results from FatSecret. Without it in the merge, these queries hit the empty-state copy on production.

## Decision: wire FatSecret in as a peer source

Both web and mobile fan FatSecret out in parallel with the other three. Same trust band as Edamam (`-0.05` relevance penalty) — verified USDA Foundation rows still beat FatSecret on tie for generic queries (`tilapia raw` continues to surface the USDA row first), but a brand-strong FatSecret row outranks an empty USDA result for branded queries.

## Engineering changes

### New server routes

- `app/api/fatsecret/search/route.ts` — calls `fatSecretFoodSearch` with `maxResults=25`, maps each hit to a `SearchResult`-compatible shape:
  ```
  { foodId, label, brand, macrosPer100g, servingLabel, servingGrams, macrosPerServing }
  ```
  - Per-100g rows surface with `macrosPer100g` populated, `macrosPerServing` null.
  - Per-serving rows surface with `macrosPer100g` null (no inventing per-100g values), `macrosPerServing` populated. The on-tap detail fetch resolves the canonical panel.
  - Upstream failure → 200 with empty `hits` so the merge keeps rendering.
  - 1-indexed `page` → 0-indexed `page_number` mapping.
  - Rate-limited 60/min/user (parity with `/api/usda/search`).

- `app/api/fatsecret/food/route.ts` — calls `fatSecretFoodGet`, scales the best metric-grounded serving to per-100g via `pickBestServing` + `normalizeServingToMacros` + `servingMassGrams`. Mirrors `/api/usda/food`. Returns 422 when the food has no metric serving (no invented denominator).

### Shared helpers

- `src/lib/fatsecret/parseFoodDescription.ts` — parses `food_description` strings like `"Per 100g - Calories: 240kcal | Fat: 11.10g | Carbs: 31.20g | Protein: 4.60g"` and `"Per 1 sandwich (240g) - Calories: 540kcal | Fat: 28.00g | Carbs: 45.00g | Protein: 25.00g"`. Returns null on placeholder rows (all-zero envelopes); never invents missing macros.

- `src/lib/fatsecret/client.ts` — `fatSecretFoodSearch` now accepts an optional `{ maxResults, pageNumber }` opts arg. Defaults preserve the existing `verifyIngredients` callsite (10 results, page 1).

### Client wiring

- `src/app/components/food-search/FoodSearchPanel.tsx` — adds `searchFatSecret` + `fetchFatSecretDetail` helpers, threads FatSecret through `mergeAndDedup`, wires `Promise.all` fan-out + `loadMore`, and adds the FatSecret on-tap branch in `onPickResult`.

- `apps/mobile/components/food-search/FoodSearchPanel.tsx` — imports `getFatSecretFood` from verifyRecipe, adds the FatSecret on-tap branch.

- `apps/mobile/lib/verifyRecipe.ts` — adds `searchFatSecret` + `getFatSecretFood` exports + threads FatSecret through `searchFoods` + `mergeResults`.

## Cross-platform check

Web + mobile fan FatSecret out via the same Next.js API routes with the same envelope. `mergeResults` (mobile) and `mergeAndDedup` (web) apply the same trust band (`-0.05`). Same on-tap detail fetch shape. Selection callback shape extended on both: `source: "FatSecret"` is now a possible value in `FoodSearchSelection` (web) and `SelectedFood` (mobile).

## Tests

- `tests/unit/fatsecretSearchRoute.test.ts` — 15 tests covering route auth/validation, result mapping, pagination, parser edge cases.
- `tests/unit/foodSearchPanelFatSecret.test.tsx` — 7 tests covering the web merge wiring (parallel fan-out, brand-query surface, USDA-still-wins-on-generic, upstream-failure resilience, on-tap detail fetch).
- `apps/mobile/tests/unit/foodSearchFatSecretMerge.test.ts` — 20 source-pin tests covering both routes + the mobile + web merge wiring.

## Validation

After Vercel deploy: search "Big Mac" should now surface a FatSecret-attributed result (with the FatSecret trust dot showing). "salmon" should still surface USDA Foundation first. "Starbucks grande latte" should show FatSecret branded rows above USDA generics. The empty-state copy must NOT appear on any of those queries.

## Status of related decisions

- 2026-04-26 FatSecret Premier Free upgrade — the autocomplete piece landed; this commit closes the full-search piece.
- 2026-04-27 FatSecret attribution policy — already covers FatSecret-attributed search results in the trust-dot UX.
