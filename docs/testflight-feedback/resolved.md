# TestFlight → prod — resolved

Short log of tester-reported issues that were fixed in production (or schema), with enough context for release notes and drift audits.

## 2026-04-18 — Trial / payments "not hooked up" (mobile paywall silent fall-through)

- **ASC feedback id:** `AFE6h9Tlq0bUCugLAJfVGx8` — "None of the trial/payments stuff is hooked up".
- **Cause:** `apps/mobile/app/paywall.tsx:onStartTrial` had `if (!pkg) router.replace("/notifications-prompt")` — when RevenueCat returned no offerings (TestFlight + App Store Connect IAP not yet provisioned, or sandbox account not signed in), tapping **Start trial** silently routed to the next onboarding screen as if the purchase succeeded. From the tester's POV nothing happened — no Apple pay sheet, no error, no entitlement. Looked entirely unhooked.
- **Fix:** the `!pkg` branch now surfaces a labelled `Alert.alert` ("Subscriptions not available" + reason — "couldn't load any plans" vs "subscriptions aren't enabled in this build" depending on `isPurchasesApiKeyPresent()`) with two buttons: "Continue free" (explicit) and "OK" (stay on the screen). On a successful `purchasePackage` we now also verify `isProEntitled(customerInfo)` before advancing — a transaction can return `success:true` before the entitlement propagates, and we don't want to celebrate a non-entitled state.
- **Verify:** in TestFlight without provisioned IAP, tapping Start trial now shows the alert (no silent route). Once App Store Connect IAP products + RevenueCat dashboard offerings are configured, the alert path is bypassed automatically (a non-empty `packages` array triggers the real purchase sheet).
- **Out of scope (config, not code):** App Store Connect IAP product IDs + RevenueCat dashboard offerings still need to be provisioned for the live trial flow. That's a release-gate task for the monetisation milestone, not a TestFlight bug.

## 2026-04-18 — Edamam restaurant + branded foods integration

