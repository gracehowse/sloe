# User Journey: Verify Recipe Ingredients

**Audience:** Product / Design

## Overview
Ingredient verification matches every ingredient in a recipe against a food
database (USDA → FatSecret → fallback estimator on web; the same cascade via
the shared `verifyIngredients` pipeline on mobile) so the recipe's macros are
grounded in real nutrition data instead of a guess. Users can inspect and
correct any match — search an alternative, scan a barcode, or override the
macros by hand.

**Scope — in:** the verification/correction UI itself (matching, review,
override, save-back) on both platforms.
**Scope — out:** parsing/importing the recipe in the first place ([Import a
Recipe](import-recipe.md)), and what happens once the recipe's nutrition is
trusted enough to log ([Food Tracking](food-tracking.md)).

## Loop

This doc is the **Verify** stage of the founder's core loop:

**Import → Verify → Save → Cook/Log**

1. **Import** — a recipe is parsed from a URL, social share, or photo
   ([Import a Recipe](import-recipe.md)).
2. **Verify** *(this doc)* — every ingredient is matched against real
   nutrition data; low-confidence matches are flagged or excluded rather than
   silently included.
3. **Save** — the recipe (and its `recipe_ingredients` rows) is persisted to
   the user's Library, with `is_verified` read from the same accept floor as
   the totals.
4. **Cook / Log** — the user cooks the recipe (Cook Mode) or logs it to
   today's journal, which is where the verified macros actually reach the
   macro spine.

**What comes next:**
- **Logging the recipe** — once verified (or verified-enough), the recipe is
  logged to the daily journal. See [Food Tracking](food-tracking.md) for the
  logging flow and how a recipe's per-serving macros become a
  `nutrition_entries` row.
- **The trust rules behind this screen** — the 0.55 accept floor, why
  below-floor ingredients are excluded from totals instead of guessed, and
  why a weakly-matched recipe is *refused* at journal-write time (never
  silently logged with fabricated macros) are documented in
  [Nutrition Approximation Policy](../product/nutrition-approximation-policy.md)
  (see A1 — macro coercion refusal, and the accept-floor references
  throughout).

## Entry Points

