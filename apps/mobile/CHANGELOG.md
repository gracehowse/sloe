# Mobile App Changelog

## 2026-05-01 — Recipe detail: Type ladder cleanup + dead hero-pill removal

### ui-critic findings #4 + #8 (recipe detail)
- **Typography ladder consolidation** — `apps/mobile/app/recipe/[id].tsx` carried 14 inline `fontSize` literals (24/22/16/14/13/12/11/10/9) while the canonical `Type.{title, headline, body, caption, label}` ladder defined at `apps/mobile/constants/theme.ts:209-226` was unused. Every numeric `fontSize` is now either a `Type.<role>` spread or a documented hand-tuned hero numeral. Two explicit numerics survive with in-line comments:
  - `calorieNumber` (26/800) — F-23 hand-tuned per-portion numeral.
  - `nutritionValue` (28/700) — Discover-style stat tile.
- **Dead hero-pill style removed** — `headerBtn` / `headerBtnText` described a 38pt circular pill with `shadowOpacity: 0.22` (the 2019-iOS hero-pill pattern), but had zero JSX consumers since the 2026-04-20 prototype port replaced floating-over-hero buttons with the sticky `topBar`. Removed entirely so future readers don't mistake the dead style for a live one.
- **Web parity** — `src/app/components/RecipeDetail.tsx` had two `style={{ fontSize: 12 }}` literals on the "Fits your day" badge; both swapped for the canonical Tailwind `text-xs` utility. Web's hero already uses a sticky `backdrop-blur-xl bg-card/80` top bar above the hero (no floating pills) plus a `bg-gradient-to-t from-black/40` scrim — both are now pinned by tests so a future sweep can't quietly regress to the pre-cleanup pattern.

### Tests
- `apps/mobile/tests/unit/recipeDetailTypographyLadder.test.ts` (NEW) — 10 cases. Source-grep bans inline `style={{ fontSize: N }}` JSX literals, asserts ≤ 2 numeric `fontSize` survivors (the documented hero numerals), pins `headerBtn` removal, and pins the canonical `topBar` / `topBarIconBtn` styles as the surviving header pattern.
- `tests/unit/recipeDetailTypographyLadder.test.ts` (NEW) — 5 cases. Web mirror: bans inline `fontSize` literals, pins `text-xs` on the Fits-your-day badge, pins the sticky `backdrop-blur-xl` top bar and the hero-photo scrim gradient.

## 2026-05-01 — Food DB breadth: cortado families + fiber surfacing

### Food search (TestFlight Build 40 feedback)
- **Beverage family expansion** in `src/lib/nutrition/genericBeverages.ts` — popular drinks (cortado, latte, flat white, americano, espresso, cappuccino, mocha, matcha latte, chai latte, drip coffee, black tea) now ship with size + dairy variants instead of a single canonical row. 30 → 66 entries. New `matchGenericBeverages()` returns the full family ladder for a query so a user typing "cortado" sees 5 options (whole / skim / oat / almond / soy), "latte" sees 8 (medium, large, iced, plus dairy variants), "americano" sees 4 (small / regular / large / iced). Closes the canonical "cortado should have lots of options" feedback.
- **Family-aware search wiring** — `apps/mobile/lib/verifyRecipe.ts:searchFoods()` and `src/app/components/food-search/FoodSearchPanel.tsx` now prepend every family sibling above the USDA / OFF / Edamam / FatSecret merge, with the matched canonical row leading. The legacy single-row `matchGenericBeverage()` is preserved for back-compat callers.
- **USDA fiber + sugar + sodium surfacing** in `src/lib/usda/fdcClient.ts` — `fdcFoodsSearch` now extracts nutrient numbers 291 (fiber, total dietary), 269 (sugars, total) and 307 (sodium, Na) from the inline `foodNutrients[]` envelope. Previously these landed as zeros in the search row macros until the on-tap food-detail fetch ran. TestFlight feedback "Fibre and other nutrients not pulling in" — apple search rows now carry 2.4g fiber from the first paint instead of waiting for a network round-trip. Branded products that use bare "Fiber" (no "total dietary" suffix) are picked up by a fallback name match.
- **Mobile + web parity** — both surfaces import `matchGenericBeverages` and forward fiber/sugar/sodium identically. Pinned by `tests/unit/genericBeverageFamilyWiring.test.ts` and `tests/unit/fdcFiberExtraction.test.ts`.

### Tests
- `tests/unit/genericBeverages.test.ts` — extended from 9 to 27 cases; pins family-expansion contracts (5+ cortado, 4+ latte sizes, 5+ oat-milk variants, alias uniqueness across 252 aliases).
- `tests/unit/fdcFiberExtraction.test.ts` (NEW) — 12 cases. Source-grep pins the extraction shape; behavioural tests mock `fetch` with a USDA SR Legacy apple fixture and assert fiber (2.4g) / sugar (10.4g) / sodium (1mg) per 100g land on the returned hit. Includes a no-fiber-published case (preserves `undefined` vs zero) and a branded "Fiber" fallback case.
- `tests/unit/genericBeverageFamilyWiring.test.ts` (NEW) — 8 cases. Pins that mobile `searchFoods` and web `FoodSearchPanel` both wire to `matchGenericBeverages` (multi-result) and prepend every family sibling.

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
