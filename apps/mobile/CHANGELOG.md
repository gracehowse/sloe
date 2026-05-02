# Mobile App Changelog

## 2026-05-02 — 30-day logging milestone moment

### Today
- **`Milestone30DayModal`** (`apps/mobile/components/today/Milestone30DayModal.tsx`) — Lifesum/MacroFactor-style trust moment that fires once when the user crosses 30 *distinct* logged days (gaps don't cost the badge). Surfaces avg daily kcal, top 3 most-logged foods, longest streak, and total weight delta first→last (when ≥2 weigh-ins). Single CTA: "Keep going". No paywall, no upsell.
- **Gate** (`src/lib/nutrition/milestone30Day.ts`) — once-and-done via `profiles.milestone_30_shown_at`. Pure module re-exported from `apps/mobile/lib/milestone30Day.ts` so web + mobile share the gate exactly. Top-foods list deterministic (count desc, then alphabetical tie-break).
- **Persistence** (migration `20260507100000_milestone_state.sql`) — adds nullable `profiles.milestone_30_shown_at`.

### Analytics
- New events: `milestone_30_shown`, `milestone_30_dismissed`. Shown event payload: `{ daysLogged, longestStreak, topFoodCount, platform }`.

## 2026-05-01 — LogSheet: 3-tab discoverability (journey-architect P1)

### LogSheet
- **Saved-meal dot indicator** on the Saved tab in the LogSheet's Recent / Library / Saved toggle row. Renders a 6×6 primary-blue dot when the user has 3+ saved meals so first-time openers learn the tab exists. Closes the journey-architect P1 finding "Log lunch via saved meal: 5 taps. At target but requires the user to know the toggle exists."
- **Equal-weight tab pills** confirmed (all pills share `flex: 1` + identical typography). Tests pin both invariants so future refactors don't silently regress: `apps/mobile/tests/unit/logSheetPhase3.test.tsx` + `tests/unit/logSheetPhase3.test.tsx` both ship 4 new pinning tests.
- **Accessible saved-count label** on the Saved pill when the dot is showing — screen readers announce "Saved meals — N saved" so the dot's signal is not visual-only.

### Web parity
- `src/app/components/suppr/log-sheet.tsx` ships the matching dot + accessible label inside the Recent / Library / Saved toggle row.

## 2026-05-01 — LogSheet Library tab (one-tap log from saved recipes)

### Today screen / LogSheet
- **Library tab** added to the LogSheet browse strip (between Recent and Saved meals). Surfaces the user's saved recipes inline so logging from the saved set no longer routes through Recipes → Library → Detail → Log. Sourced from TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8` ("No way to add recipes saved to library from here") + sibling reports.
- Each Library row shows a thumbnail, title, kcal-per-portion, and a meal-type pill (Breakfast / Lunch / Dinner / Snacks) so the user knows which slot a one-tap log will land in.
- Tapping a row routes through `logPlannedMealWithPortion` so the macro-coercion guard (P0-3 / T4) fires identically to the Recipe → Add to today path — recipes with kcal but no ingredient-resolved P/C/F surface the Verify prompt rather than persisting estimates.
- Empty state renders friendly copy ("Save recipes from the Recipes tab to see them here. We'll show your most-cooked recipes first.") plus a "Browse recipes" CTA that routes to the in-app Library tab.
- Browse-tab order is Recent / Library / Saved meals — Recent stays first to preserve the eat-again default; Library sits next so the saved-recipe path is discoverable.
- Tab bar adapts: hidden when only one source is wired; renders 2-up or 3-up depending on which props the host passes.

### Shared
- **`journalSlotFromMealTypes` helper** lives in `src/lib/nutrition/recipeJournalSlot.ts` (already extracted in PR #16). The LogSheet Library tab pick handler (mobile + web) imports the same function so all surfaces share one slot-resolution rule.

### Web parity
- Same Library tab on web (`src/app/components/suppr/log-sheet.tsx` + wired in `src/app/components/NutritionTracker.tsx`). Pick handler routes through `fetchPlannedMealMicros` for the same macro-coercion guard.

## 2026-05-01 — Cook handsfree v1 shell shipped dark behind a feature flag

### Cook
- **`COOK_HANDSFREE_FEATURE_ENABLED` feature flag** (`apps/mobile/lib/cookHandsfree.ts`) gates whether the in-cook header mic toggle renders at all. Defaults to **OFF**.
- The v1 shell ships dark because the audio listener is queued for v2 (see `docs/decisions/2026-05-01-cook-voice-handsfree.md`). Shipping the toggle live would let users tap it, see no microphone behaviour, and conclude the app is broken (journey-architect P1 friction risk).
- Flag is wired to `EXPO_PUBLIC_COOK_HANDSFREE_ENABLED=true`; flipping it requires a JS reload (kill-switch, not a per-user toggle). When v2 ships the listener, flip the default to `true` and remove the guard at the same commit.
- Header layout: a same-size invisible spacer renders when the flag is off so the centered step counter stays visually centred either way.
- The AsyncStorage hydration effect short-circuits when the flag is off — no unused storage round-trip on cook-mode mount.
- Lock-in test: `apps/mobile/tests/unit/cookHandsfreeFeatureFlag.test.tsx`.

## 2026-05-01 — Onboarding: restore data-bridges step

### Onboarding (re-introduces a data-bridge path; mobile + web parity)
- **New `data-bridges` step** at position 13 (after Reveal) bundling four bridge cards: Manual targets (paste-in kcal/P/C/F), Apple Health (HealthKit + first sync), Notifications, Recipe URL. Each card is independently skippable; a "Maybe later" affordance lets the user advance the empty path. Decision doc: `docs/decisions/2026-05-01-onboarding-data-bridges.md`.
- **Manual-target override** — when all four manual fields are set + finite + > 0, the new `effectiveTargetsForPersist()` helper synthesises a `V2Targets` (with 14g/1000kcal fiber heuristic) and writes it to `profiles` instead of the BMR-computed values. Partial overrides fall through to computed (half a target is worse than none). The override path also works on the `weightSkipped` branch — if the user knows their numbers, scale interaction isn't required.
- **Apple Health (iOS-only)** — `requestHealthPermissions` → `syncHealthData(userId)` on grant; opens iOS Settings via `Linking.openURL("app-settings:")` on deny. Per `project_ios_only_no_android.md`, web omits this card (intentional parity carve-out).
- **STEP_IDS** — 12 → 13. The displayed step counter still tops out at 12 because Reveal remains the aha; `data-bridges` is purely additive.
- **Analytics** — two new events registered: `onboarding_data_bridge_chosen { option }` and `onboarding_data_bridge_skipped { reason }`. `onboarding_completed` payload extends with `data_bridge_chosen` (LAST card actioned) and `manual_targets_set`.

### Tests
- `tests/unit/onboardingState.test.ts` — extended for 13 steps + new `data-bridges` `canAdvance` cases.
- `tests/unit/onboardingDataBridgesPersist.test.ts` (NEW, 13 cases) — `effectiveTargetsForPersist` precedence + manual-override branch of `buildProfileUpsertRow`.
- `tests/unit/onboardingDataBridgesWeb.test.tsx` (NEW, 8 cases) — manual entry / partial entry / skip behaviour on web.
- `apps/mobile/tests/unit/onboardingDataBridges.test.tsx` (NEW, 5 cases) — manual entry / skip behaviour on mobile.

## 2026-05-01 — Photo-log re-architected: itemized breakdown with kcal ranges

The previous photo-log pipeline blanket-failed (502 `verify_failed`)
the moment any single item couldn't be matched against an external
food database — which is most of the time on a real plate (the
matchers are tuned for clean recipe ingredient strings, not vision
output like "salami", "olives", "half egg"). The mobile sheet then
showed a generic "Couldn't analyse this food" alert and the user got
nothing, even when the model had correctly identified 8 of 10 items.

Rewritten as a single GPT-4o vision call returning a ChatGPT-grade
itemized breakdown:

- Items grouped by macro role ("Bread + dips", "Protein + fats",
  "Extras", "Drinks", "Sweets", or a custom group like "Pasta + sauce"
  when the plate calls for it).
- Per-item kcal RANGES (`~120–150 kcal`), not point estimates — honest
  about vision uncertainty.
- Verbal portion hints in plain language ("~40-50g", "1 piece").
- Optional add-on chips for things NOT in the photo that commonly go
  with what IS visible (a glass of wine with charcuterie, a bun for a
  burger). Tap to add — chip moves into the items list and the plate
  total updates.
- Plate total banner with the same range format.
- Free-text caveats from the model rendered italicised below the items
  ("dressing not visible — likely +30-50 kcal").
- Never blanket-fails on partial / low-confidence items. Low-confidence
  rows are flagged amber but stay savable.
- "Save to today" projects each ranged item to the journal's existing
  `AiLoggedItem` shape: calories collapse to the range MIDPOINT for the
  `meal_logs.calories` column; the full range is preserved on
  `AiLoggedItem.range` for uncertainty-aware analytics.

The optional per-item "Verify with database" affordance routes a
single ingredient to `/api/nutrition/verify-recipe` to swap that one
row from AI-estimated range to a USDA / OFF / FatSecret single-number
match — preserved for users who want a verified row.

Web dialog (`src/app/components/suppr/photo-log-dialog.tsx`) ships the
identical grouped layout — same response shape, same en-dash range
format, same add-on chips, same "Save to today" CTA copy. Only styling
diverges: sonner toast on web vs AsyncStorage + ToastAndroid +
Alert.alert on mobile (existing platform-native pattern).

Two new analytics events: `ai_photo_log_addon_added` and
`ai_photo_log_item_verified`. Existing `ai_photo_log_started`,
`_committed`, `_paywalled`, and `photo_log_correction_persisted`
unchanged.

See `docs/decisions/2026-05-01-photo-log-rangefirst.md` for the full
rationale, prompt strategy, and target output (Grace's screenshot bar).

## 2026-05-01 — Build 41 P0 batch (TestFlight Build 40 feedback)

Four P0 fixes consolidated for TestFlight Build 41. All sourced from
TestFlight feedback IDs filed during a single Build 40 session.

### Calorie ring — solid green at-or-above target
TestFlight `AEvjNTAVsipFKDysDkJD2g4`: "Why is the ring now gradient even
when the user has logged instead of green?". The post-59cc821 brand
gradient ran across the whole consumed-vs-target range, so users never
saw the "you're done" success signal once they hit their target.

Build 41 fix: keep the gradient for the in-progress arc
(`consumed < goal`), switch to solid `Accent.success` once
`consumed >= goal`. Going over no longer flips the ring to destructive
red — going over a daily calorie target is normal tracking, not an
error state. Centre text colour still flips to warning amber when
the user is over and viewing in `remaining` displayMode.
Mirrored on web via `src/app/components/suppr/daily-ring.tsx`.

### Tracking-extras quick-add chips persist again
TestFlight `AEsaeOW2Qw-BQa29teBp-Ns`: "Adding alcohol or coffee still
not impacting these numbers." The previous (round 3) fix relied on
capturing the computed `next` map inside a `setState((prev) => ...)`
updater and reading `persisted` on the next line. React 18 invokes
functional updaters lazily during the next commit, so `persisted` was
always `null` when the persist branch checked it. The supabase write
therefore never fired, and the Build 40 server row stayed at zero —
on next focus the local state hydrated from the (still-zero) server
and the count appeared to "reset".

Build 41 fix: compute `next` synchronously from the closure-captured
map, persist with that value directly, use a non-functional setState
call. Same pattern applied to `addCaffeineMg`, `addAlcoholG`,
`addWaterMl`, and `resetHydrationStimulantsForDay`. Web's
`addCaffeineMgForSelectedDay` was always correct (persists inside the
updater) so no web change was needed.

### Recipe → Log honours `recipe.meal_type` first, time-of-day second
TestFlight `AB1PYpfPjbd9li7jtnlAsIE`: "Doesn't give me an option of
which meal to log this for and it ended up logging it as lunch.
Also this was a breakfast recipe and I marked it as such when I
imported it." The mobile recipe Log button used a helper that
hard-fell-back to "Lunch" when meal_type was null/unmatched —
explicitly tagged recipes already worked, but a recipe imported
without a meal_type tag and logged at 7pm landed in Lunch.

Build 41 fix: extracted `journalSlotFromMealTypes` to
`src/lib/nutrition/recipeJournalSlot.ts` and added a
`fallbackSlotFromTimeOfDay` ladder (Breakfast < 11, Lunch < 15,
Snacks < 17, Dinner). Priority is now: explicit meal_type → tag
match → time-of-day fallback → normaliseMealSlot last-chance →
time-of-day fallback. Web's CookMode (`src/app/components/CookMode.tsx`)
now imports the same shared helper so both platforms agree on which
slot a given recipe + clock resolve to.

A meal-slot picker (Breakfast / Lunch / Dinner / Snack) is the better
long-term answer per the user's request, but the cheapest correct fix
for Build 41 is honour the recipe's tag + time-of-day fallback.

### FatSecret in mobile food search (regression pin only)
TestFlight `AKhE2_le-T2ml0cjmysFB1w`: "Still no fat secret option
showing for big mac." The Lane-A wire-up (PR #11, commit 8889411,
2026-04-30) added `searchFatSecret`, `getFatSecretFood`, and merged
FatSecret into `searchFoods`'s parallel fan-out before Build 40 was
cut. Build 40 must have been cut before that PR landed. No code
change required for Build 41 — the wiring is already in `verifyRecipe.ts`
and pinned by `apps/mobile/tests/unit/foodSearchFatSecretMerge.test.ts`.

### Tests
- `tests/unit/recipeJournalSlot.test.ts` — 12 tests covering meal_type
  priority, time-of-day fallback, last-chance normalise.
- `tests/unit/calorieRingSolidGreenAtTarget.test.ts` — 6 source-pin
  tests across mobile + web ring stroke logic.
- `apps/mobile/tests/unit/trackingExtrasPersist.test.ts` — 12 source-
  pin tests across the four quick-add handlers, locking in the
  direct-capture pattern.

## 2026-04-30 — EAS Update (OTA JS pushes)

### Infra
- **`expo-updates`** installed (`~29.0.17`, SDK-aligned). Wires the
  iOS binary up to receive over-the-air JS bundle updates.
- **`app.json`** now declares `expo.runtimeVersion.policy = "appVersion"`,
  `expo.updates.url` (EAS Update endpoint for the existing project ID),
  `expo.updates.fallbackToCacheTimeout = 0`, and
  `expo.updates.checkAutomatically = "ON_LOAD"`. The runtime-version
  policy means OTA updates only ship to binaries with a matching
  `expo.version` — native or `app.json`-config changes still require a
  fresh TestFlight build.
- **`eas.json`** build profiles now declare matching `channel` values
  (`development`, `preview`, `production`). Channels are how EAS Update
  routes a publish to the right binaries — without them, OTA cannot land.

### Why
JS-only fixes used to require a 15-25 minute TestFlight build cycle
before they reached the test device. With OTA wired, the publish path
is `cd apps/mobile && eas update --branch production --message "..."`
and the new bundle lands on devices in ~30s on the next launch.
Workflow + safety rules at
`docs/operations/eas-update-workflow.md`. Decision record at
`docs/decisions/2026-04-30-eas-update-ota.md`.

## 2026-04-20 — RevenueCat Customer Center + v2 API key support

### RevenueCat
- **`react-native-purchases-ui`** added at matching major (`^9.15.2`). Pulls in RC's native Customer Center + Paywall view components. Does not touch the existing custom paywall at `apps/mobile/app/paywall.tsx` — that surface remains the canonical sell per `ui-product-designer` round-1 spec.
- **Unified v2 API key fallback** in `lib/purchases.ts`. Platform-specific keys (`EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `…_GOOGLE_KEY`) still win in prod; a new `EXPO_PUBLIC_REVENUECAT_API_KEY` works as a single-var fallback on both platforms (intended for dev/sandbox with RC v2 `test_…` keys).
- **Customer Center entry point** on the settings screen. New "Manage subscription" row on the Plan card, shown only when `userTier !== "free"`. Calls `RevenueCatUI.presentCustomerCenter()` via a dynamic import in `lib/purchases.ts`; falls back to `apps.apple.com/account/subscriptions` (iOS) / `play.google.com/store/account/subscriptions` (Android) if the native UI module is unavailable (Expo Go, web, or missing API key).

### Decisions captured in this change
- RC hosted Paywall was **not** adopted — the custom paywall has a specced pricing-v1 trial-on-Pro-annual rule and analytics funnel F2 hooks that the hosted template would regress. Routed to `monetisation-architect` + `product-lead` for future reconsideration.
- Entitlement IDs `pro` and `base` remain canonical — user request to rename to "Suppr Pro" was declined here because renaming the dashboard entitlement without migration would de-entitle every live subscriber.

## 2026-04-12 — Onboarding, Nutrition Accuracy, Search Improvements

### Onboarding Flow (NEW)
- **14-step guided onboarding** (`/onboarding`) — goal selection, body metrics, activity level, plan pace, calorie budget, nutrition strategy, calorie schedule, intermittent fasting, motivation/mindset questions, weight projection, summary
- **TDEE calculator** (`lib/tdee.ts`) — Mifflin-St Jeor equation with activity multiplier, safe 1200 cal floor, macro calculation per strategy (Balanced / High Protein / High Satisfaction / Low Carb)
- **Plan pace selection** — Relaxed (0.25 kg/wk) / Steady (0.5 kg/wk) / Accelerated (0.75 kg/wk) / Vigorous (1 kg/wk) with calculated calories and weeks-to-goal
- **Skip button** on every onboarding screen — marks onboarding complete, goes straight to app
- **Projection screen** — shows goal date with weight progress bar and summary of choices

### Authentication
- **Apple Sign-In** on login screen (iOS) via `expo-apple-authentication` + `signInWithIdToken`
- Login checks `profiles.onboarding_completed` to route new users to onboarding

### Subscription & Notifications
- **Paywall screen** (`/paywall`) — free trial flow with timeline (Program Created → Build Momentum → See Progress → Trial Ends), "Start Free Trial" + "Continue for free" buttons. Placeholder for RevenueCat/StoreKit integration.
- **Notifications prompt** (`/notifications-prompt`) — requests push notification permission with "Turn on" / "No thanks" options

### Nutrition Lookup Accuracy
- **Preserve nutrition-critical words** — "cooked", "raw", "dried", "frozen", "canned" are no longer stripped from USDA search queries (raw rice = 365 kcal/100g vs cooked = 130)
- **50+ UK/AU→USDA name aliases** — courgette→zucchini, minced beef→ground beef, prawns→shrimp, double cream→heavy cream, coriander→cilantro, butter beans→lima beans, aubergine→eggplant, etc.
- **Search Foundation/SR Legacy/Survey first** — generic whole foods before branded products, with USDA dataType API filter
- **Smart confidence scoring** — neutral USDA descriptors (raw, peeled, boneless) don't penalise; dish words (bread, cake, fried, oil) heavily penalise; prevents "Bread, zucchini" matching "zucchini"
- **Open Food Facts added to import pipeline** — searches between USDA and FatSecret for worldwide food coverage (UK/EU/global products)
- **Better small-item weights** — anchovy (5g), olive (5g), prawn (15g), mushroom (15g), deli meat slices (~10g)
- **Food-specific USDA portion weights** — uses USDA's portion data for the matched food instead of generic defaults
- **Error resilience** — USDA/FatSecret failures now fall through to estimation fallback instead of killing the entire pipeline

### Search UI
- **Unified search results** — single ranked list (no more "Products & Brands" / "Whole Foods (USDA)" section headers)
- **Progressive loading** — whichever source responds first shows results immediately
- **15s/12s timeouts** — USDA and OFF searches timeout gracefully on slow networks
- **MFP-style serving picker** — serving size (g, oz, tbsp, tsp, cup, ml + USDA portions) + number of servings input with decimal/fraction support

### Fibre/Micros
- `fiber_g`, `sugar_g`, `sodium_mg` columns added to `recipes` table and now saved during import and verification
- Recipe detail screen queries and displays fibre ring in Macronutrients card
- Verify screen totals include fibre/sugar/sodium
- Ingredient macros compute from actual ingredients (not stale recipe-level values)

### Import Pipeline
- **Amount/unit preserved** — parsed amounts and units from ingredient lines are now saved to the database (previously always null)
- **"heaped tbsp" parsing** — modifier words (heaped, level, rounded) before units are handled correctly
- **siteNutrition fallback** — if per-ingredient verification fails, recipe-level macros are populated from the site's JSON-LD nutrition data

### Shopping List
- **Generate Shopping List** button on planner — fetches ingredients from all planned recipes, merges duplicates, multiplies by recipe count, categorises (Meat & Fish, Dairy & Eggs, Carbs & Grains, Fruit & Veg, Pantry)
- Falls back to matching recipes by title when `recipeId` is null (older plans)

### Recipe Detail
- **Macros computed from ingredients** — calorie hero and macro rings always match the ingredient list (not stale recipe-level values)
- **Bookmark save button** — replaced star icon with bookmark matching library tab
- **YouTube thumbnail cleanup** — swaps hqdefault for maxresdefault (removes baked-in play button)
- **Save to Library works** — toggleSave correctly inserts/deletes from saves table

### Other
- **Nutrition sources page** (`/nutrition-sources`) — explains USDA, Open Food Facts, FatSecret with links, accessible from More tab
- **Ingredient name persisted** — when selecting a food from search, the matched name is saved (not the original raw ingredient text)

### Database Migrations
- `20260411180000_add_recipe_source_attribution.sql`
- `20260411200000_ensure_recipe_ingredients_micros.sql`
- `20260412100000_onboarding_profile_fields.sql` — adds `goal_weight_kg`, `plan_pace`, `nutrition_strategy`, `calorie_schedule`, `high_days`, `fasting_enabled`, `fasting_window`, `onboarding_completed`, `target_fiber`, `dob` to profiles; converts `weight_kg`/`height_cm` to numeric
