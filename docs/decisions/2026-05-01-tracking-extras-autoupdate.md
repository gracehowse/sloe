# Tracking-extras autoupdate from logged beverages (2026-05-01)

**Status:** Resolved.
**Authority:** TestFlight Build 40 feedback.
**Owner:** Grace.

## Problem

Multiple TestFlight Build 40 testers flagged that logging a beverage
through Quick Add / Recents / Eat-again **does not bump the daily
caffeine / alcohol counter chips on Today**, even though the original
food-search log of the same beverage does.

Verbatim:
> Alcohol and caffeine should auto update from things logged. If I log
> a cortado it should update coffee amount for example. If I log a
> glass of wine it should update alcohol amount.

## Reality check (pre-fix)

The auto-bump infrastructure already existed in F-13 (2026-04-19):

- `scaleCaffeineAlcohol` (`src/lib/nutrition/scaleCaffeineAlcoholForGrams.ts`)
  — pure helper that turns per-100 g caffeine / alcohol into a logged-
  portion delta.
- `updateStimulantsForDay` (`src/lib/nutrition/updateStimulantsForDay.ts`)
  — read-modify-write helper that applies a signed delta to
  `profiles.extra_caffeine_by_day` / `extra_alcohol_g_by_day`.
- Generic-beverages table (`src/lib/nutrition/genericBeverages.ts`)
  carrying `caffeineMgPer100ml` + `alcoholGPer100ml` for
  coffee / tea / wine / beer.

The food-search commit path (web `commitFoodSearchSelection`, mobile
`handleFoodSearchSelect`) already pipes the scaled values through the
meal's `micros.caffeineMg` / `micros.alcoholG` map and either calls
`updateStimulantsForDay` directly (mobile) or delegates to
`useNutritionJournalState.addLoggedMeal` (web), which fires the bump
fire-and-forget after the `nutrition_entries` insert succeeds. Same
shape on barcode: both platforms scale + bump in the scan-confirm
handler.

So the canonical "first time you log a cortado" path **was already
correct**. The actual gaps the testers were hitting were:

1. **Quick Add / Recents / Frequent / Eat-again re-log.** These commit
   through `logHistoryItem` (web) / `logHistoryItemToSlot` (mobile),
   which build the journal row from a `FoodHistoryItem`. The history
   item's bucket builder dropped `micros` on the floor — the
   `caffeineMg` / `alcoholG` fields never made it onto the
   re-logged journal entry, so the F-13 daily bump skipped.
2. **Meal-plan tap-to-log.** Mobile `logPlannedMealWithPortion`
   inserts the row directly with `nutrition_micros` populated, but did
   not call `updateStimulantsForDay`. Web `MealPlanner.handleLogToday`
   didn't forward `micros` either.

Both gaps mean the user's mental model breaks on the second tap of any
caffeinated drink — log a cortado from search (chip bumps), then log
"Cortado" from Recents tomorrow morning (chip stays at 0).

## Decision

**Option A** (auto-bump the tracking-extras counter when a beverage
journal row is committed) is the architecture we already use via F-13.
Reuse it on the gap surfaces:

1. Extend `FoodHistoryItem` (`src/lib/nutrition/foodHistory.ts`) with
   optional `caffeineMg` + `alcoholG`. Bucket builder reads
   `micros.caffeineMg` / `micros.alcoholG` (canonical) with a fallback
   to top-level fields, averages per-occurrence, and surfaces on the
   finalised history item. Averaging (not summing) keeps a 3x-logged
   cortado at 128 mg per tap so the daily-totals math stays additive.
2. Re-attach micros in `logHistoryItem` / `logHistoryItemToSlot` so the
   re-logged journal entry carries the same `caffeineMg` / `alcoholG`
   the original commit captured. The web path delegates to
   `addLoggedMeal` (which already fires `updateStimulantsForDay`); the
   mobile path adds an inline `updateStimulantsForDay` call mirroring
   `handleFoodSearchSelect`.
3. Wire `updateStimulantsForDay` into `logPlannedMealWithPortion`
   (mobile) and forward `micros` through `MealPlanner.handleLogToday`
   (web).

