# Build 41 (1.0.0 #41) — 2026-05-01

PR: "build 42 follow-up: import title cap + seeded macros + household
sum + apple health recovery". Four targeted fixes for the four most
visible Build 40 TestFlight feedback items from Grace, sole tester.

## Fixed

- **Recipe import — caption-as-title leak (F-76 follow-up).**
  Tightened `sanitiseImportedTitle` cap from 120 to 80 chars and added
  three new layers: (a) caption-shape early-out — refuse outright when
  input is >240 chars with no structural separator; (b) split on
  em-dash / " - " (tagline punctuation, almost always); (c) split on
  `,;` when title is over-cap or has 3+ comma-clauses. Word-boundary
  clamp so titles never split mid-word. Also sanitised the
  `meta.title` fallback at the API boundary so Instagram's og:title
  (often the full caption) doesn't leak through when the LLM-extracted
  title is null.
  Files: `src/lib/recipe-import/extractSocialRecipe.ts`,
  `app/api/recipe-import/route.ts`,
  `tests/unit/sanitiseImportedTitle.test.ts`.
  Refs: TestFlight `AFVnLJIVdjQY7bkWyi0AG8A` (Build 40, 2026-04-25).

- **Seeded recipes — backfill macros from per-ingredient rows (F-71
  sibling).** New migration
  `20260503113000_seeded_recipes_macros_backfill.sql` runs on the 20
  URL-seeded Discover recipes. For rows where `recipes.calories` is
  NULL or 0 (because the source site shipped no JSON-LD nutrition),
  the migration sums `recipe_ingredients.{calories,protein,carbs,fat,
  fiber_g}` and divides by `servings` to derive per-serving values.
  Idempotent (only updates calories <= 0), HAVING `SUM > 0` guards
  against zero-sum joins, RAISE EXCEPTION if affected count > 20
  (manifest tripwire). Stage only — apply via `supabase db push
  --linked` after merge.
  Files: `supabase/migrations/20260503113000_seeded_recipes_macros_backfill.sql`,
  `tests/unit/seededRecipesMacrosBackfillMigration.test.ts`.
  Refs: TestFlight `AHQdqnRxBaTHxYN3vuzV4CM` (Build 40, 2026-04-23).

- **Household — calorie aggregation date-key bug.**
  `getMyHousehold.todayKey()` was using
  `new Date().toISOString().slice(0, 10)` (UTC date), but
  `nutrition_entries.date_key` and `household_meals.date_key` are
  written from the user's LOCAL date everywhere else. The mismatch
  around midnight (or any non-zero UTC offset) made the household
  query miss today's entries and sometimes pull yesterday's, producing
  the "calories wildly high vs target" feedback. Now uses the same
  local-calendar derivation as `dateKeyFromDate` in
  `src/lib/nutrition/journalNavigation.ts`.
  Files: `src/lib/household/householdClient.ts`,
  `tests/unit/householdClient.test.ts`.
  Refs: TestFlight `AJ_dfDvM2j6rnkOAgHTpwig` (Build 40, 2026-04-23).

- **Apple Health — persistent error recovery affordances (F-57 follow-up).**
  A connect/sync failure previously left the user with only a
  dismissed Alert + a one-line "Sync failed" text. Now an inline
  banner renders above the Connect / Sync Now button when an attempt
  failed, with two affordances: "Try again" (re-runs the failed flow)
  and "Open iOS Settings" (deep-links to Settings → Suppr → Privacy →
  Health via `Linking.openURL("app-settings:")` so the user reaches
  the permissions page in two taps). Caption underneath reminds the
  user where the permissions live. Banner clears on success and on
  retry.
  Files: `apps/mobile/app/health-sync.tsx`,
  `apps/mobile/tests/unit/healthSyncErrorRecovery.test.tsx`.
  Refs: TestFlight `ALlGgnDVP-rzqUojRWknayY` (Build 40, 2026-04-23).

## Deferred to follow-up

- **Photo-log portioning logic.** TestFlight `AGSeM-FnnYbZy6FJveUKBoc`:
  "Portioning is not logical — could have been a full breakfast and
  full lunch rather than double lunch and 0.2 breakfast." This is the
  meal-aggregate-to-slot distribution algorithm, separate from the
  AI-ranges photo-log pipeline that PR #17 rebuilt. Untracked at this
  patch level — investigate as a focused PR.

## Apply / deploy

- **Migration:** after merge, run `supabase db push --linked` to apply
  `20260503113000_seeded_recipes_macros_backfill.sql`. Do NOT apply
  via Supabase MCP `apply_migration` (project rule, CLAUDE.md).
- **Mobile:** rebuild via EAS / TestFlight to ship the import title cap
  + household date-key fix + Apple Health recovery banner.
- **Web:** auto-deploys via Vercel on merge — picks up the import
  title sanitisation at the API boundary and the household client fix
  (web `HouseholdPanel.tsx` consumes the same client).
