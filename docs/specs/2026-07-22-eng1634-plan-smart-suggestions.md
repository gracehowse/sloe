# ENG-1634 — Smart suggestions v2 (overlap + macro-fit)

**Status:** Shipped behind `plan_smart_suggestions_v2` (default-on).

## What shipped

Given the user's current **shopping list / planned-week ingredient set**, recommend recipes ranked by:

1. **Ingredient overlap** (primary) — shared staples surfaced as "Also uses …"
2. **Remaining-macro fit** (secondary) — annotate/rank by how well a recipe fills the week's shortest day or an empty slot

Surfaces:

- **Plan tab** — `PlanSmartSuggestionsCard` (mobile) / `PlanSmartSuggestionsSection` (web)
- **Shopping list** — horizontal carousel at cart-building time (`ShoppingSmartSuggestionsCarousel`)

Each row includes a one-tap **Add to plan** CTA (re-syncs the shopping list via ENG-957 `plan_shopping_sync_v1`).

## Shared engine

| Module | Role |
|--------|------|
| `src/lib/planning/smartSuggestions.ts` | Overlap keys (plan + list), macro-fit slot finder, composite ranking |
| `src/lib/planning/addRecipeToPlanSlot.ts` | Place recipe + refit day portions (web + mobile) |
| `apps/mobile/hooks/usePlanSmartSuggestions.ts` | Plan-tab data (ingredients for plan ids + discover + saved) |
| `apps/mobile/hooks/useShoppingSmartSuggestions.ts` | Shopping-tab data |
| `src/hooks/useShoppingSmartSuggestions.ts` | Web shopping parity |

## Feature flag

- `plan_smart_suggestions_v2` — default-on; off → overlap-only MVP (Save CTA, vertical list)

## Analytics

- `smart_suggestion_added_to_plan` — `{ recipeId, dayIndex, mealIndex, platform, surface: "plan" | "shopping" }`
- Existing `smart_suggestion_saved` unchanged

## Tests

- `tests/unit/smartSuggestions.test.ts` — overlap, shopping-list keys, macro-fit, add-to-plan

## Related

- ENG-943 recipe → list
- ENG-957 plan edit → list sync
- ENG-983 dedupe/aisle-sort
- Distinct from ENG-958 ("Cook this twice")
