# User Journey: Verify Recipe Ingredients

**Audience:** Product / Design

## Overview
After importing a recipe, users can verify and correct the nutrition data for each ingredient against food databases.

## Entry Points
1. "Review ingredients" button after recipe import
2. "Edit" button on recipe detail ingredient list
3. Direct navigation to `/recipe/verify?id=<recipeId>`

## Flow

### Step 1: Load Ingredients
```
Verify screen loads recipe_ingredients from Supabase
  → Each row shows: name, amount, unit, calories, confidence badge
  → Low-confidence items highlighted with yellow warning icon
  → Bottom bar shows per-serving totals
```

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
    (journey-architect 2026-04-27 Top Broken Journey #3.) Error path
    leaves the user on the verify screen with the existing alert so
    they can retry without losing edits.
```

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
- Barcode scan returns no match → alert with "Not found" message
- Multiple ingredients edited → all saved atomically
- No ingredients loaded (empty recipe) → verify screen shows empty state
- User-added row with no confident match → row persists with manual / zero macros and a low-confidence flag (no silent "close enough" estimate)
- Override with all-zero fields typed → treated as "reset" (clears `override_macros`)
- Servings field 0 / negative → clamped to 1 in `recomputeRecipeTotals` (never divides by zero)

## Related Documents
- [Journey: Import a Recipe](import-recipe.md)
- [API: Nutrition Verification](../api/endpoints.md#post-apinutritionverify-recipe)
- [Technical: Nutrition Pipeline](../technical/architecture.md#nutrition-verification)
