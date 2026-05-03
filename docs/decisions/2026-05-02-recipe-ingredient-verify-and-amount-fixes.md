# Recipe ingredients: persist verified state + fix duplicated amount render (2026-05-02)

**Status:** Resolved.
**Authority:** TestFlight Build 41 user feedback (Grace, sole tester) — two bugs visible on `/recipe/[id]` ingredients tab.
**Owner:** Grace.

## Problem

Two bugs surfaced in user testing on the recipe-detail Ingredients tab:

### Bug 1 — "Partial match" persists after manual verify

Quote: _"still says partial match even when I have updated it myself"_.

Repro: a recipe-ingredient row "Chicken breast, rotisserie, skin not eaten" rendered "69% · Partial match" with an orange dot and a Verify CTA — even after the user had stepped through `/recipe/verify`, picked a USDA match, and saved.

### Bug 2 — Amount renders "1 1 breast" (duplicated tokens)

Repro: the same chicken row rendered the quantity as "1 1 breast" instead of "1 breast" (visible in the user's screenshot).

## Reality check

### Bug 1 — three contributing causes

1. **Mobile read path used the wrong column.** `apps/mobile/app/recipe/[id].tsx` derived its row label, dot colour, and Verify CTA gating from the persisted `confidence` numeric column alone:

   ```ts
   const conf = ing.confidence != null ? Number(ing.confidence) : null;
   const confPct = conf != null ? Math.round(conf * 100) : null;
   const confColor = confPct >= 75 ? success : confPct >= 50 ? warning : destructive;
   const confLabel = confPct >= 75 ? "Verified" : confPct >= 50 ? "Partial match" : ...;
   {(confPct == null || confPct < 75) && recipeId ? <VerifyCTA /> : null}
   ```

   `is_verified` was never read from the SELECT.

2. **Mobile write path didn't persist the new confidence.** `apps/mobile/lib/verifyRecipe.ts:saveVerifiedIngredients` writes `is_verified, source, override_macros` on the per-row update but did NOT write `confidence`. The verify search picker sets in-memory `confidence: 1.0` on match, but that value never reached the DB — so the next read brought back the original AI score (e.g. 0.69) and the row reverted to "Partial match" forever.

3. **Web write path had the same gap.** The inline-verify update inside `src/app/components/RecipeDetail.tsx` also wrote `is_verified: true` without bumping `confidence`. Web's render path used `isVerified` directly so the dot/CTA were correct on web — but the persisted state still contradicted the user once mobile read the same row.

### Bug 2 — count-prefixed portion labels in the unit column

USDA / FatSecret / Edamam / GenericFoods sometimes publish portion descriptions that already carry a count, e.g. `"1 medium (182g)"`, `"1 cup sliced (165g)"`, or `"1 breast"`. The verify search picker writes `unit = chosenPortion.label` and `amount = quantity` (typically `1`). The recipe-detail render template was:

```ts
// mobile
`${Math.round(ing.amount * portionMultiplier * 100) / 100} ${ing.unit ?? ""}`
// web
`${formatIngredientAmount((parseFloat(amount) * servings) / baseServings)} ${unit}`
```

Both produce `"1 1 breast"` when `amount=1` and `unit="1 breast"`.

## Fix

### Two new shared helpers in `src/lib/recipe-ingredients/`

- **`formatIngredientAmount.ts` — `formatIngredientAmountUnit(amount, unit)`.** Defensive amount/unit renderer that dedupes the duplicated-token cases (`amount=1, unit="1 breast"` → `"1 breast"`; `amount=1, unit="1 medium (182g)"` → `"1 medium (182g)"`) without losing real distinctions (`amount=2, unit="1 breast"` → `"2 1 breast"` so the mismatch is still visible).

- **`ingredientVerificationStatus.ts` — `deriveIngredientVerificationTier`, `ingredientShouldShowVerifyCta`.** Single source of truth for the row label, dot colour, and Verify CTA gating. Tier resolution order: `is_verified=true` → verified; trusted source (USDA/FatSecret/OFF/Edamam/manual/user/custom/barcode) → verified; otherwise fall back to confidence buckets at 0.75 / 0.5 / >0.

### Call-site changes

- `apps/mobile/app/recipe/[id].tsx`
  - Added `is_verified` to both `recipe_ingredients` SELECT statements (initial load + post-verify reload).
  - Added `is_verified` to the `Ingredient` row type.
  - Replaced the row-level confidence-bucket logic with `deriveIngredientVerificationTier({isVerified, confidence, source})`. Verify CTA gates on `ingredientShouldShowVerifyCta(tier)`.
  - Verified rows now render the bare "Verified" tier label (no stale percentage).
  - Quantity render routes through `formatIngredientAmountUnit`.

- `apps/mobile/lib/verifyRecipe.ts`
  - `saveVerifiedIngredients` per-row update now writes `confidence` so the persisted row state agrees with the post-verify in-memory state.

- `src/app/components/RecipeDetail.tsx`
  - Row dot + Verify CTA route through the same shared helpers.
  - Quantity render routes through `formatIngredientAmountUnit`.
  - Inline-verify update writes `confidence: 1.0` (and mirrors it into the in-memory row) when the user picks a new match.

## Tests

- `tests/unit/formatIngredientAmountUnit.test.ts` — 13 cases covering canonical inputs, dedupe variants, case-insensitivity, scaling mismatch, empty/null inputs, non-finite numbers.
- `tests/unit/ingredientVerificationStatus.test.ts` — 10 cases covering `is_verified=true` overriding stale confidence, trusted-source belt-and-braces, threshold boundaries, and the user-reported symptom (69% confidence + is_verified=true → "verified" + no CTA).
- `tests/unit/recipeIngredientVerifyAndAmountFixes.test.ts` — 10 source-string pins ensuring web + mobile both wire up the shared helpers and the persistence fix.
- `tests/unit/uiConsistencyRound2.test.ts` — D22 test updated for `confLabel` → `tierLabel` rename.

## Parity

Web and mobile share both helpers verbatim. Behaviour, label strings, and CTA gating are identical. Web wires through the same write-path persistence fix as mobile.

## Refs

- `apps/mobile/app/recipe/[id].tsx`
- `apps/mobile/lib/verifyRecipe.ts`
- `src/app/components/RecipeDetail.tsx`
- `src/lib/recipe-ingredients/formatIngredientAmount.ts`
- `src/lib/recipe-ingredients/ingredientVerificationStatus.ts`
