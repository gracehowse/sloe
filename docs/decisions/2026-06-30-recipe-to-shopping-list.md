# Decision — Add to shopping list from any recipe (ENG-943)

**Date:** 2026-06-30
**Area:** Product / Recipes / Shopping list / cross-platform parity
**Status:** Shipped (default-ON behind `recipe_shopping_list_v1`)

## Decision

A single recipe can now feed the shopping list directly. The recipe
detail surface (web `RecipeDetail`, mobile `recipe/[id]`) carries an
"Add to shopping list" action that parses the recipe's ingredients,
aggregates duplicates silently, and **appends** them to the user's
existing list — merging with rows already there rather than replacing
the list. This closes the save→cook loop (the category-baseline gap
Paprika / Recime / Samsung Food all cover) without a new screen.

## Why append, not replace

The Plan-tab generator does a full **delete-and-replace** of
`shopping_items` (it owns the whole list for a plan). A single recipe
must NOT clobber a checked-off list or a household-mate's items, so the
recipe action **reads the live list, merges in memory, and persists
only the delta**:

- rows whose quantity/source changed → `UPDATE` (preserves `checked`),
- brand-new rows → `INSERT`.

Reading the live list first (rather than trusting in-memory state) keeps
two devices and household members consistent.

## Aggregation rules (the silent-dedup contract)

Recime is criticised for NOT merging duplicates across recipes; we do.
All logic lives in the shared, pure
`src/lib/planning/appendRecipeToShoppingList.ts` (imported by web and by
mobile via `@suppr/shared/planning/...`), reusing the existing
normaliser (`normalizeShoppingIngredientRow`), aisle guesser
(`guessGroceryCategory`), and name-key (`normalizeIngredientNameKey`):

1. **Same ingredient identity + same unit** → quantities sum, sources
   concatenate (no duplicate row).
2. **Same ingredient identity, COUNT vs WEIGHT** → folded into one grams
   row **only when both sides convert to grams at HIGH confidence**
   (`measureToGramsConfidence`, ENG-943). Otherwise the count and weight
   stay as **separate rows** — we never guess a weight on a low-confidence
   conversion (bare count of an unknown food, defaulted cup density, …).
3. **Servings multiplier** scales every numeric amount, so the list buys
   the amount shown on the recipe's servings stepper.

This honours the non-negotiable "use count-to-weight normalisation where
reasonable; if matching is uncertain, do not guess."

## Confidence gate (`measureToGramsConfidence`)

New helper on `measureToGrams.ts` classifies a measure→grams conversion:

- `"high"` — mass/volume units (g/kg/oz/lb/ml/l/tbsp/tsp), eggs, a
  count/size of a food with a food-specific per-piece weight
  (`foodSpecificCountGramsEach`), or a recognised discrete unit
  (clove/slice/rasher/tin/…) — provided the cup density was not defaulted.
- `"low"` — a bare count of an unknown food (would hit the generic 80 g
  guess), a defaulted-density cup, or an unrecognised unit.

Cross-unit aggregation fires only on `"high"`.

## Framing & trust posture

Calm "building your list" voice (the button reads "Building your list…"
while busy; the result toast/alert reads e.g. "Added 3 ingredients —
merged 2 you already had"). Lists are about ingredients — **no health
claims, no estimated-nutrition language** on this surface. Tertiary
affordance (outline pill) — the screen's filled CTAs (Save / Log) stay
dominant; tokens only.

## Parity

Web and mobile share the aggregator + the persistence client
(`appendRecipeToShoppingListClient.ts`) and the same flag
(`recipe_shopping_list_v1`, default-ON in `REDESIGN_DEFAULT_ON` on both
platforms). Surfaces:

- Web: `src/app/components/recipe/AddToShoppingListAction.tsx`
- Mobile: `apps/mobile/components/recipe/AddToShoppingListButton.tsx`

Host screens are screen-budget-pinned, so the components are self-contained
and the hosts stay net-neutral.

## Analytics

`recipe_shopping_list_added` (same name web + mobile) —
`{ recipeId, ingredientCount, addedCount, mergedCount, platform }`. No
PII; ingredient names are not sent.

## Flag / rollback

`recipe_shopping_list_v1` — default-ON (Grace's "always flag on" policy,
ENG-1279). OFF → the action is hidden and the list stays plan-only (the
legacy path, kept as the kill switch). Ramp/kill via PostHog.