Verification runs on the **same shared engine and the same 0.55 accept
floor** on both platforms (`verifyIngredients` / `MIN_ACCEPT_CONFIDENCE` in
`src/lib/nutrition/verifyConfidencePolicy.ts`, imported identically by
mobile's `apps/mobile/lib/verifyRecipe.ts`) — but **the surface and the
entry point genuinely differ**, not just cosmetically:

### Mobile (iOS) — post-save deep verify
Mobile has a **dedicated verify screen** (`apps/mobile/app/recipe/verify.tsx`)
reached **after** the recipe is already saved to Library:
1. "Review ingredients" button on the post-save import success sheet
2. "Edit" button on the recipe detail ingredient list
3. Direct navigation to `/recipe/verify?id=<recipeId>`

This is a real, separate screen the user can return to at any time to
re-verify or correct a saved recipe's ingredients — a "come back and fix
this later" surface.

### Web — pre-save inline verify
**Web has no dedicated verify route.** There is no `/recipe/verify`
equivalent. Verification instead runs **inline, before save**, inside the
`RecipeUpload` import/review form (`src/app/components/RecipeUpload.tsx`):
verification auto-fires 700ms after ingredients change (debounced,
`POST /api/nutrition/verify-recipe`) so the review form's macro preview is
already using real matched data by the time the user hits Save, and the same
per-ingredient search/override affordances are inline in that form rather
than on a separate screen.

**Why this is a genuine (not accidental) divergence:** mobile's save-first
import flow can persist a recipe to Library before review finishes, so
mobile needs a durable, revisitable verify surface post-save. Web's import
flow keeps the user in one continuous form until Save, so folding
verification into that form avoids an extra navigation for no benefit. Both
converge on the identical `is_verified` / accept-floor semantics once saved
— this is a **surface-shape** difference, not an **engine** or **trust**
difference.

## Flow

The step-by-step below describes the **mobile dedicated screen**. The same
logical steps happen on web, inline inside the `RecipeUpload` form, with the
differences called out per step.

### Step 1: Load Ingredients
```
Verify screen loads recipe_ingredients from Supabase
  → Each row shows: name, amount, unit, calories, confidence badge
  → Low-confidence items highlighted with yellow warning icon
  → Bottom bar shows per-serving totals
```
Web equivalent: the review form's ingredient rows populate from the parsed
import; the auto-verify call fills in matched macros + confidence in place
(no separate "load" step since there's no saved-row fetch — the ingredients
are still in local form state, not yet in `recipe_ingredients`).

### Step 2: Review Individual Ingredient
```
Tap ingredient row to expand:
  → Full macro grid (calories, protein, carbs, fat, fiber, sugar, sodium)
  → Serving size chips (g, oz, lb, tbsp, tsp, cup, ml + USDA portions)
  → Quantity input with ± buttons
  → "Search alternative" → opens FoodSearchModal
  → "Scan" → opens BarcodeScannerModal
```

### Step 3: Search Alternative
```
FoodSearchModal opens with ingredient name as initial query:
  → Shows original recipe context: "Recipe calls for: 1 lb chicken breast"
  → Results from USDA + OFF, ranked by relevance
  → Per-result: kcal, P/C/F per 100g
  → Tap result → preview with portion picker
  → Portion pre-set to match recipe amount (e.g. 1 lb → lb pill selected, qty 1)
  → "Use this" → replaces ingredient macros
```

### Step 4: Save Changes
```
Tap "Save Changes" → writes all dirty ingredients back to Supabase
  → Updates recipe_ingredients rows (preserves override_macros / added_by_user)
  → Recalculates recipe header macros (per-serving) using effectiveMacros()
  → Haptic feedback on success
  → Mobile: router.replace(`/recipe/${recipeId}`) — back to detail
    immediately so the user can log without manually navigating.
    Error path leaves the user on the verify screen with the existing
    alert so they can retry without losing edits.
```
**Web divergence:** because web verifies pre-save, there is no separate
"Save Changes" write to an already-persisted recipe in the common case —
the verified lines (`verifiedLines` / `verifiedTotals` state) are carried
into the single "Save recipe" action that first creates the
`recipes` + `recipe_ingredients` rows. There's no "back to detail"
navigation to describe because the user never left the form. (Editing an
*already-saved* web recipe's ingredients happens back on the recipe detail
page's inline edit controls, not on a dedicated verify screen — see
[Import a Recipe](import-recipe.md) Step 3/4 for the save-first nuance.)

### Step 5: Add a missing ingredient (Batch 2.7)
```
Web: "+ Add ingredient" below the ingredients list (RecipeDetail).
Mobile: "+ Add ingredient" row at the bottom of the verify screen.
  → Opens AddIngredientDialog / AddIngredientSheet
  → Name + quantity + unit + optional "Find match" (calls shared verify pipeline)
  → Optional manual macros section (label values) when no confident match
  → Save persists a new recipe_ingredients row with `added_by_user: true`
    and, when the user typed macros, `override_macros: { calories, protein, carbs, fat, fiber? }`
  → Analytics: recipe_ingredient_added { recipeId, hasMatch }
  → Live per-serving totals update immediately via recomputeRecipeTotals()
```

### Step 6: Override macros on an existing row (Batch 2.7)
```
Row action "Override nutrition" opens the override dialog / sheet
  → Number inputs pre-fill from current effective macros (override or match)
  → Save writes override_macros jsonb; Reset clears it (update → null)
  → "Override" badge shows on the row while set
  → Analytics: recipe_ingredient_overridden / recipe_ingredient_override_cleared
```

## Edge Cases
- Ingredient with confidence < 0.5 → yellow badge, user prompted to review
- Ingredient below the 0.55 accept floor → excluded from recipe totals (not
  silently included at a guessed value); see
  [Nutrition Approximation Policy](../product/nutrition-approximation-policy.md)
- Barcode scan returns no match → alert with "Not found" message
- Multiple ingredients edited → all saved atomically
- No ingredients loaded (empty recipe) → verify screen shows empty state
- User-added row with no confident match → row persists with manual / zero macros and a low-confidence flag (no silent "close enough" estimate)
- Override with all-zero fields typed → treated as "reset" (clears `override_macros`)
- Servings field 0 / negative → clamped to 1 in `recomputeRecipeTotals` (never divides by zero)
- A recipe whose gram columns explain less than 45% of its stated calories is
  coerced to a neutral 28/42/30 split for **display only**; that coerced
  recipe is **refused** at journal-write time and routed back to verify
  instead of being logged with fabricated macros — see
  [Nutrition Approximation Policy](../product/nutrition-approximation-policy.md) A1.

## Related Documents
- [Journey: Import a Recipe](import-recipe.md) — the stage before this one
- [Journey: Food Tracking](food-tracking.md) — the stage after this one (logging a recipe to the daily journal)
- [Nutrition Approximation Policy](../product/nutrition-approximation-policy.md) — the trust rules behind the accept floor and journal-write refusal
- [API: Nutrition Verification](../api/endpoints.md#post-apinutritionverify-recipe)
- [Technical: Nutrition Pipeline](../technical/architecture.md#nutrition-verification)
