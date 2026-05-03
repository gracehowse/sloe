# Stimulant bump centralisation + net-carbs lens focus refresh (2026-05-02)

**Status:** Resolved.
**Authority:** TestFlight tester feedback (Build 41 follow-up).
**Owner:** Grace.

## Problem

Two persistent bugs from user testing after PR #18 (tracking-extras
autoupdate) shipped:

1. **"Logging wine and caffeine still not impacting numbers."** Some log
   paths still skipped the auto-bump on
   `profiles.extra_caffeine_by_day` / `extra_alcohol_g_by_day`, so a
   subset of beverage logs left the Today chip totals stuck at the
   previous value.
2. **"Toggling net carbs on and off in setting not working."** The
   mobile "Show net carbs" toggle persists correctly, but the macro
   tile labels + values across Today, /targets, and Recipe Detail
   never reflected the change without a cold start.

## Investigation

### Bug 1 — bump gaps after PR #18

PR #18 wired the auto-bump on:

- web `commitFoodSearchSelection` + `addLoggedMeal` chain
- mobile `handleFoodSearchSelect` + `logHistoryItemToSlot` +
  `logPlannedMealWithPortion`
- mobile barcode log

Re-audit revealed two remaining gaps:

- **`insertClonedRowsIntoDay` (mobile).** Duplicating a day or
  copying a meal that contained a cortado / glass of wine carried the
  meal's `micros.caffeineMg` / `alcoholG` forward (via
  `cloneMealWithoutId`) but the new mobile insert path never called
  `updateStimulantsForDay`. Web's equivalent `addLoggedMealsForDate`
  already had the loop — straight parity gap.
- **`commitAiLoggedItems` (web + mobile).** The `AiLoggedItem` shape
  had no slot for caffeine / alcohol, so even when an upstream API
  revision could resolve "cortado" to a 95 mg caffeine reference, the
  commit path had nowhere to thread it through.

### Bug 2 — net-carbs lens stale on every focus

Web is wired correctly: `Settings.tsx` writes through `AppDataContext.setNetCarbsLensEnabled` so every consumer (`NutritionTracker`, `RecipeDetail`) re-renders with the new value automatically.

Mobile reads the flag in three independent places (`(tabs)/index.tsx`, `app/recipe/[id].tsx`, `app/targets.tsx`) and each one fired its `useEffect` only on `userId` change. The Settings sheet writes the flag, but the consumers stay mounted — `useEffect`'s dependency array never changes, so the local state is frozen at the value loaded on app launch.

## Decision

### Bug 1 fix — centralise the bump

1. New shared helper `bumpStimulantsForLoggedMeal` /
   `bumpStimulantsForLoggedMeals` in
   `src/lib/nutrition/bumpStimulantsForLoggedMeal.ts`. Reads
   `caffeineMg` / `alcoholG` from `meal.micros` (canonical home),
   falls back to top-level fields, skips the supabase round-trip
   entirely on a 0 / null / non-finite payload. Bulk variant sums
   across an array and fires one round-trip — mirrors the web
   bulk-insert pattern.
2. Refactor every existing inline bump block (web
   `useNutritionJournalState`, mobile `logHistoryItemToSlot`,
   `handleFoodSearchSelect`, `logPlannedMealWithPortion`) to call the
   helper. One source of truth for the "skip on 0, sum and round on
   bulk" rule.
3. Wire the helper into `insertClonedRowsIntoDay` (mobile gap closed)
   and `commitAiLoggedItems` (forward-compat plumbing — extends
   `AiLoggedItem` with optional `caffeineMg` / `alcoholG` so a future
   AI pipeline that can resolve "cortado" can flow stimulants through
   the existing commit shape without further code changes).
4. Parity pin (`bumpStimulantsParity.test.ts`) ensures both platforms
   import the helper and that the AI commit paths forward the
   optional fields.

### Bug 2 fix — refresh on focus

Mobile reads the lens flag through whatever refresh path each screen
already uses for profile data:

- **Today (`(tabs)/index.tsx`)** — fold `net_carbs_lens_enabled` into
  `loadProfileTargets`'s select. The existing `useFocusEffect` calls
  `loadProfileTargets`, so a return-to-tab re-pulls the flag.
- **/targets (`app/targets.tsx`)** — add a small `useFocusEffect` that
  re-reads just the lens column.
- **Recipe Detail (`app/recipe/[id].tsx`)** — same pattern.

Web is unchanged: `AppDataContext.setNetCarbsLensEnabled` already
broadcasts to every consumer.

## Out of scope

- **Recipe → log path stimulants.** `recipes` table doesn't carry
  `caffeine_mg` / `alcohol_g`; would require a schema migration +
  per-ingredient roll-up. Comment added to
  `apps/mobile/app/recipe/[id].tsx` flagging the gap. Tracked
  separately.
- **Saved-meal stimulants.** `saved_meal_items` doesn't carry
  caffeine / alcohol either. Same shape — schema migration deferred.
- **AI photo / voice caffeine + alcohol enrichment.** Per CLAUDE.md
  "no invented nutrition values" rule, the AI pipeline must source
  stimulants from a deterministic lookup (e.g.
  `genericBeverages.ts`). The plumbing on `AiLoggedItem` is in place;
  the API-side enrichment is a separate task.

## Verification

- `tests/unit/bumpStimulantsForLoggedMeal.test.ts` — 17 tests covering
  the new helper, including non-finite + negative + missing inputs and
  the bulk rounding contract.
- `tests/unit/bumpStimulantsParity.test.ts` — parity pin keeping the
  two platforms aligned.
- `tests/unit/netCarbsLensRoundTrip.test.ts` — extended with three
  pins for the mobile focus-refresh fix.
- `npm run ci` — green (1309 mobile tests, 0 typecheck errors,
  build clean).
