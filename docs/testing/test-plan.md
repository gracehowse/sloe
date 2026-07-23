# Suppr Test Plan

**Audience:** QA / Developers

**How this fits:** Process, tiers, and human-case rules live in [SYSTEM.md](./SYSTEM.md). This file is the **inventory + gap log** for automated tests.

## Test Inventory

### Unit Tests (curated inventory U01–U44; **~203** files under `tests/unit/` — see gap note)

| ID | File | Tests | Area | Priority |
|----|------|-------|------|----------|
| U01 | `calculateTargets.test.ts` | 1 | TDEE → macro targets | Critical |
| U02 | `generateMealPlan.test.ts` | 1 | Web meal plan algorithm | Critical |
| U03 | `mealPlanAlgo.test.ts` | 9 | Mobile meal plan algorithm | Critical |
| U04 | `parseIngredientLine.test.ts` | 8 | Ingredient text parsing | Critical |
| U05 | `estimateIngredientMacros.test.ts` | 25 | Local nutrition estimation | Critical |
| U06 | `measureToGrams.test.ts` | 28 | Unit → gram conversion | Critical |
| U07 | `classifyMealType.test.ts` | 18 | Meal type classification | High |
| U08 | `parseRecipeFromHtml.test.ts` | 15 | HTML recipe extraction | Critical |
| U09 | `persistence.test.ts` | 4 | localStorage snapshots | Medium |
| U10 | `portionMultiplier.test.ts` | 3 | Serving scaling | High |
| U11 | `shoppingDisplayGroups.test.ts` | 5 | Shopping list grouping | Medium |
| U12 | `smartSuggestions.test.ts` | 2 | Recipe suggestions (plan-tab overlap) | Low |
| U12b | `shoppingSmartSuggestions.test.ts` | 21 | Shopping-list overlap + macro-fit ranker (ENG-1634) | High |
| U12c | `smartSuggestionsFlagParity.test.ts` | 2 | `smart_suggestions_v1` web↔mobile default-ON parity | Medium |
| U13 | `stripeTier.test.ts` | 3 | Stripe → tier mapping | High |
| U14 | `trackerStats.test.ts` | 3 | Tracker aggregation | High |
| U15 | `imperial.test.ts` | 3 | Unit conversion | Medium |
| U16 | `edamamClient.test.ts` | 4 | Edamam food/analysis macro extraction | Critical |
| U17 | `getEffectiveTDEE.test.ts` | 5 | Adaptive vs static TDEE selection | Critical |
| U18 | `verifyPipelineOrder.test.ts` | 5 | Nutrition pipeline source ordering & confidence | Critical |
| U19 | `remainingMacros.test.ts` | 17 | `computeRemaining` and `projectRemaining` — budget math, over-budget flags, fiber column presence/absence | Critical |
| U19b | `remainingMacros.edges.test.ts` | 11 | Partial candidates (OFF/USDA missing macros), extreme values, boundary-on-the-line, zero calorie target | High |
| U20 | `weekSummaryWindow.test.ts` | 5 | `weekSummaryDateKeys` — rolling vs calendar_week, Monday vs Sunday start, week-boundary edge cases | High |
| U20b | `weekSummaryWindow.edges.test.ts` | 14 | DST boundaries, midnight anchors, Saturday anchor, month/year rollovers, normalize odd inputs | High |
| U21 | `progressWeekReport.test.ts` | 5 | `buildWeekStats` — per-day totals, averages, adherence, week-start-day offset | High |
| U21b | `progressWeekReport.edges.test.ts` | 12 | DST weeks, empty byDay, **zero target adherence guard (G4 fix)**, Saturday anchor, negative-macro clamp | High |
| U22 | `foodHistory.test.ts` | 19 | `computeFrequentMeals` (dedupe, average macros, case-insensitive, Math.round buckets, topN), `computeRecentMeals` (day order, position order, count, limit), `computeEatAgainForSlot` (excludes today, most-recent prior slot, case-insensitive slot, last meal in slot, invalid Date guard) | High |
| U23 | `favoriteFoods.test.ts` | 4 | `favoriteKey` canonicalisation — lowercase/trim/round matches DB unique index; runtime-bad-input coercion; parity with `foodHistoryKey` so star-state stays in sync | High |
| U24 | `copyMeals.test.ts` | 24 | `cloneMealWithoutId` immutability / id stripping / time override / optional-field preservation; `expandDateRange` single-day, multi-day, month / year boundaries, reversed and invalid keys; `addDays` rollover, leap-year, DST-safety (noon anchor); `todayKey` stability across times of day; `sanitizeCopyTargets` source-exclusion, dedupe, invalid-key drop, order preservation | High |
| U25 | `hydrationStimulants.test.ts` | 25 | **Batch 2.5 hydration & stimulants** — `sumWaterFromMeals` (empty, mixed, negative clamp, rounding, Number-coerced strings); preset constants (WATER/CAFFEINE/ALCOHOL quick-adds all positive, defaults match FDA + 0 alcohol spec); `weekKeysForAnchor` (Mon/Sun start, invalid anchors, all-anchors-same-week); `weeklyAlcoholG` (rolling Mon–Sun, Sunday-start slicing, missing keys → 0, non-numeric / negative / NaN clamp); `parseDayNumberMap` (rejects impossible keys like 2026-13-99, drops non-positive, rounds); `isOverTarget` gate (target > 0 and value > target only); day-isolation round-trip (add to one day doesn't leak into another). | High |
| U26 | `savedMealsLogic.test.ts` | 15 | **Batch 2.6 saved meals — pure helpers** — `summariseSavedMeal` zero / single / multi / `portionMultiplier` per-item scaling / zero-or-negative `portionMultiplier` clamped to 1 / fiber & water kept out of macro sums / non-array items coerced; `effectivePortionMultiplier` passes positives through and clamps rest to 1; `buildMealEntriesFromSavedMeal` one entry per item with fresh id, slot + timeLabel propagated, uses per-item `recipeTitle` (falls back to parent name), scales macros by `portionMultiplier` and sets output multiplier to 1, propagates source / sourceId only when present, empty combo returns `[]` and never calls `makeId`. | High |
| U27 | `savedMealsClient.test.ts` | 16 | **Batch 2.6 saved meals — Supabase CRUD** — `listSavedMeals` empty userId / parent error swallow / join items onto parent in position order / missing items yields empty-items parents; `createSavedMeal` required-field guards / parent-then-items insert / ordered `position = index` / parent delete on items-insert failure (no zombie rows); `renameSavedMeal` field guards / trim / owner-scoped update / error propagation; `deleteSavedMeal` field guards / `(id, user_id)` scoping; `incrementLogCount` field guards / read-then-write +1 with new `last_logged_at` / null row → write 1 / read error surfaces and blocks write. | High |
| U28 | `ingredientOverrides.test.ts` | 20 | **Batch 2.7 per-ingredient overrides** — `effectiveMacros` returns the override when all 4 macros are finite / falls back to matched macros otherwise / handles null/undefined defensively / ignores malformed overrides (non-finite `calories`) / surfaces `fiber` only on rows with positive finite fiberG; `hasOverride` rejects incomplete overrides; `recomputeRecipeTotals` per-serving division / override precedence / counts user-added rows / zero+negative+NaN servings clamp to 1 / fractional positive servings divide normally / all-overrides case / fiber only present when any row contributes / mixed rows (match + override + user-added + zero) / rounding contract (integer calories, 1-decimal macros) / empty list returns zeros; `sanitizeOverrideInput` returns null on empty / returns explicit-zero override when user typed zeros / coerces numeric strings including fiber / clamps negatives and NaN to 0. | Critical |
| U29 | `customFoods.test.ts` | 21 | **Batch 3.9 custom foods — pure helpers** — `scaleMacrosForGrams` linear scale / integer calories + 1-dp macros / zero & negative grams → zeros / baseGrams=0 guard (never divides by zero) / NaN-safe across all inputs / fiber echoed only when source has numeric fiber; `resolvePortionToGrams` direct grams clamp / named-serving × quantity / case-insensitive label match / unknown label throws (fail-fast — never silently log 0) / empty label throws / zero/negative quantity → 0 grams; `normaliseCustomFoodName` trim + whitespace collapse + 120-char cap + non-string coercion; `dedupeServings` drops empty labels and grams ≤ 0 / case-insensitive first-wins dedupe / whitespace-collapsed label dedupe / garbage-input safety / two-decimal gram rounding. | High |
| U30 | `customFoodsClient.test.ts` | 23 | **Batch 3.9 custom foods — Supabase CRUD** — `listCustomFoods` empty userId / error swallow / row mapping + `updated_at desc` ordering + fiber-null dropped from output; `createCustomFood` userId + name guards / name normalisation + baseGrams default 100 + kcal/macro rounding / unique-violation retries " (2)" … " (9)" then throws / first non-collision attempt wins / non-unique errors propagate without retry / dedupes servings before persist; `updateCustomFood` userId + id guards / `(id, user_id)` scoping / null brand/fiber clears / non-positive baseGrams rejected / emptied name rejected; `deleteCustomFood` userId + id guards / `(id, user_id)` scoping / error propagation; `searchCustomFoods` empty-query short-circuit / userId guard / `ilike` across name AND brand / comma+paren sanitisation inside patterns / error swallow. | High |
| U31 | `planTemplates.test.ts` | 15 | **Batch 3.10 plan templates — pure helpers** — `buildTemplateFromWeek` strips placeholders / strips leftovers / preserves recipe refs + slot + portion multiplier / divides out portion multiplier to store base macros / returns null for empty weeks / rejects whitespace-only and >80 char names / clamps dayCount to 1..7; `applyTemplateToWeek` expands dayIndex → 1-indexed DayPlan.day / scales by portionMultiplier / drops out-of-range dayIndex defensively / produces zero totals for empty days; `dayIndexToDateKey` rolls month and year boundaries / dayIndex 0 is a no-op; `validatePlanTemplate` null draft / empty name / whitespace name / dayCount 0 and 8 / slot dayIndex >= dayCount / empty slot list. | Critical |
| U32 | `leftoversPlanner.test.ts` | 13 | **Batch 3.10 leftovers + move** — `distributeLeftovers` parent yields 3 produces 2 leftovers in matching subsequent empty slots / leftover macros equal parent scaled macros (purely visual flag) / skips already-filled slots / yield 1 produces no leftovers / breakfast leftovers skip dinner slots / interleaves multiple parents on same day / never chains leftovers-of-leftovers; `markLeftoversOnSwap` removes downstream leftovers and recomputes totals / no-op when previousRecipeId is undefined; `moveMealInPlan` swaps two non-empty slots across days / moving into empty leaves source empty / preserves slot labels (Breakfast stays Breakfast) / same-source-and-dest returns input unchanged. | Critical |
| U33 | `streakFreeze.test.ts` | 24 | **Batch 4.11 streak freeze** — `availableFreezes` budget=0 disables / earned-used < cap → passthrough / earned-used > cap → clamped / used > earned → 0 / missing arrays tolerated. `computeProtectedStreak` matches raw streak when no freezes needed / spends 1 freeze on a single zero-day gap / spends multiple freezes on consecutive zero days / stops at real break once exhausted / respects `budgetMax` over earned count / grace window (today empty → start at yesterday) / zero-log user returns 0. `earnFreezeIfMilestone` fires on 7 / 14 crossings / does NOT fire 7→8 / does NOT fire on equal or decreasing streaks / fires once on 0→7 / defensive on NaN / Infinity. `dropOldFreezesForMonth` drops earned entries >90d, never touches `usedHistory`, handles invalid timestamps. `readFreezeLedger` parses valid shapes / rejects malformed dateKey entries / tolerates non-array inputs. | Critical |
| U34 | `weeklyRecap.test.ts` | 20 | **Batch 4.11 weekly recap** — `weekKeyFor` returns stable `YYYY-Www`, differs between Monday-start and Sunday-start at week boundary, stable across times within the same day. `buildWeeklyRecap` happy path with 7 logged days / partial week averages only over logged days / `weightDeltaKg=null` when <2 weigh-ins / computes delta rounded to 0.1 kg with ≥2 weigh-ins / picks highest-protein day as bestDay / zero-log week returns zeroes and `bestDay=null`. `shouldShowRecap` false mid-week (Thursday) / true Sunday evening for Monday-start / true early in the following week / suppressed when already seen this week / shows again after the week-key flips / Saturday 18:00 for Sunday-start users. `nextRecapFireDate` picks next Sunday 18:00 for Monday-start when mid-week / rolls forward past today's 18:00 / picks next Saturday 18:00 for Sunday-start. `formatRecapForShare` multi-line plain-text share copy / omits weight line when null. | Critical |
| U35 | `widgetSnapshot.test.ts` (mobile) + `widgetSnapshot.test.ts` (shared) | 12 + 3 | **Batch 5.12 iOS widget snapshot** — `buildWidgetSnapshot` at start-of-day / mid-day / over-budget (negatives preserved, never clamped) / rounding (integer kcal, integer macro grams) / fast active with explicit targetHours / default targetHours 16 when missing / out-of-range or NaN targetHours falls back to 16 / null/empty/malformed `fastStartsAt` → `fastActive=false` / non-finite macros → zero (no crash) / `now` defaults to current time when missing/invalid / kcalConsumed never negative / exported storage key + filename + tap URL constants are stable. Shared 3-test suite covers start-of-day / over-budget negatives / fastActive ISO-validation from the root runner. | Critical |
| U36 | `siriDeepLinks.test.ts` (mobile) + `siriDeepLinks.test.ts` (shared) | 33 + 6 | **Batch 5.12 Siri deep-link parser** — `parseSiriDeepLink` log water canonical / default 250 when param absent / default when blank / rounding fractional / clamp to max 5000 / reject 0 and negative / reject non-numeric / start fast canonical / default 16 when absent / non-default 18h / clamp to 48 max / reject 0 and negative / today remaining canonical / trailing slash tolerated / case-insensitive host+path / reject empty + garbage + scheme-only + no-path + unknown-path + unknown-host-action + wrong-scheme (`https:`, `other:`) / reject non-string inputs (null, undefined, number, object, array, boolean) / `buildLogWaterUrl` / `buildStartFastUrl` / `TODAY_REMAINING_URL` all round-trip through parser with defaults and custom args / builders clamp out-of-range inputs before emitting URLs. Shared 6-test suite runs canonical + scheme-rejection + round-trip from the root runner. | Critical |
| U38 | `todayProgressiveDisclosure.test.ts` | 23 | **Audit M4 (2026-04-18) Today progressive disclosure** — `isHydrationCardVisible` hides on fresh user with no target and no logs / reveals on non-zero water target / ignores zero and negative targets / reveals when `extraWaterByDay` / `waterFromMealsMl` / `extraCaffeineByDay` / `extraAlcoholGByDay` show any positive value / zero-only maps don't reveal. `isStepsCardVisible` hidden when both maps empty / reveals on any positive steps / reveals on any positive activity burn / reveals on zero-value sync entries (evidence of Health connection). `isAdaptiveTdeeHintVisible` hidden for fresh user / hidden at low confidence / reveals at medium + high confidence (matches `getEffectiveTDEE` threshold) / reveals at ≥ 14 logged days without confident adaptive TDEE / still hidden at 13. `QUICK_ADD_COLLAPSED_STORAGE_KEY` stable ("suppr-quick-add-collapsed-v1"). `parseQuickAddCollapsed` defaults to `true` (collapsed) for null / undefined / garbage / empty; serialise+parse round-trips both values. | Critical |
| U37 | `aiLogging.test.ts` | 37 | **Batch 5.13 Voice + AI photo logging helper** — `classifyConfidence` boundaries (0.4 low / 0.5 medium / 0.75 high / 0.9 high), NaN-safe clamp to 0 → low, values >1 clamp to 1 → high, negatives clamp to 0 → low. `LOW_CONFIDENCE_THRESHOLD` is 0.5 and `isLowConfidence` uses strict `< 0.5`. `aggregateTotals` empty / single / multi sums and integer rounding; fiber omitted when no item contributes and summed only across items that reported it; non-finite macros coerce to 0 (never NaN). `averageConfidence` empty list → 0 / mean clamped into [0, 1] / malformed values (5, NaN) clamp before averaging. `sanitiseAiItem` drops non-object / missing-name / whitespace-only-name / non-numeric macros / negative macros; NaN confidence clamps to 0 (low); missing confidence defaults to 0; confidence >1 clamps to 1; preserves fiber when non-negative; drops fiber when negative; preserves string `quantity` as `unit` when numeric parse fails (voice-log API shape); accepts numeric `quantity` + `unit` + `grams` together; rounds macros to whole numbers. `sanitiseAiItems` drops nulls / non-array inputs return `[]`. Low-confidence items never auto-log — CLAUDE.md "reject low-confidence matches" rule. | Critical |
| U39 | `favoriteFoodsClient.test.ts` | 16 | **M11 audit (2026-04-18) — F1 favourites CRUD** — mocked supabase-js chainable client; `listFavorites` empty userId skips supabase / error returns [] / rows map to FavoriteFood preserving newest-first order / non-array data → []; `addFavorite` userId + title guards / inserts normalised payload (trimmed title, rounded kcal, 1-dp macros) / PG 23505 unique-violation recovery fetches the existing row with owner + calories + ilike(title) / duplicate-key message recognition when code is absent / non-duplicate errors propagate without attempting recovery fetch; `removeFavorite` userId + id guards / scoped to `(user_id, id)` / error propagation; `isFavorite` empty inputs skip supabase / match filters to DB unique index (rounded calories + ilike trimmed title) / no row → false / error → false (never throws). Replaces deferred NOTE in `favoriteFoods.test.ts`. | High |
| U40 | `settingsWeekStartRoundTrip.test.ts` | 9 | **M11 audit (2026-04-18) — G8 web week-start round-trip** — mocked supabase-js chainable client; `saveWeekStartDay` userId + invalid-day guards / Monday tap dispatches `update({ week_start_day: "monday" }).eq("id", uid)` / Sunday tap same with "sunday" / supabase error propagates so the UI can roll back local state and toast; `loadWeekStartDay` empty userId skips supabase / hydrates Monday / hydrates Sunday / absent & unknown & null values → null (UI default wins) / error → null (never throws — hydration must not crash the screen). Shared helper `src/lib/nutrition/weekStartDayClient.ts` backs both web `Settings.tsx` and mobile `apps/mobile/app/(tabs)/more.tsx`. | High |
| U41 | `copyMealDialog.test.tsx` | 5 | **M11 audit (2026-04-18) — F2 web CopyMealDialog** — RTL render test; defaults target to source +1 and fires `onConfirm(["2026-04-18"])` on confirm / custom date input path / `+3 days` chip extends to 3 consecutive days starting from the primary date / picking source as target disables confirm and `onConfirm` is never called / picking source as primary plus active range chip auto-drops the source from the payload (`sanitizeCopyTargets` contract). | High |
| U42 | `duplicateDayDialog.test.tsx` | 5 | **M11 audit (2026-04-18) — F2 web DuplicateDayDialog** — RTL render test; single-day mode default (source +1) confirms with `[source+1]` / date-range mode expands inclusive range and excludes source day / reversed range (end < start) disables confirm / `sourceMealCount === 0` disables confirm entirely and shows the empty-source copy / custom single-day target picker path. | High |
| U43 | `foodSearchFitThisIn.test.tsx` | 2 | **M11 audit (2026-04-18) — G16 web fit-this-in reactivity** — RTL render test; mocks `customFoodsClient` with a seeded custom food and stubs `fetch` to empty so the only surfaced result is the seeded one; clicking it opens the portion preview and shows the "If you log this" status region / changing the quantity input from 100 g → 50 g → 200 g updates the projected-remaining kcal (1600 → 1800 → 1200) live / when consumed kcal already leaves only 200 kcal of budget, logging 100 g (400 kcal) flips the hint to "+200 over" framing. Mobile parity lives under `apps/mobile/tests/` with `@testing-library/react-native` (see hub “Post-ship #3”). | High |
| U44 | `apps/mobile/tests/unit/moreWeekStartRoundTrip.test.ts` | 6 | **M11 audit (2026-04-18) — G8 mobile week-start round-trip** — mocked supabase-js chainable client; Monday tap dispatches `update({ week_start_day: "monday" }).eq("id", uid)` / Sunday tap same with "sunday" / supabase error propagates so the More screen can roll back local state and show `Alert` / `loadWeekStartDay` hydrates Monday / hydrates Sunday / absent + unknown + error states all return null. Shares the `src/lib/nutrition/weekStartDayClient.ts` helper with web — a drift in either caller surfaces as a failure on this suite. | High |

**Note:** The unit test inventory above is not exhaustive. As of Apr 2026, `tests/unit/` contains significantly more files than listed (e.g. `adaptiveTdee`, `confidenceGating`, `confidenceScoring`, `deficitProjection`, `dietaryPreferences`, `exportNutritionCsv`, `foodSearchQuery`, `jsonLdEscape`, `mealPlanFingerprint`, `mealPlanSmartFeatures`, `mealPlanTargets`, `nutritionConfidence`, `nutritionSourceBadge`, `nutritionTrackerHelpers`, `offServingPortions`, `pepperDisambiguation`, `tdeeEdgeCases`, `rateLimitStrictFail`, `rateLimitKeyComposition`, `resolvedTier`, `shoppingListGeneration`, `socialCaptionTimes`, `socialImportSourceName`, `ssrfProtection`, `tdee`, `usdaNormalize`, `weightJourneyBaseline`, and others). This inventory should be brought up to date by running `ls tests/unit/` and adding any missing rows.

### Integration Tests (13 files under `tests/integration/`)

| ID | File | Area | Priority |
|----|------|------|----------|
| I01 | `stripe-webhook-process.test.ts` | Stripe webhook handling | Critical |
| I02 | `verify-recipe-route.test.ts` | Verify API error cases | High |
| I03 | `recipeImportPipeline.test.ts` | Recipe import pipeline | Critical |
| I04 | `accountDelete.test.ts` | Account deletion gates + transactional abort | High |
| I05 | `verify-ingredients-golden.test.ts`, `verify-ingredients-off-mock.test.ts`, `verify-ingredients-usda-mock.test.ts` | Ingredient verification | Critical |
| I06 | `userFoodsVote.test.ts` | User-foods vote route | Medium |
| I07 | `householdMealsDelete.test.ts` | Household meals DELETE / IDOR | High |
| I08 | `householdJoinLeaveRoute.test.ts` | Household join/leave + GET gates | High |
| I09 | `voiceLogRoute.test.ts` | Voice-log auth, tier, body validation | High |
| I10 | `photoLogRoute.test.ts` | Photo-log auth, tier, multipart | High |
| I11 | `stripeCheckoutRoute.test.ts` | Checkout auth + invalid tier (route-level) | High |

### E2E Tests (Playwright — 6 spec files)

| ID | File | Area | Priority |
|----|------|------|----------|
| E01 | `tests/e2e/journeys/auth-and-public.spec.ts` | Login, public pages | Critical |
| E02 | `tests/e2e/journeys/authenticated-views.spec.ts` | App shell views | High |
| E03 | `tests/e2e/journeys/core-flows.spec.ts` | Core journeys | High |
| E04 | `tests/e2e/journeys/recipe-create-paste.spec.ts` | Recipe create / paste | Medium |
| E05 | `tests/e2e/ai/suppr-natural-language.spec.ts` | AI-driven tests | Low |
| E06 | `tests/e2e/ai/views-placeholder.spec.ts` | View placeholders | Low |

---

## Human-Style Test Cases

### TC-001: Import Recipe from URL
**Area:** Recipe Import | **Priority:** Critical | **Role:** Authenticated user

**Preconditions:** User is logged in, dev server running

**Steps:**
1. I open the Import screen from the More tab
2. I paste "https://downshiftology.com/recipes/chicken-stir-fry/" into the URL field
3. I tap "Import"
4. I wait for the recipe to load
5. I see the review screen with recipe title and macros
6. I select "Dinner" and "Lunch" in the meal type picker
7. I tap "Save to Library"

**Expected:**
- Recipe title shows "Chicken Stir Fry"
- Per-serving macros are displayed (calories, protein, etc.)
- After save, success screen shows with "View recipe" and "Review ingredients" buttons
- Recipe appears in my Library tab
- Recipe has meal_type = ["dinner", "lunch"] in the database

**Edge cases:**
- Pinterest URL → should resolve to actual recipe source
- URL with no JSON-LD → should show clear error message
- Rate limited → should show "Too many requests" message
- Not signed in → should show sign-in prompt

---

### TC-002: Verify Ingredient Nutrition
**Area:** Nutrition Verification | **Priority:** Critical | **Role:** Authenticated user

**Preconditions:** User has an imported recipe in their library

**Steps:**
1. I open a recipe from my Library
2. I tap "Edit" on the Ingredients section
3. I see the verify screen with all ingredients listed
4. I tap on "chicken breast" to expand it
5. I see the full macro breakdown (cal, protein, carbs, fat, fiber)
6. I tap "Search alternative"
7. I see the search modal with "boneless skinless chicken breast" pre-filled
8. I see "Recipe calls for: 1 lb chicken breast" in italic
9. The portion is pre-set to "lb" with quantity "1"
10. I tap "Use this" on the top USDA result
11. I tap "Save Changes"

**Expected:**
- Search results show USDA data with kcal/P/C/F per 100g
- Portion pill shows "lb" selected (matching original recipe unit)
- After using a result, ingredient macros update in the list
- Per-serving totals at bottom update in real-time
- After save, recipe detail shows updated macros

**Edge cases:**
- USDA search returns no results → should show "Tap for nutrition info"
- Barcode scan returns no match → should show alert
- Very long ingredient name → should truncate with ellipsis

---

### TC-003: Daily Food Tracking
**Area:** Tracker | **Priority:** Critical | **Role:** Authenticated user

**Preconditions:** User is logged in with profile targets set

**Steps:**
1. I open the Track tab
2. I see today's date with "Day" view selected
3. I see my calorie target from my profile (not 2000 default)
4. I see four meal sections: Breakfast, Lunch, Dinner, Snack
5. I tap "ADD FOOD" under Breakfast
6. I see the quick-log form with "Log to Breakfast" title
7. I switch to "Lunch" using the slot picker tabs
8. I enter "Chicken salad", 350 calories, 30 protein, 20 carbs, 15 fat
9. I tap "Add to Today"
10. I see the entry appear under the Lunch section
11. I long-press the entry
12. I see "Delete entry" confirmation
13. I tap "Delete"

**Expected:**
- Calorie hero shows remaining (or "+X over" in red if exceeded)
- Macro progress bars show actual vs target
- Meal sections show per-slot totals
- Entry appears under the correct meal slot
- After deletion, totals update immediately
- Data persists after closing and reopening the app

**Edge cases:**
- Over budget → hero number turns red, shows "+250 kcal over"
- All four add methods work: Quick Add, Search, Scan, Previous
- Week view shows 7-day bar chart
- Navigate to previous/next day with arrows

---

### TC-004: Generate Meal Plan
**Area:** Planner | **Priority:** Critical | **Role:** Authenticated user with saved recipes

**Preconditions:** User has 5+ saved recipes with meal_type tags

**Steps:**
1. I open the Plan tab
2. I see my recipe count and day picker
3. I toggle off "Snack" in the meal slot selector
4. I select "3 days"
5. I tap "Generate Plan"
6. I see 3 days, each with Breakfast, Lunch, Dinner (no Snack)
7. Each day shows total calories and per-macro indicators (✓, +N, -N)
8. I long-press a dinner meal
9. I see alternative recipe options
10. I tap a different recipe
11. The day totals recalculate
12. I tap the "+" icon on a meal
13. I see "Logged" confirmation

**Expected:**
- Macros targets come from my profile, not hardcoded 2000
- Breakfast-tagged recipes appear only in Breakfast slot
- Days have different meals (not identical)
- Portion multiplier shows when recipe is scaled (e.g. "0.75x")
- Swap updates totals immediately
- Log button writes to today's nutrition journal

---

### TC-005: Shopping List Management
**Area:** Shopping | **Priority:** High | **Role:** Authenticated user with a meal plan

**Preconditions:** User has generated a meal plan and shopping list

**Steps:**
1. I open Shopping from the More menu
2. I see items grouped by category with a progress bar
3. I tap an item to check it off
4. I see the strikethrough and progress bar update
5. I long-press an item
6. I see "Remove item" confirmation
7. I tap "Remove"
8. I tap the trash icon in the header
9. I see "Clear shopping list" confirmation
10. I tap the share icon
11. System share sheet opens

**Expected:**
- Items grouped by category (Produce, Meat, Dairy, etc.)
- Check/uncheck toggles correctly
- "Remove X checked items" button appears when items are checked
- Clear all removes everything with confirmation
- Share opens system share sheet with unchecked items as text

---

### TC-006: Onboarding Flow
**Area:** Onboarding | **Priority:** Critical | **Role:** New user

**Steps:**
1. I create a new account
2. I am redirected to onboarding
3. I select "Lose weight" as my goal
4. I enter my stats: female, age 28, 165cm, 70kg, goal 60kg
5. I select "Moderate" activity
6. I select "Steady" pace
7. I see my calculated calorie budget
8. I select "High protein" strategy
9. I complete remaining steps
10. I see the summary screen
11. I tap "Start"

**Expected:**
- TDEE is calculated correctly from stats
- Calorie budget reflects goal (deficit for "lose")
- Profile is saved to Supabase with correct targets
- `onboarding_completed` is set to true
- Goal saved as "cut" (not "lose") in the database
- After finishing, I see the main app (not onboarding again)

---

### TC-007: Save/Bookmark Recipe
**Area:** Discover + Library | **Priority:** High | **Role:** Authenticated user

**Steps:**
1. I open the Discover tab
2. I see recipe cards with bookmark icons
3. I tap the bookmark icon on a recipe
4. The icon fills in (solid bookmark)
5. I switch to the Library tab
6. The recipe appears in my library
7. I go back to Discover and tap the bookmark again
8. The icon unfills (outline)
9. The recipe disappears from my Library

**Expected:**
- Bookmark toggle is instant (optimistic UI)
- If save fails (network error), bookmark reverts
- Console shows error message on failure
- Both bookmark icons are Ionicons "bookmark" (not stars)

---

### TC-008: Recipe Detail with Portion Adjustment
**Area:** Recipe Detail | **Priority:** High | **Role:** Authenticated user

**Preconditions:** User has a meal plan with a portion-scaled meal

**Steps:**
1. I open the Plan tab
2. I tap a meal that shows "(0.75x)"
3. Recipe detail opens with a purple banner: "Planned portion: 0.75x"
4. Ingredient amounts are scaled (e.g. "1 lb" → "0.75 lb")
5. Macro rings reflect the scaled values

**Expected:**
- Banner only shows when `?portion=` param is present
- Ingredient amounts are multiplied by the portion
- Without the param, recipe shows at 1x
- Instructions text is visible (not border-coloured)

---

## Smoke Tests (run before every release)

1. Can sign in with email/password
2. Discover feed loads with recipes
3. Can import a recipe from URL
4. Verify screen opens and shows ingredients
5. Can generate a 1-day meal plan
6. Tracker loads and shows meal slots
7. Can quick-log a meal
8. Shopping list loads (or shows empty state)

### Mobile Maestro E2E Tests

YAML flows under `apps/mobile/.maestro/` cover the mobile surface. The **default ordered suite** (`apps/mobile/.maestro/config.yaml` → `flowsOrder`) runs **29** flows; additional YAML files exist for manual / flaky / long flows (see comments at top of `config.yaml`).

| Test | What it covers |
|------|---------------|
| 00_connect | Connect to Expo dev server |
| 01_navigation | All 5 tabs load and respond; rapid tab switching regression |
| 02_today_screen | Calorie ring, macros, quick-log buttons, ring toggle, scroll, voice/search quick-log |
| 03_meal_plan | Generate plan, verify meals + macros, shopping list |
| 04_profile_settings | Sections, targets, legal links, export |
| 05_recipe_detail | Ingredients, macros, portions, save, Start Cooking, Log to journal |
| 06_burn_detail | Burn card, calorie burn detail sections |
| 07_progress | Stats grid, charts, weight journey, time range selector, empty state |
| 08_voice_log | Voice button → text input fallback |
| 09_onboarding | Full wizard: goal → basic info → activity → plan → strategy → dietary → summary |
| 10_search | Food search tab: query, USDA results |
| 11_discover | Search, filter pills, import CTA, recipe cards, scroll, import navigation |
| 12_library | Saved recipes, sort, search, empty state |
| 13_fasting | Timer ring, start/end fast, history |
| 14_weight_tracker | Weight/steps/water/body fat inputs, journey chart |
| 15_meal_nutrition | Macro breakdown for a logged meal |
| 16_shopping | Shopping list items, check off |
| 17_cook_mode | Step-by-step nav, timer, completion |
| 18_macro_detail | Per-meal breakdown for a specific macro |
| 19_paywall | Pro trial timeline, CTA, continue free |
| 20_notifications | Inbox, mark all read, empty state |
| 21_create_recipe | Create recipe: form fields, image, ingredients, meal type, publish toggle |
| 22_barcode_scanner | Barcode scanner: permission prompt, scanner UI |
| 23_nutrition_sources | Nutrition sources info: USDA, Open Food Facts, FatSecret, disclaimer |
| 24_health_sync | Health sync: feature list, nutrition import/export, connect button |
| 25_import_shared | Import shared recipe: idle state, URL input, source grid |
| 26_recipe_verify | Recipe verify: ingredient list, nutrition facts, confirm |
| 27_progress_metric | Progress metric detail: calorie/protein/streak deep dive |
| 28_notifications_prompt | Notification prompt: enable/skip flow |
| 29_more_menu | Profile/More: all settings sections, widget picker, week start, reset modal |

**In default suite (`flowsOrder`):** login/auth, navigation, today, meal journal, meal plan, profile/settings hubs, recipe detail, burn, progress, voice, search + food-search modal, discover, library, fasting, weight, meal nutrition, shopping, cook mode, macro detail, notifications, create recipe, barcode, health sync, import shared, progress metric, more menu — **29** entries (see `config.yaml` for the exact ordered list).

**Omitted from default suite (by design in `config.yaml`):** `00_connect`, `09_onboarding`, `19_paywall`, `23_nutrition_sources`, `26_recipe_verify`, `28_notifications_prompt`.

Run all (from `apps/mobile`, with Metro URL + test user): `E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e` — see `apps/mobile/.maestro/README.md` (`EXPO_DEV_SERVER_URL` defaults to `exp://127.0.0.1:8081` in the npm script).

## Regression Tests (run weekly)

Full root `npm test` (all `tests/unit` + `tests/integration`), Playwright specs you care about for the release train, the smoke checklist above, and the **29-flow** Maestro suite from `config.yaml` (or your release override — see `apps/mobile/.maestro/README.md`).

---

## Related Documents
- [Testing Overview](overview.md)
- [Technical Architecture](../technical/architecture.md)

### ENG-870 recipe claim & merge

- Unit: `tests/unit/officialRecipeClaim.test.ts` and `apps/mobile/tests/unit/officialRecipeClaimParity.test.ts` pin exact-`source_url` matching, private-stub-only badge eligibility, and rejection of self-serve / attestation-only ownership claims.
- Regression: when a claimed published recipe exists with the same exact `source_url`, web `RecipeDetail` and mobile `recipe/[id]` render "✓ Official version available" plus "Switch to official" without mutating the imported stub.
- Security: claim verification must be server-side OAuth handle, one-time bio/caption code, or DNS/meta-tag evidence plus attestation; fuzzy title/handle matching is never sufficient.