- **ASC feedback id:** `AOI9xgY88Dx-uphiXI8IzEk` — "Unclear if edamam is integrated yet? I would expect meals to show here from restaurants etc."
- **Cause:** `src/lib/edamam/client.ts` existed (configured server-side via `EDAMAM_APP_ID` / `EDAMAM_APP_KEY`) but it was only used inside `verifyIngredients` for ingredient-line resolution. There was no client-callable surface that exposed the food / restaurant database, and neither the Today food search nor Discover surfaced any Edamam content.
- **Fix:** wired Edamam into both surfaces the user asked for.
  - **API route** `app/api/edamam/search/route.ts` — auth-gated, rate-limited (30/min), wraps `edamamFoodSearch` and returns a `{ foodId, label, brand, calories, protein, … }` envelope shaped to match `/api/usda/search` so the mobile merger can absorb it. Supports `mode=foods` (general) and `mode=meals` (filters to restaurant + packaged categories for Discover).
  - **Today Add Meal (mobile)** — new `searchEdamam()` helper in `apps/mobile/lib/verifyRecipe.ts` runs in parallel with USDA + OpenFoodFacts; `searchFoods()` streams partial results as each source resolves so USDA stays instant. New `Edamam` source variant in `UnifiedSearchResult`; `FoodSearchModal` picks it up via the inline-macros tap branch (no extra fetch). Restaurant rows get a "Restaurant · {brand}" subtitle.
  - **Discover (mobile)** — new "Eating out" horizontal carousel above the recipe grid; only renders when the search query is ≥ 3 chars (debounced 350ms so each keystroke doesn't burn quota). Each card shows brand + label + per-100g kcal/protein. Tapping bridges to Today with the search prefilled. Empty / loading states are first-class.
- **Verify:** in TestFlight, open Today → Add Meal → search "eggs benedict" — Egg, Benedict (USDA generic) appears alongside any restaurant matches from Edamam. Open Discover → type "burger" — the "Eating out" row appears with brand-tagged restaurant items.
- **Web parity:** landed in the same pass (2026-04-18). `src/app/components/FoodSearch.tsx` now imports a `searchEdamam()` helper that calls the same `/api/edamam/search` route in parallel with USDA + OFF; merger widened to take a fourth source array. `src/app/components/DiscoverFeed.tsx` adds the same "Eating out" horizontal scroll row (debounced 350ms, hidden until the query is ≥ 3 chars). Mobile + web are now feature-equivalent for this surface.

## 2026-04-18 — Progress Daily Calories chart "not intuitive"

- **ASC feedback id:** `AISAWnLgU9cjRBOuEY-HuJU` — Progress tab "not intuitive" (screenshot retrieved 2026-04-18, showed bars in green/amber with no intake-target line and no legend).
- **Cause:** the bar colours encoded "at/under target" vs "over target" but there was no on-chart reference to show where the target sat, and no legend to explain the colours. Users couldn't read the chart without inspecting every bar.
- **Fix:** added (a) a dashed accent-coloured target line drawn across the full chart at `targets.calories`, positioned absolutely over the bar grid (`pointerEvents=none` so bars stay tappable); (b) an inline legend under the chart — green swatch "At or under target", amber swatch "Over target", dashed line "Target {N} kcal". `apps/mobile/app/(tabs)/progress.tsx`. The "Daily goal" text-only line below the chart is replaced by the legend.

## 2026-04-18 — Weight section: start-of-range callout + milestone-tent journey bar (follow-on)

- **ASC feedback id:** `AF7bS2DQrH_wZWxGosBJ3K8` (cosmetic polish, follow-on to the same item logged below).
- **Fix:** in `apps/mobile/components/charts/TrendLine.tsx`, added a start-of-range callout pill rendered next to the leftmost data point (label uses the same `formatValue` formatter as the rest of the chart). In `apps/mobile/app/weight-tracker.tsx`, replaced the bare progress bar in the Journey card with a tent (⛺) → bar → flag/trophy (🏁/🏆) anchored layout, with start-pill ("0 kg") and end-pill (total to lose) bracketing the fill — closer to the LoseIt reference. Tent emoji ⛺, finish flag 🏁 (or trophy 🏆 when goal hit) — emoji-only so no asset pipeline change.

## 2026-04-18 — Macro Detail "duplicate 79.4g" MFP rows

- **ASC feedback id:** `ABwH6OVJ-kJxC5LdcL3iEzc`. Screenshot: "Protein · Yesterday · 204.3g" split as Dinner 79.4g / Snacks 79.4g / Breakfast 45.5g — Dinner and Snacks showed **identical** numbers from the same MFP sync.
- **Cause:** the MFP bulk-sync collapse bug documented under "HealthKit macro inflation" below — multiple foods flushed at the same `startDate`/`endDate` were being summed into one entry, then the same summed value was being attached to different meal slots by the day-level breakdown.
- **Fix:** implicitly resolved by the P0-2 correlation-UUID fix in `apps/mobile/lib/healthSyncCorrelation.ts` (same pass, 2026-04-18). Once each energy sample gets its own correlation parent, the macro values attach to the right food and the breakdown no longer shows duplicate 79.4g rows.
- **Verify:** re-import a multi-meal MFP day from HealthKit; open Macro Detail → Protein for that day; each meal row should carry its own macro value matching what MFP showed, not duplicates.

## 2026-04-18 — Weekly-recap toggle "could not save"

- **ASC feedback id:** `AMsdTaWai1sJijvuX1VQJg4`. Screenshot: Settings → Weekly recap bottom sheet → "Could not save · We couldn't save your preference. Please try again." alert.
- **Cause:** same schema-drift family as the earlier alcohol-limit save failure. The toggle writes `profiles.weekly_recap_push_enabled` (shipped in migration `20260421170000_streak_freeze_weekly_recap.sql`) but the column was missing on prod when the tester submitted, so the update call errored.
- **Fix:** the 2026-04-18 `supabase db push --linked` through `20260421180000` applied that migration. Verified on prod: `select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='weekly_recap_push_enabled';` returns one row.
- **Verify:** Settings → Weekly recap → toggle on/off → no "Could not save" alert; state persists across force-quit.

## 2026-04-18 — Weight section: delta stat + goal-line label

- **ASC feedback id:** `AF7bS2DQrH_wZWxGosBJ3K8` (5 screenshots — LoseIt references).
- **Cause:** The existing `apps/mobile/app/weight-tracker.tsx` showed current + goal as side-by-side stats but no **directional delta** (e.g. "↑ 1.4 kg past 3 months") in the chart-card header, and the dashed goal line on the chart carried no inline numeric label — both of which the tester's reference screenshots made prominent.
- **Fix (narrow):**
  - Added a `rangeDelta` memo to `weight-tracker.tsx` that computes `last − first` over the selected `TimeRange` and produces `{ arrow, magnitude, unit, label }`. Arrow is `↑ / ↓ / →`; label resolves to "past week / past month / past 3 months / past 6 months / past 9 months / past year / since <first date>".
  - Rendered the delta in the Weight card header, right-aligned next to the title.
  - Added an inline numeric goal label at the right edge of the dashed goal line inside `apps/mobile/components/charts/TrendLine.tsx` (new `SvgText` node) so the goal number is legible on the chart itself, not only in the legend underneath.
- **Deferred (logged, not shipped):** start-of-range callout pill ("54.1") at the leftmost chart point; milestone-tent progress bar in the Journey card. Both cosmetic polish; kept in `docs/planning/testflight-build-7-remaining.md` under P1-2 as follow-on polish.
- **Screenshots:** archived under `docs/testflight-feedback/data/screenshots/AF7bS2DQrH_wZWxGosBJ3K8/weight_{1..5}.jpg` (gitignored along with the rest of `data/`). Force-add if you want to preserve a snapshot for a design review.

## 2026-04-18 — APNs push token registration

- **ASC feedback ids:** `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`. Both: iOS notification prompt re-fires every cold launch and no notifications ever deliver.
- **Cause:** `apps/mobile/app/notifications-prompt.tsx` called `requestPermissionsAsync()` and stored nothing. There was no `getExpoPushTokenAsync` call anywhere in `apps/mobile/`, so no Expo push token was ever written to Supabase — the server had no address to push to. The prompt also re-appeared every launch because permission state was not persisted client-side after the first grant. `profiles` had no column to store the token in either.
- **Fix:**
  - **Schema:** new migration `supabase/migrations/20260423100000_profile_expo_push_token.sql` adds `profiles.expo_push_token text` (nullable, no default), idempotent, with `notify pgrst, 'reload schema'` at the end.
  - **Helper:** new `apps/mobile/lib/expoPushToken.ts` owns the lifecycle:
    - `registerExpoPushTokenForUser(userId)` — fetches the Expo token using `Constants.expoConfig.extra.eas.projectId`, writes `profiles.expo_push_token` for the current user, and caches the value in AsyncStorage under `expo_push_token_last_synced_v1`.
    - `refreshExpoPushTokenIfChanged(userId)` — focus-effect refresh; no-ops when the cached value matches, writes when the token has rotated (reinstall / restore-from-backup).
    - `markNotificationsPromptDismissed()` / `hasNotificationsPromptBeenDismissed()` — own the AsyncStorage flag `notifications_prompt_dismissed_v1` so the prompt screen and any future re-entry point share one source of truth.
  - **Prompt screen** (`apps/mobile/app/notifications-prompt.tsx`):
    - On mount: checks `hasNotificationsPromptBeenDismissed()` (AsyncStorage flag OR OS already reports `granted` / `denied`) and `router.replace`s away without rendering when truthy. Renders nothing during the check so the explainer never flashes.
    - On grant: calls `registerExpoPushTokenForUser(userId)` then `markNotificationsPromptDismissed()`.
    - On denial / skip: calls `markNotificationsPromptDismissed()` so a deliberate "no" doesn't re-nag every launch.
    - Errors swallowed via `console.warn` per existing notification-prompt error pattern (no crash on simulator / no-network / RLS hiccup).
  - **Token rotation:** `apps/mobile/app/(tabs)/index.tsx` adds a new `useFocusEffect` calling `refreshExpoPushTokenIfChanged(userId)`. Cheap because the helper short-circuits on cache hit.
  - **Generated types:** `apps/mobile/lib/database.types.ts` and `src/lib/supabase/database.types.ts` both updated by hand to add `expo_push_token: string | null` (Row, Insert, Update) so client writes type-check.
- **Verify:**
  1. Fresh install on TestFlight: open app, see explainer, tap "Turn on notifications", grant. Force-quit and re-launch → no prompt re-appears.
  2. Decline path: fresh install, tap "Skip" or deny in OS dialog → no prompt re-appears.
  3. After a successful grant, query `select expo_push_token from public.profiles where id = '<user>';` — non-null `ExponentPushToken[...]` value present.
  4. Send a test push from the Expo push tool (`https://expo.dev/notifications`) targeting that token — notification arrives.
- **Tests:** `apps/mobile/tests/unit/expoPushToken.test.ts` (17 tests) covers:
  - `hasNotificationsPromptBeenDismissed` — AsyncStorage flag, OS `granted` / `denied` / `undetermined` paths.
  - `registerExpoPushTokenForUser` — happy path (correct project ID, correct DB write, cache populated), null-user, fetch-failure, DB-failure.
  - `refreshExpoPushTokenIfChanged` — no-op on cache hit, write on rotation, skip when permission revoked.
  - Source-level pins on `notifications-prompt.tsx` (helpers wired on mount + both exit paths) and `(tabs)/index.tsx` (focus-effect refresh wired).
  - All 155 mobile vitest tests still pass.
- **Server-side delivery (still missing — NOT fabricated):** the existing weekly recap (`apps/mobile/lib/weeklyRecapPush.ts`) uses `expo-notifications` `scheduleNotificationAsync` with a `WEEKLY` trigger — that is a **local** notification and does not consume `profiles.expo_push_token`. There is no server route today that POSTs to `https://exp.host/--/api/v2/push/send`. This pass adds the column, the client write, and the suppression flag so the address book is finally being populated; building the server-side fan-out (and switching the recap from local to remote, if/when desired) is a separate piece of work tracked in `docs/planning/testflight-build-7-remaining.md` P0-1's follow-up — not invented in this commit.
- **Follow-up:**
  - Migration file is committed but `supabase db push --linked` was **not** run from this session (sandbox blocked the supabase CLI). The user must apply with `supabase db push --linked` (or `supabase db query --linked -f supabase/migrations/20260423100000_profile_expo_push_token.sql` for an idempotent one-off) before the client write can land in prod.
  - Once a server-side push delivery path lands, add an integration test that reads `profiles.expo_push_token` and forms a valid Expo push payload (skipped here per the "don't fabricate a server route" constraint).

## 2026-04-18 — HealthKit macro inflation (MFP bulk sync)

- **ASC feedback id:** `AJHZNp8NHTiFNk9TjQfdYBk` (TestFlight build 7) — a day imported from MyFitnessPal via Apple HealthKit showed carbs dramatically higher than the actual MFP daily total.
- **Cause:** `apps/mobile/lib/healthSync.ts:syncNutritionFromHealth` correlated dietary energy + macro samples by an `effectiveMinute|bundleId` key (`dietaryCorrelationKey`). MFP (and other third-party loggers) often flush an entire day's foods in a single batch where every food shares `startDate = local midnight` (or sync time). When N energy samples from the same `bundleId` landed in the same minute bucket, **all** their carbs / protein / fat were summed into one `nutrition_entries` row — a single inflated entry per day instead of one row per food.
- **Fix:** New pure helper module `apps/mobile/lib/healthSyncCorrelation.ts` keys dietary samples by their HealthKit food-correlation parent UUID:
  1. Build a `quantitySampleId → correlationParentId` map from `getFoodCorrelationSamples` (HKCorrelationTypeIdentifierFood rows already fetched alongside the dietary quantity samples).
  2. If a sample is in that map, bucket it by `corr|<parentId>|<bundle>` — separate foods land in separate buckets even when their wall-clock instants collide.
  3. Else, read `metadata.HKCorrelationUUID` directly off the sample (some bridges don't expose `getFoodCorrelationSamples` but do thread the parent UUID into per-sample metadata).
  4. Else, fall back to the legacy `effectiveMinute|bundleId` heuristic for writers that emit no correlation info at all (no behaviour regression for old imports).
- The HKCorrelationUUID metadata key is bridged under several names (`HKCorrelationUUID`, `HKMetadataKeyCorrelationUUID`, `HKFoodCorrelationUUID`, `correlationUUID`, `CorrelationUUID`) — all are accepted. Native type definitions for `getEnergyConsumedSamples` / `getProteinSamples` / `getCarbohydratesSamples` / `getFatTotalSamples` were widened to thread `metadata` and `id` through.
- **Diagnostic logging:** one `console.log("[healthSync] bulk-sync detected: N energy samples, bundles=[…]")` per sync cycle when ≥2 distinct correlation UUIDs share a single `effectiveMinute|bundle` — quiet in steady state, visible in TestFlight logs when MFP flushes.
- **De-dupe:** `health_sample_id` already uses each energy sample's HK UUID, which is per-sample — confirmed nothing is double-counted now that one bulk batch produces N rows instead of one.
- **Verify (manual):** import a multi-meal MFP day; the day's carb total in Today should match MFP's displayed daily carbs within ~5% (rounding) instead of being 2-4× inflated. TestFlight logs should show a single `[healthSync] bulk-sync detected` line per sync.
- **Tests:** `apps/mobile/tests/unit/healthSyncCorrelation.test.ts` (14 tests) — runs as a pure-helper test, no RN imports, so the known mobile vitest RN ESM loader issue doesn't apply. Covers: distinct correlation parents → separate entries; shared correlation → one summed entry; metadata-only path (no parent rows); legacy fallback (no correlation info); mixed batch (correlated + legacy in same minute don't contaminate); parent-row beats per-sample metadata; all five HKCorrelationUUID metadata key variants; bulk-sync detection true/false cases.
- **Follow-up:** none scoped — fix is mobile-only by design (HealthKit doesn't exist on web). If we later wire Health Connect on Android, the correlation strategy should mirror this (Health Connect has its own correlation primitive).

## 2026-04-18 — Alcohol limit / hydration maps not saving

- **ASC feedback id:** `AF0btCuj90Absuf-5cw2FMc` (screenshot + comment: can’t save alcohol limit).
- **Cause:** Production `public.profiles` was missing columns from migration `20260421110000_caffeine_alcohol_tracking.sql` (`target_alcohol_g_weekly`, `extra_alcohol_g_by_day`, plus caffeine columns shipped in the same migration). App updates failed without obvious schema errors in some paths.
- **Fix:** Applied idempotent DDL on the linked Supabase project via  
  `supabase db query --linked -f supabase/scripts/apply_caffeine_alcohol_columns.sql`  
  (same statements as the migration file), then `NOTIFY pgrst, 'reload schema'`.
- **Verify:** Settings alcohol weekly limit and Today alcohol quick-add persist after force-quit; no client error.
- **Follow-up:** Full **`supabase db push --linked`** through **`20260421180000`** completed 2026-04-18; see **[supabase-migration-drift-inventory.md](../planning/supabase-migration-drift-inventory.md)** for the playbook if drift reappears.

## 2026-04-18 — “Not intuitive” (open)

- **ASC feedback id:** `AISAWnLgU9cjRBOuEY-HuJU` — triage separately (UX / copy / layout); no prod change yet.

## 2026-04-18 — Mobile household create / join silently failed

- **ASC feedback id:** `AAegi1DJEiscjIFi_pYaep4` — “Nothing happens when I try to create a household” on iOS.
- **Cause:** `apps/mobile/components/HouseholdCard.tsx` was calling `fetch("/api/household", …)` with a relative URL. React Native has no origin, so the request either threw or resolved to garbage; the surrounding `try/catch` block carried a `// Household API may not be deployed yet — silently ignore` comment which masked the failure entirely. The same pattern was present in `createHousehold`, `joinHousehold`, and `leaveHousehold`.
- **Fix:** Mobile and web household flows now go direct to Supabase via the new shared client `src/lib/household/householdClient.ts`. The four functions (`createHousehold`, `getMyHousehold`, `joinHouseholdByInviteCode`, `leaveHousehold`) operate under existing RLS for create/get/leave; `joinHouseholdByInviteCode` calls a new `security definer` RPC `public.household_join_by_invite_code(p_invite_code, p_display_name)` introduced in migration `supabase/migrations/20260422100000_household_join_rpc.sql` because RLS cannot let a non-member look up a household by code to validate it. While porting the web component, also fixed a long-broken `Authorization` header that was stringifying an unresolved `Promise` (`HouseholdPanel.tsx` line 57 in the old version).
- **Verify:** TestFlight: open Today → Household card, tap Create. Card immediately shows the new household with invite code. Join with the displayed code from a second account; member count goes up. Owner-leave deletes the household; member-leave just removes the row. Errors (already-in-household, invalid code, 8-member cap) now surface via `Alert.alert` on mobile and inline error text on web.
- **Tests:** `tests/unit/householdClient.test.ts` (16 tests, mocked Supabase covers all four functions and every RPC error code); `apps/mobile/tests/unit/householdCardParity.test.ts` (structural pin: no `/api/household` fetches, both surfaces import the shared client).
- **Follow-up:** Web Next.js routes under `app/api/household/` are kept (no removal needed; not invoked by the UI any more — useful for any future server-rendered caller).
- **Release-gate:** ~~migration `20260422100000_household_join_rpc.sql` still needs `supabase db push --linked`~~ **Applied 2026-04-18.** Verified via `select proname, prosecdef from pg_proc where proname = 'household_join_by_invite_code';` — `prosecdef = true`.

## 2026-04-18 — Notes / templates "could not load" (schema reconcile)

- **ASC feedback ids:** `AHgJ5AK6VQowC5KkrKfdaxc` (could not load notes), `AOHTbpXsKXz9e63LN0j58FQ` (notes error half of the screenshot), `APU2FBCjLALmugeCLmQ4Ii0` (could not load templates), `ADpfDkX8c-Kez9HpJFpqmrQ` (can't save ratings — same `user_recipe_notes` family).
- **Cause:** Submissions pre-dated the 2026-04-18 `supabase db push --linked` through `20260421180000` that reconciled `user_recipe_notes` (`20260421140000`) and `user_plan_templates` (`20260421160000`). Same family as the alcohol-limit fix at the top of this file.
- **Verify:** `supabase db query --linked "select table_name from information_schema.tables where table_schema='public' and table_name in ('user_recipe_notes','user_plan_templates');"` returns both. Column shape matches `recipeNotesClient.ts` + `planTemplatesClient.ts`. RLS policies in place.

## 2026-04-18 — Gain-weight label when genuinely in deficit

- **ASC feedback id:** `ALkK-XrcMz_V-D6NrjuVYbo`.
- **Cause:** `projectWeight()` in `src/lib/weightProjection.ts` computed maintenance TDEE as `targetCalories + 500` for "lose" goals. For users whose real burn exceeds `target + 500` (high adaptive TDEE, lots of activity) this flagged genuine deficits as surpluses.
- **Fix:** `projectWeight()` now takes an optional `maintenanceTdeeKcal` — preferred when present, heuristic fallback otherwise. Both `src/app/components/ProgressDashboard.tsx:913` and `apps/mobile/app/(tabs)/progress.tsx:794` now pass the user's actual effective TDEE (adaptive when confident, else static Mifflin). Web Complete Day dialog (`src/app/components/suppr/today-complete-day-dialog.tsx`) threads `profileMaintenanceTdee`. Mobile Complete Day prop added but not yet wired locally (mobile Today tab doesn't hold TDEE in state; deferred — only the Progress projection was the user-visible bug).
- **Tests:** `tests/unit/weightProjection.test.ts` (5 tests).

## 2026-04-18 — Progress shows 0 steps while Today has the right count

- **ASC feedback id:** `AD6_JNUaEjoJ5phZ_N1kv6o`.
- **Cause:** `apps/mobile/app/(tabs)/progress.tsx` fired `syncHealthDataThrottled(userId)` and the `profiles` SELECT inside one `Promise.all` — a race. The SELECT usually won, returning `steps_by_day` without today's key.
- **Fix:** sync is now awaited before the profile read; `nutrition_entries` still runs in parallel with the sync (independent).

## 2026-04-18 — TDEE "1900 when it should be 1600" (silent moderate default)

- **ASC feedback id:** `AIIm60nKi_sTu3-4YjR-WR4`.
- **Cause:** Five read-sites fell back to `activity_level ?? "moderate"` (multiplier 1.55) whenever the profile column was null. For a sedentary user this over-inflates TDEE by ~14% (1682 kcal → 1927 kcal) — matches the tester's complaint exactly.
- **Fix:** swapped all five read-sites to default to `"sedentary"` (1.2):
  - `src/app/components/NutritionTracker.tsx:943`
  - `src/app/components/ProgressDashboard.tsx:196`
  - `apps/mobile/app/(tabs)/progress.tsx:181`
  - `apps/mobile/lib/calcTargets.ts:82,112`
  - `app/api/nutrition/adaptive-tdee/route.ts:127`
- Also swapped onboarding defaults from `"moderate"` → `"sedentary"` on both platforms (`app/onboarding/page.tsx:73`, `apps/mobile/app/onboarding.tsx:137`) so users who skip the activity step don't silently pick 1.55.
- **Verify:** Mifflin-St Jeor output is numerically correct (nutrition-engine audit confirmed 0% drift vs textbook reference). The bug was exclusively the silent default.
- **Follow-up (deferred, narrow):** TDEE explainability — onboarding TDEE preview ("Sedentary: X · Light: Y · Moderate: Z" using entered height/weight/age/sex), Today activity-bonus info popover, dedicated Maintenance tile. Queued against `AFdtq8z_FmWRCispqF04Lsk` and `AAtW7dYcCBPyBdsMU6UqiQQ`. There is also a goal-adjustment parity drift between web (`tdee.ts:calculateBudget` uses pace-based deficits) and mobile (`calcTargets.ts:goalCalorieAdjustment` uses flat ±500/0/+300) — flagged for `data-integrity` follow-up, not part of this pass.

## 2026-04-18 — Instructions rendering literal "/n"

- **ASC feedback id:** `AO4NtyNBpP4FJRgq7mCV5cs`.
- **Cause:** Not in current prod recipe data (the prod `instructions ilike '%/n%'` query returned 0 rows) — the offending recipe must have been a historical seed or an import that escaped newlines as literal `/n` or `\n` 2-char sequences. The renderer `.split(/\n+/)` then treated `"Instructions placeholder /n"` as a single step.
- **Fix:** defensive normalisation in both `apps/mobile/app/recipe/[id].tsx:580` and `src/app/components/RecipeDetail.tsx:503` — `replace(/\\n/g, "\n").replace(/\s\/n\s?/g, "\n")` before splitting, so future imports with the same shape render correctly.

## 2026-04-18 — Imported recipe title == full caption

- **ASC feedback id:** `AOHTbpXsKXz9e63LN0j58FQ` (caption-as-title half of the screenshot — notes side covered above).
- **Cause:** `extractRecipeFromCaption()` in `src/lib/recipe-import/extractSocialRecipe.ts` passed GPT's `title` through unclamped. When a post had no obvious headline, GPT returned the whole caption.
- **Fix:** new `sanitiseImportedTitle()` collapses whitespace, strips trailing hashtag/handle/URL runs, prefers the first sentence, caps at 120 chars. If still over the cap, returns `null` so the caller falls back to `meta.title` / `"Imported recipe"`.

## 2026-04-18 — Missing recipe source section at bottom

- **ASC feedback id:** `AMAxKVVxPZtUvGz8I6Yqo3w` — "we need a source section at the bottom".
- **Cause:** On mobile, the source card existed but sat mid-page (before Log-to-journal, Start Cooking, Notes).
- **Fix:** moved the source card to be the final element in the recipe scroll, below `RecipeNotesCard`. Top-of-page byline link remains as the primary entry (tester said "happy to keep the name at the top as is").

## 2026-04-18 — Hydration card: caffeine hide + bottom-of-Today position

- **Source:** in-session tester request, paired with the TestFlight pass.
- **Fix:** caffeine row now self-hides when `targets.caffeineMg === 0` (mirrors alcohol). Whole `HydrationStimulantsCard` moved to bottom of Today on both platforms (after `TodayActivityBonusCard`, before Complete Day). Water quick-add at the top of Today stays via the macro tile row.
- **Tests:** two new cases in `apps/mobile/tests/unit/hydrationStimulantsCardParity.test.tsx` (caffeine hidden when target 0, visible when > 0).
- **Decision log:** `memory/decisions_hydration_card_position_caffeine_hide_2026_04_18.md`.