**Option B** (compute totals dynamically from `nutrition_entries`)
deliberately rejected — would require renaming
`profiles.extra_*_by_day` from a stored counter to a derived view,
breaking the manual quick-add chips that already write to it. The
existing additive-bump model preserves the user's mental model
("the chip shows what I logged") and supports manual overrides.

We are NOT adding `auto_caffeine_mg` / `auto_alcohol_g` columns to
`nutrition_entries` as the original task spec proposed — the existing
`nutrition_micros` JSONB column already carries the same data. Adding
typed columns would duplicate state and require a backfill for no
behavioural win. On delete, the existing journal-state delete handler
already reads `meal.micros.caffeineMg` / `meal.micros.alcoholG` and
posts a negative delta, so decrement parity is preserved.

## Scope caps

- **Recipes with embedded coffee / wine.** Out of scope. The recipe
  library does not aggregate caffeine / alcohol from ingredients today
  (the verifier exposes per-ingredient micros but the recipe row
  doesn't sum them). Logging "Tiramisu" or "Coq au vin" will not bump
  the counter chips. We accept this — the canonical user behaviour is
  to log the beverage explicitly. A follow-up could add
  `recipes.caffeine_mg` / `recipes.alcohol_g` fed by the verifier.
- **Saved-meal combos.** Out of scope. The `user_saved_meal_items`
  schema does not carry caffeine / alcohol columns and saving a combo
  doesn't snapshot per-100 g micros. Adding the columns would require
  a migration + a re-save flow for existing combos. Users who want
  the bump should log the cortado component directly (Quick Add will
  surface it next time via the new propagation).
- **Custom foods.** Already correctly bumped — they go through the
  same `commitFoodSearchSelection` path with `caffeineMgPer100g`
  carried on the search-result row.
- **Manual macro entry** (the "I'll just type the calories" form).
  No micros — the user gets exactly what they entered. Not a regression.

## Tests

- `tests/unit/foodHistoryStimulantPropagation.test.ts` — pins the new
  caffeine / alcohol propagation through `computeFrequentMeals`,
  `computeRecentMeals`, `computeEatAgainForSlot`, including:
  - reads `micros.caffeineMg` and surfaces it on the bucket
  - averages across occurrences, doesn't sum
  - falls back to top-level `caffeineMg` for synthetic shapes
  - rounds to integer mg / 1 dp g (matches storage shape)
  - omits the field when no occurrence carried the nutrient
  - drops non-positive / non-finite values defensively
  - partial-coverage averaging (averages over carriers, not all rows)
- `tests/unit/scaleCaffeineAlcohol.test.ts` (existing) still pins the
  per-portion scaler; unchanged.
- `tests/unit/stimulantsAutoTrackParity.test.ts` (existing) — comment
  refreshed to reflect that meal-plan logs now bump.

## Files changed

- `src/lib/nutrition/foodHistory.ts` — `FoodHistoryItem` +
  `FoodHistoryMealLike` extended with caffeine / alcohol; bucket
  builder reads `micros` first, averages per-occurrence.
- `src/app/components/NutritionTracker.tsx` — `logHistoryItem`
  re-attaches micros so quick-add re-log bumps daily totals.
- `apps/mobile/app/(tabs)/index.tsx` — `logHistoryItemToSlot`
  re-attaches micros + calls `updateStimulantsForDay`;
  `logPlannedMealWithPortion` calls `updateStimulantsForDay` after a
  successful insert.
- `src/app/components/MealPlanner.tsx` — `handleLogToday` forwards
  planner micros to `addLoggedMeal`.

## Migration

None. The existing schema (`profiles.extra_caffeine_by_day`,
`profiles.extra_alcohol_g_by_day`, `nutrition_entries.nutrition_micros`)
is sufficient.

## Parity

- Web: `logHistoryItem` + `MealPlanner.handleLogToday` updated.
- Mobile: `logHistoryItemToSlot` + `logPlannedMealWithPortion` updated.
- Saved-meal path on both platforms intentionally untouched (scope
  cap above).
