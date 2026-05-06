# In-depth debug audit — findings (2026-05-05)

> **Status:** AUDIT COMPLETE. **No code changes have been made.**
> Awaiting Grace's fix-batch sign-off before any product edit.
>
> **Audit plan:** [`docs/audits/2026-05-05-debug-audit-plan.md`](../2026-05-05-debug-audit-plan.md)
> **Distinct from** the morning's [`2026-05-05-full-sweep/findings/SUMMARY.md`](../2026-05-05-full-sweep/findings/SUMMARY.md) (breadth scan). This is the **depth scan** for math errors, copy/state drift, leaked internals, and contradiction-on-same-screen bugs.
>
> **Capture sources used as BEFORE evidence:** 143 fresh mobile PNGs in `apps/mobile/screenshots/latest/` (Maestro run completed 2026-05-05 17:21) plus 62 web PNGs in `docs/audits/2026-05-05-full-sweep/web/`. Captures were taken before any of the depth-scan findings below were known.

---

## 0. Headline

**31 distinct findings.**
- **P0: 5** (3 new, 2 promoted from depth-scan: streak drift + AsyncStorage cross-user leak)
- **P1: 14**
- **P2: 9**
- **Deferred — needs runtime check: 7** (cannot be answered from code alone)

**Cross-cutting theme that emerged across areas:** the recurring failure mode is **two surfaces presenting related-but-differently-computed values, both labelled the same**. We found six new instances:
1. Today ring REMAINING vs Today deficit banner — both implicitly answer "how much room?", different math.
2. Today StreakPip (raw) vs Recap StreakPip (protected) — same `<StreakPip>` component, divergent number.
3. Today carbs tile (net-carbs lens applied) vs `/macro-detail?macro=carbs` (raw sum) — same metric, two numbers.
4. Mobile ring at `goal=0` (green) vs Web ring at `goal=0` (red) — cross-platform contradiction.
5. /pricing "Prices include VAT" copy vs `STRIPE_TAX_ENABLED` env flag — copy claims one thing; backend may behave differently.
6. Mobile import paths (caption / URL / image) — three sibling routes; only one is sanitised.

Three of these are P0; three are P1.

**Top product question for Grace before the fix batch:** the deficit-math direction of yesterday's TodayDeficitInsight fix. The shipped file uses `burn − consumed`; the briefing says `goal − consumed`. The doc trail has both written down. T01 below is gated on this.

---

## 1. Findings by area

Format per question: `### Q — restatement` then `Verdict | Severity | Surface | Lens | Evidence | Proposed fix sketch | Test pin`. Clean items collapsed to one line.

### 1.1 Today screen (T01–T16)

#### T01 — Two definitions of "deficit-shaped" math live on Today
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web
- **Lens:** Math + Cross-platform
- **Evidence:** Today now has TWO definitions of "the kcal room I have":
  - Ring REMAINING = `goal − consumed` ([apps/mobile/components/charts/CalorieRing.tsx](apps/mobile/components/charts/CalorieRing.tsx))
  - Activity Bonus net + Deficit banner = `burn − consumed` ([apps/mobile/components/today/TodayDeficitInsight.tsx:94-118](apps/mobile/components/today/TodayDeficitInsight.tsx#L94-L118), [apps/mobile/components/today/TodayActivityBonusCard.tsx:149](apps/mobile/components/today/TodayActivityBonusCard.tsx#L149))
  - The 2026-05-05 fix landed `burn − consumed` for the deficit surfaces (per shipped code). Briefing says "uses `goal − consumed` consistently". Doc trail disagrees with code.
  - Same screen, two surfaces, two numbers, both implicitly answer the same user question.
- **Proposed fix sketch:** confirm intent. If `burn − consumed` is canonical, never call the ring's `goal − consumed` value "deficit" anywhere — only "remaining". Vice versa if `goal − consumed` is canonical. **This is gated on a Grace decision; do not patch until intent is locked.**
- **Test pin:** yes — once direction is locked, pin both formulae to a shared helper.

#### T02 — Macro % sum to ≤101%? — clean. Today doesn't render macro-as-% breakdown (each macro has its own pct-of-target ring, independently clamped to 1.0). Macro-card % sum is a meal-nutrition concern (see M01).

#### T03 — Macro tile `Xg / Yg` `remaining` matches `Yg − Xg`?
- **Verdict:** finding
- **Severity:** P2
- **Surface:** mobile (web parity not verified in this pass)
- **Lens:** Math
- **Evidence:** [apps/mobile/components/today/TodayDashboardMacroTiles.tsx:178-187](apps/mobile/components/today/TodayDashboardMacroTiles.tsx#L178-L187). Displayed value is `formatMacro(def.current, macro)` (1dp). Caption "remaining" computes from raw `def.target − def.current` then `Math.round`. Off by ≤1g whenever fractional grams are involved.
- **Proposed fix sketch:** subtract the rounded displayed value, not raw. Apply same change to web equivalent.
- **Test pin:** yes — fixed inputs, deterministic output.

#### T04 — Ring colour state-table web vs mobile? — clean (after today's repin). Three-state mapping {empty=gradient, under=success, over=destructive} lives in `RING_LABELS` ([src/lib/copy/today.ts:22-26](src/lib/copy/today.ts#L22-L26)) imported by both surfaces.

#### T05 — Centre-digit label matches the number? — clean. Both platforms compute `centerLabel` from the same triplet (`displayMode`, `consumed`, `diff`). Mobile + web parity verified.

#### T06 — `consumed === 0`, `goal > 0` shows gradient? — clean. Both [CalorieRing.tsx:213](apps/mobile/components/charts/CalorieRing.tsx#L213) and [daily-ring.tsx:163](src/app/components/suppr/daily-ring.tsx#L163) gate `isEmpty` and short-circuit. Earlier N5 fix (2026-05-03) extended the empty branch to fire in both display modes.

#### T07 — Quick-log strip vs logged-meal list source-of-truth? — clean (no drift). The QuickLogStrip is a 4-tile **input affordance** (Search/Voice/Snap/Scan), not a recent-meals rail. No second source.

#### T08 — "Snap a meal" CTA on every empty-day, hidden when logged today, or always-on?
- **Verdict:** finding
- **Severity:** P2
- **Surface:** mobile (web parity probable)
- **Lens:** State
- **Evidence:** [apps/mobile/app/(tabs)/index.tsx:4486](apps/mobile/app/(tabs)/index.tsx#L4486) renders `<TodaySnapShortcut>` whenever `isToday`, no gate on `mealsToday.length`. Always-on = 4 logging entry points (FAB, snap shortcut, meal-slot taps, quick-log strip) for one action.
- **Proposed fix sketch:** product call. Hide once `mealsToday.length >= 1` (empty-day prompt) OR consolidate with quick-log strip.
- **Test pin:** no.

#### T09 — Streak chip UTC vs local? — clean. [trackerStats.ts:24-43](src/lib/nutrition/trackerStats.ts#L24-L43) `computeLoggingStreak` walks `dateKeyFromDate` with local-time `getMonth/getDate/getFullYear`. Flips at local midnight.

#### T10 — Streak count Today vs post-onboarding push vs weekly recap card? — **finding (PROMOTED P0)**
- See **S01** below. Same finding, surfaced from two independent agents.
- Today pip uses **raw** `computeLoggingStreak`; Recap pip + Settings tile + push body all use **protected**. Same `<StreakPip>` component, divergent number whenever a freeze was consumed.

#### T11 — Activity Bonus Maintenance popover BMR matches underlying TDEE? — clean. Single-source: [apps/mobile/app/(tabs)/index.tsx:511-522](apps/mobile/app/(tabs)/index.tsx#L511-L522). `calculateBMR()` flows through both popover and tile.

#### T12 — "Calorie goal for this day" equals ring's `goal` prop? — clean. Both render `effectiveCalorieGoal` from the same host variable.

#### T13 — Weekly rollup deficit colour with `weekConsumed === 0`?
- **Verdict:** finding
- **Severity:** P2
- **Surface:** mobile
- **Lens:** State
- **Evidence:** [TodayActivityBonusCard.tsx:333-372](apps/mobile/components/today/TodayActivityBonusCard.tsx#L333-L372) — weekly rollup rows always colour by `isWeekDeficit`; no neutral fallback when `weekConsumed === 0`. The today-tile got the neutral-grey fix (2026-04-25); weekly rollup didn't.
- **Proposed fix sketch:** mirror the today-tile neutral-grey gate to weekly rollup rows.
- **Test pin:** yes.

#### T14 — 7-day rolling kcal/kg constant split
- **Verdict:** finding
- **Severity:** P2
- **Surface:** mobile + web (cross-surface)
- **Lens:** Math
- **Evidence:** Two competing constants:
  - `KCAL_PER_KG_FAT = 7700` ([whyThisNumber.ts:103](src/lib/nutrition/whyThisNumber.ts#L103), [deficitProjection.ts:5](src/lib/nutrition/deficitProjection.ts#L5), [weightProjection.ts:13](src/lib/weightProjection.ts#L13))
  - 3500 kcal/lb path: `weeklyLbsRate = weekDeficit / 3500; weeklyKgRate = weeklyLbsRate * 0.4536` ([TodayActivityBonusCard.tsx:162-163](apps/mobile/components/today/TodayActivityBonusCard.tsx#L162-L163))
  - Onboarding (`tdee.ts`) uses 7700 basis. Activity Bonus card uses 3500 basis. ~0.2% drift on output.
- **Proposed fix sketch:** centralise on 7700; replace Activity Bonus path with `weekDeficitToKg(weekDeficit)` import.
- **Test pin:** yes.

#### T15 — Week-mode strip first-day matches `weekStartDay`? — clean. [DayStrip.tsx:61-66](apps/mobile/components/charts/DayStrip.tsx#L61-L66) reads `weekStartDay` consistently.

#### T16 — Why-this-number explainer matches headline? — clean. [whyThisNumber.ts:217-256](src/lib/nutrition/whyThisNumber.ts#L217-L256) algebra: TDEE + (target − TDEE) = target. Always reconstructs.

### 1.2 Calorie ring (R01–R04)

#### R01 — Every ring renderer uses same colour state-table? — clean. Mobile: ONE renderer ([CalorieRing.tsx](apps/mobile/components/charts/CalorieRing.tsx)). Web: ONE renderer ([daily-ring.tsx](src/app/components/suppr/daily-ring.tsx)) used by `today-hero-ring.tsx`, `TodayAtAGlance.tsx`, `MealPlanner.tsx`. All inherit the same mapping.

#### R02 — At `consumed === goal`, green or warning? — clean. Both platforms: `consumed > goal` is false at equality → success (green). Pinned by `tests/unit/calorieRingSolidGreenAtTarget.test.ts`.

#### R03 — `goal === 0` no-profile case
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web (DIVERGENT)
- **Lens:** State + Cross-platform
- **Evidence:** Cross-platform contradiction:
  - Mobile [CalorieRing.tsx](apps/mobile/components/charts/CalorieRing.tsx): `consumed > goal && goal > 0` is false (goal>0 fails) → `Accent.success` GREEN.
  - Web [daily-ring.tsx](src/app/components/suppr/daily-ring.tsx): `isOverBudget = consumed > target` is TRUE → `--destructive` RED.
  - Same input (`goal=0, consumed=500`), opposite ring colour.
- **Proposed fix sketch:** treat `goal <= 0` as a render guard at the host level — render a calibrating-empty ring with copy "Set your target in onboarding". If a fallback render is required, mobile should match web (red is more honest given OVER label).
- **Test pin:** yes — cross-platform parity test on `goal=0, consumed=500`.

#### R04 — Empty-state opacity 0.18 visible on light + dark?
- **Verdict:** deferred — runtime check
- **Reason:** Cannot judge perceived contrast from source alone. Need side-by-side captures of empty Today on (mobile light, mobile dark, web light, web dark). The available capture is mobile light only and is occluded by the milestone modal scrim.

### 1.3 Recipe import (I01–I08)

#### I01 — Vendor-name + Postgrest leaks beyond URL route
- **Verdict:** finding
- **Severity:** **P0**
- **Surface:** mobile + web (4 sibling paths)
- **Lens:** Copy
- **Evidence:** the 2026-05-05 sanitiser only protects [/api/recipe-import/route.ts:618-671](app/api/recipe-import/route.ts#L618-L671). Sibling leaks live:
  1. [/api/recipe-import/image/route.ts:106-112](app/api/recipe-import/image/route.ts#L106-L112) — returns `error: "openai_http_error", status, detail: errText.slice(0, 500)`. No `message` field. Mobile reads `data.message ?? data.error` so the literal `"openai_http_error"` renders.
  2. Same file:122-126 — `error: "unparseable_model_output", raw: raw.slice(0, 2000)` dumped.
  3. [/api/recipe-import/caption/route.ts:154-159](app/api/recipe-import/caption/route.ts#L154-L159) — flattens `ai_rate_limited` into `parse_failed`; preserves copy but loses 429 signal (see I02).
  4. [apps/mobile/lib/saveImportedRecipe.ts:196,247,265](apps/mobile/lib/saveImportedRecipe.ts#L196) — Supabase `error.message` returned verbatim through to the user-facing error body. Postgrest leaks: table names, RLS policy details, JWT references.
  5. [src/app/components/RecipeUpload.tsx](src/app/components/RecipeUpload.tsx) (web) — 7+ `toast.error(*.message)` sites at lines 588, 612, 940, 1096, 1107, 1150, 777, 883.
  6. [apps/mobile/app/create-recipe.tsx:557](apps/mobile/app/create-recipe.tsx#L557) — `Alert.alert("Error", insErr?.message)` on save.
- **Proposed fix sketch:** central `userFacingImportError(code|err)` mapper. Routes return `{error: <code>, message: <copy>}`; clients show `message`. Add a lint rule flagging `toast.error(*.message)` against Postgrest types.
- **Test pin:** yes — unit test walks every error branch and asserts `message` exists, contains none of `["OpenAI", "FatSecret", "Supabase", "postgres", "RLS", "JWT", "openai_http_error", "Postgrest"]`.

#### I02 — Retry-After exists on server, never read by clients
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web
- **Lens:** State
- **Evidence:** server emits `Retry-After` header on 429 in 4 places ([route.ts:155](app/api/recipe-import/route.ts#L155),:638; [caption/route.ts:65](app/api/recipe-import/caption/route.ts#L65); [image/route.ts:30-31](app/api/recipe-import/image/route.ts#L30-L31)). No client reads `res.headers.get("Retry-After")`. Caption route additionally hides AI-side 429s as `parse_failed`.
- **Proposed fix sketch:** fetch wrapper reads `Retry-After` on 429 and substitutes "Try again in N seconds". Caption route catch must distinguish `ai_rate_limited` and re-emit 429 + Retry-After.
- **Test pin:** yes — route test asserting `Retry-After` header on every 429 path.

#### I03 — Empty-string LLM ingredients pass the empty check
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web
- **Lens:** State
- **Evidence:** [route.ts:202](app/api/recipe-import/route.ts#L202) checks `!recipe.ingredients.length && !recipe.steps.length` — falsy only when array is empty, not when `[""]`. LLM occasionally returns whitespace-only entries; the route falls into the success branch and renders a recipe with one blank ingredient.
- **Proposed fix sketch:** filter `recipe.ingredients = recipe.ingredients.filter(s => s.trim().length > 0)` then re-check empty branch. Same at caption route.
- **Test pin:** yes — integration test mocks LLM returning `{ingredients: [""], steps: ["", " "]}` and asserts empty branch fires.

#### I04 — No aggregate "unverified" banner on import preview
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web
- **Lens:** State
- **Evidence:** when `verifyIngredients` throws ([route.ts:340-342, 544-546](app/api/recipe-import/route.ts#L340-L342)) `primarySource: "Unverified"` and macros = 0. Mobile renders row-level chip ([import-shared.tsx:1470](apps/mobile/app/import-shared.tsx#L1470)) but no aggregate "These nutrition values are estimated" banner. Web onboarding step ([onboarding/steps/import.tsx:517](src/app/components/onboarding/steps/import.tsx#L517)) has no preview gating either.
- **Proposed fix sketch:** import preview header renders banner when `primarySource ∈ {"Unverified", "Estimated"}` or any `m.calories === 0` row exists.
- **Test pin:** yes — snapshot test of preview with fixture.

#### I05 — Image-fallback retry is silent
- **Verdict:** finding
- **Severity:** **P0**
- **Surface:** mobile + web
- **Lens:** Copy + Confidence
- **Evidence:** [extractSocialRecipe.ts:661-676](src/lib/recipe-import/extractSocialRecipe.ts#L661-L676) — when OpenAI rejects an image URL (common for Instagram CDN expirations), code retries text-only and returns the result indistinguishably. No `imageUsed: false` flag propagated. For an Instagram recipe where the image carries the recipe and the caption is "Today's recipe!" — silent low-quality output with no user signal. Breaks CLAUDE.md "do not guess" rule.
- **Proposed fix sketch:** thread `imageUsed: boolean` through `extractRecipeFromCaption` return; route exposes it; mobile preview shows "Image couldn't be analysed — recipe parsed from caption only" badge.
- **Test pin:** yes — unit test mocking 400 then 200; assert `imageUsed === false`.

#### I06 — Library-link save failure leaves half-saved state
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web
- **Lens:** State
- **Evidence:** [saveImportedRecipe.ts:262-265](apps/mobile/lib/saveImportedRecipe.ts#L262-L265) — when `user_saved_recipes` insert fails, recipe + ingredients **both stay inserted**. Returns error to caller; UI shows error toast but `pendingRecipe` is not cleared. Re-attempt creates duplicate row (idempotency guard only kicks in for sourced URLs, not manual paste).
- **Proposed fix sketch:** wrap the three inserts in an RPC (single transaction) OR compensate on saves-table failure. Clear `pendingRecipe` on terminal error.
- **Test pin:** integration.

#### I07 — Three hand-rolled client-copy surfaces, no shared map
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web (cross-platform)
- **Lens:** Cross-platform
- **Evidence:** mobile [import-shared.tsx:282-776](apps/mobile/app/import-shared.tsx#L282-L776) inline strings; web [RecipeUpload.tsx](src/app/components/RecipeUpload.tsx) sonner `toast.error` strings; web [onboarding/steps/import.tsx](src/app/components/onboarding/steps/import.tsx) hand-rolled. Concrete drift: "Network error. Check your connection." (mobile) vs "Import failed — check the URL or paste a screenshot." (web). "API not configured. Set supprApiUrl in app config." (mobile) leaks dev jargon.
- **Proposed fix sketch:** `src/lib/recipes/importErrorCopy.ts` — `IMPORT_ERROR_COPY` map keyed by error code, used by both platforms.
- **Test pin:** yes — snapshot test confirms parity.

#### I08 — Manual paste skips IG/TT caption flow
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile + web
- **Lens:** State + Legal-adjacent
- **Evidence:** share-sheet entry calls `detectSourcePlatform` and routes IG/TT/YouTube to caption-paste flow. [import-shared.tsx:1644-1654](apps/mobile/app/import-shared.tsx#L1644-L1654) — TextInput `onChangeText` is `setManualUrl` only; `onManualImport` ([:748-756](apps/mobile/app/import-shared.tsx#L748-L756)) does not call `detectSourcePlatform`. Manual-pasted IG URL hits the legacy `socialPlatform` branch, bypassing the caption-paste UX. Contradicts the legal posture in [docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md](docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md) when caption flag is on.
- **Proposed fix sketch:** detect on `onChangeText`; if IG/TT/YouTube, swap CTA to "Paste the caption" prompt; block legacy path on detected URLs when caption flag is on.
- **Test pin:** yes — RTL test for IG-URL paste.

### 1.4 Meal nutrition + Macro detail (M01–M07)

#### M01 — Macro % rounding can sum to 99% or 101%
- **Verdict:** finding
- **Severity:** P2
- **Surface:** Meal-nutrition detail (mobile)
- **Lens:** Math
- **Evidence:** [apps/mobile/app/meal-nutrition.tsx:36-43](apps/mobile/app/meal-nutrition.tsx#L36-L43) — three independent `Math.round((kcal/sum)*100)` calls. 33.4/33.4/33.3 → 99%; 33.5/33.5/33.0 → 101%.
- **Proposed fix sketch:** largest-remainder method (Hamilton). Centralise in `src/lib/nutrition/macroSplitConfidence.ts`.
- **Test pin:** yes.

#### M02 — "X of Y fields published" count line — clean. [meal-nutrition.tsx:316-348](apps/mobile/app/meal-nutrition.tsx#L316-L348). `populatedCount` filters the same `microRows` array that's mapped to rows. Cannot drift.

#### M03 — Per-portion vs per-serving multiplication
- **Verdict:** clean (with caveat) → deferred caveat
- **Evidence:** `nutrition_entries` stores post-portion totals; detail page caption is truthful. Caveat: micros may not be post-portion for all sources. `healthDietaryNutrients.ts` (Apple Health) appears to compute totals before portion scaling. **Deferred — runtime check** with portion-×2 entry from each source.

#### M04 — Meal-source raw token leaks to user copy
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile (web has the right primitive — not used here)
- **Lens:** Copy
- **Evidence:**
  - [meal-nutrition.tsx:262](apps/mobile/app/meal-nutrition.tsx#L262) — meta line `· {meal.source}`
  - [meal-nutrition.tsx:318-329](apps/mobile/app/meal-nutrition.tsx#L318-L329) — empty-state copy: `${sourceLabel} did not publish vitamin or mineral data`; count line: `published by ${sourceLabel}`
  - Possible raw values: `openfoodfacts`, `OFF`, `apple_health`, `usda`, `fatsecret`, `ai_photo`, `MyFitnessPal`, `Meal plan`, `Custom`, `Quick add`, `barcode`. Half snake_case, half mixed-case.
  - Web has [NutritionSourceBadge.tsx](src/components/NutritionSourceBadge.tsx) with `classifySource`. Mobile imports nothing.
- **Proposed fix sketch:** `humanizeMealSource()` in `src/lib/nutrition/sourceMap.ts` returning user-facing strings ("Open Food Facts", "USDA", "Apple Health", etc.). Replace 4 call sites in `meal-nutrition.tsx`.
- **Test pin:** yes — unit test on `humanizeMealSource` with full historical source-string union.

#### M05 — Edit→save round-trip drifts when portion ≠ 1
- **Verdict:** finding (mostly deferred — runtime measurement)
- **Severity:** P1
- **Surface:** Today's edit-meal modal feeding meal-nutrition detail
- **Lens:** Math
- **Evidence:** [apps/mobile/app/(tabs)/index.tsx:3911-3924](apps/mobile/app/(tabs)/index.tsx#L3911-L3924) `applyEditPortionMultiplier` divides persisted (already-rounded) value by current portion → multiplies by new portion → rounds. Each cycle ≤0.05g/macro. Compounds across multiple portion edits.
- **Deferred reproduction:** log meal at portion ×1 with kcal=419 P=20.5 C=40.2 F=11.7. Edit ×2 save. Edit ×0.5 save. Repeat 4 times. Pin final delta.
- **Proposed fix sketch (clean):** schema change — persist canonical pre-portion macros (`base_calories` etc) plus multiplier; display values derived. Routes to `data-integrity` first.
- **Lighter alternative:** persist `userTypedValue` directly when typed; `Math.round((c.cal * clamped) * 10) / 10` (1dp canonical) when only portion changed.
- **Test pin:** yes — vitest exercising `applyEditPortionMultiplier` + `saveEditMeal` directly.

#### M06 — Today carbs (net-carbs lens on) vs `/macro-detail?macro=carbs` (raw) divergence
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile (Today vs macro-detail)
- **Lens:** Math + Cross-surface
- **Evidence:**
  - Today carbs tile applies the lens: [TodayDashboardMacroTiles.tsx:106-125](apps/mobile/components/today/TodayDashboardMacroTiles.tsx#L106-L125) — `netCarbsForRow(totals.carbs, totals.fiber, lens)`; label flips to "Net carbs".
  - Macro detail does not: [apps/mobile/app/macro-detail.tsx:117](apps/mobile/app/macro-detail.tsx#L117) — pure raw `meal.carbs` sum. Header always says "Carbs".
  - With the same day's data: macro-detail shows 82.9g; Today fiber capture shows 14.3g. With lens on, Today carbs tile = 68.6g while macro-detail = 82.9g. Same metric, two numbers — same shape as the deficit bug we just fixed.
- **Proposed fix sketch:** read `profiles.net_carbs_lens_enabled` in macro-detail. When carbs subview + lens on: header pill = `formatMacro(netCarbs..., "netCarbs")`; header label = "Net carbs"; per-row value uses `netCarbsForRow`; bar segments scaled to net-carbs total.
- **Test pin:** yes.

#### M07 — Macro-detail bar overflow + kcal subtitle on fiber page
- **Verdict:** finding
- **Severity:** P2
- **Surface:** macro-detail (mobile)
- **Lens:** Visual + Copy
- **Evidence:** [macro-detail.tsx:189-198](apps/mobile/app/macro-detail.tsx#L189-L198) — segment width `Math.max(pct, 1)%`. Overflow risk small but real with many meals; visual segments also disappear behind 2px gaps × N. Separate copy issue: per-row meta on the **fiber** detail page leads with `· 419 kcal` as the secondary line — "this is the Fiber page, why is kcal first?".
- **Proposed fix sketch:** drop `Math.max` clamp; use stacked widths. Drop kcal subtitle on non-calories macro-detail.
- **Test pin:** no — visual / Maestro fixture.

### 1.5 Pricing (P01–P05)

#### P01 — VAT-inclusive copy vs `STRIPE_TAX_ENABLED` flag
- **Verdict:** deferred — needs runtime verification
- **Severity (if confirmed):** P1
- **Surface:** web /pricing
- **Lens:** Math + Legal
- **Evidence:** [src/lib/region/detectRegion.ts:120-137](src/lib/region/detectRegion.ts#L120-L137) returns `vatNote: "Prices include VAT"` for UK/EU. `BillingDisclosure` always renders this when `regionVatNote` is non-empty, regardless of `STRIPE_TAX_ENABLED`. [/api/stripe/checkout/route.ts:108](app/api/stripe/checkout/route.ts#L108) gates `automatic_tax: { enabled: true }` on `STRIPE_TAX_ENABLED === "true"`. If the env var is `false` in production, copy says "include VAT" while Stripe is not computing VAT — copy is misleading.
- **Reproduction:** check Vercel production env for `STRIPE_TAX_ENABLED`; check Stripe dashboard for `tax_behavior: inclusive` on Pro monthly + annual Price objects.
- **Mobile:** N/A. App Store handles VAT inclusively by definition.
- **Test pin:** yes — assert `BillingDisclosure` renders correctly under both flag states for UK/EU regions.

#### P02 — Default billing period carve-out — clean. Web: `useState<BillingPeriod>("monthly")` ([PricingTiersGrid.tsx:112](app/pricing/PricingTiersGrid.tsx#L112)). Mobile: `useState<BillingPeriod>("annual")` ([paywall.tsx:229](apps/mobile/app/paywall.tsx#L229)). Carve-out intact per `project_pricing_default_billing_period_divergence.md`.

#### P03 — Currency: GBP hardcoded everywhere
- **Verdict:** finding (known bug, re-evidenced)
- **Severity:** P1
- **Surface:** web /pricing
- **Lens:** Math
- **Evidence:** `regionCurrency` prop arrives at PricingTiersGrid as `_regionCurrency` ([:85](app/pricing/PricingTiersGrid.tsx#L85)) — underscore prefix indicates intentionally unused. EU visitors see GBP with "EU pricing coming soon" explainer.
- **Proposed fix sketch (roadmap, not this pass):** add USD/EUR Stripe Price IDs; wire `regionCurrency` into price selection; `formatRegionPrice()` helper.
- **Test pin:** future — once wired.

#### P04 — "Save 37%" badge hardcoded
- **Verdict:** finding
- **Severity:** P2
- **Surface:** web + mobile
- **Lens:** Math
- **Evidence:** badge string hardcoded in [PricingTiersGrid.tsx:341](app/pricing/PricingTiersGrid.tsx#L341) AND [paywall.tsx:985](apps/mobile/app/paywall.tsx#L985). `computeAnnualReferenceLine` IS computed correctly. Two surfaces will silently drift on any price change.
- **Proposed fix sketch:** derive `computedAnnualSavingsPct` from `PRICING_TIERS`; use in both renders.
- **Test pin:** yes — assert `PRICING_TIERS[1].annualSavings` matches `computedAnnualSavingsPct(annualPrice, price)` within ±1pp.

#### P05 — Web post-checkout webhook race
- **Verdict:** finding
- **Severity:** P1
- **Surface:** web /home (Today)
- **Lens:** State
- **Evidence:** Stripe webhook writes `profiles.user_tier = "pro"` asynchronously. User hits "Open Suppr" → `/home?view=today&checkout=success`. [AppDataContext.tsx:510-583](src/context/AppDataContext.tsx#L510-L583) profile fetch on mount has no `?checkout=success` handler — no `refreshProfileBasics()`, no polling, no Realtime subscription. If webhook hasn't committed before mount, UI shows Free tier despite paid Stripe session. Mobile is fine (RevenueCat entitlement is checked directly).
- **Proposed fix sketch:** detect `?checkout=success`, call `refreshProfileBasics()` at +2s and +8s. OR Supabase Realtime subscription on `profiles.user_tier` for the session.
- **Test pin:** yes.

### 1.6 Onboarding (O01–O05)

#### O01 — Mobile deep-link `suppr:///onboarding-v2` redirect
- **Verdict:** finding (verify-only)
- **Severity:** P1 (was P0 in morning sweep; downgraded if redirect ships)
- **Surface:** mobile
- **Lens:** Repo
- **Evidence:** redirect file present at [apps/mobile/app/onboarding-v2.tsx](apps/mobile/app/onboarding-v2.tsx). Morning sweep captures (`onb-03..onb-12`) all show 404 — taken before redirect was in place. **Action required:** confirm redirect is in a shipped TestFlight build (commit log doesn't mention it explicitly).
- **Proposed fix sketch:** verify via TestFlight install; if missing, build and ship.
- **Test pin:** Maestro flow `00c_onboarding_v2_steps.yaml` should now pass through to canonical onboarding.

#### O02 — Step counter "Step X of Y"? — clean. Numeric counter was removed deliberately 2026-04-30 (customer-lens decision: "N-of-15 anchored testers on remaining work"). Progress bar is proportional only.

#### O03 — TDEE displayed at onboarding end equals Today day-1? — clean. Same `targets.target` integer flows from Reveal display → `persistOnboarding` → `profiles.target_calories` → `AppDataContext` → Today ring. No re-computation in the chain.

#### O04 — Pace-floor soft-warn fires once or repeats? — clean. `lastShownReasonRef` dedups analytics; banner correctly re-renders on re-entry; `acknowledged` persists across re-entry for same reason. Web mirrors mobile.

#### O05 — Welcome screen platform divergence — clean. Web "Join the Suppr Club"; mobile "Eat well, without overthinking it". No third variant. Carve-out per `project_onboarding_welcome_divergence.md` intact.

### 1.7 Streak (S01–S03)

#### S01 — Streak count drift Today vs Recap vs Settings
- **Verdict:** finding
- **Severity:** **P0** (cross-surface drift, same component, same word, different number)
- **Surface:** mobile (Today vs Settings vs Weekly-recap)
- **Lens:** Cross-surface + State
- **Evidence:**
  - Today pip uses **raw** `computeLoggingStreak` ([apps/mobile/app/(tabs)/index.tsx:2509-2512](apps/mobile/app/(tabs)/index.tsx#L2509-L2512), [:4172-4178](apps/mobile/app/(tabs)/index.tsx#L4172-L4178))
  - Weekly-recap uses **protected** ([apps/mobile/app/weekly-recap.tsx:377](apps/mobile/app/weekly-recap.tsx#L377))
  - Settings tile uses **protected** ([apps/mobile/components/settings/SettingsBundleContent.tsx:375](apps/mobile/components/settings/SettingsBundleContent.tsx#L375))
  - Push body uses **protected** ([app/api/push/weekly-recap/route.ts:436](app/api/push/weekly-recap/route.ts#L436))
  - Comment at SettingsBundleContent.tsx:338-345 explicitly recognises the risk and "fixed" Settings to match Today + Recap — but the fix was applied to Settings in the wrong direction. Today is the surface that's still raw.
  - User journey: Today pip "4-day streak" → tap → weekly recap "5 days in a row".
- **Proposed fix sketch:** Today's `<StreakPip days={...}>` consumes `protectedStreakLength` (already memoised at index.tsx:2531) instead of `streakDays`.
- **Test pin:** yes — assert Today / Settings / Weekly-recap all read from the same protected source given a freeze-consumed fixture.

#### S02 — Reset rule — clean. Documented + verified. Reset = "no logged meals AND no freeze available". Closing/reopening app has no effect (pure derivation).

#### S03 — DST off-by-one in `computeProtectedStreak`
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile (and any surface using `computeProtectedStreak`)
- **Lens:** Time
- **Evidence:** `computeLoggingStreak` ([trackerStats.ts:35-41](src/lib/nutrition/trackerStats.ts#L35-L41)) uses `d.setDate(d.getDate() - 1)` — DST-safe. `computeProtectedStreak` ([streakFreeze.ts:101,119](src/lib/nutrition/streakFreeze.ts#L101)) uses `cursor.setTime(cursor.getTime() - MS_PER_DAY)` with `MS_PER_DAY = 86_400_000`. On spring-forward day (23 hours local), subtracting 86_400_000 ms keeps `dateKeyFromDate(cursor)` on the same key — walk loops on same day or under-counts. On fall-back (25 hours), can skip a day. Inline comment at [streakFreeze.ts:51-52](src/lib/nutrition/streakFreeze.ts#L51-L52) claims "avoids DST drift" but applies to a different `<` comparison; the day-walk IS DST-affected.
- **Proposed fix sketch:** mirror `computeLoggingStreak`'s `d.setDate(d.getDate() - 1)` pattern; or anchor cursor to noon-local before the loop.
- **Test pin:** yes — vitest fixture forcing `now` to a known DST boundary in `Europe/London` and `America/Los_Angeles`.

### 1.8 Settings / Profile (Y01–Y04)

#### Y01 — Delete-account: error code leaks + missing tables in defensive list
- **Verdict:** finding
- **Severity:** P2 (no orphans on happy path; defensive layering gap only)
- **Surface:** mobile + web (API)
- **Lens:** Copy + State
- **Evidence:**
  - [SettingsBundleContent.tsx:1936-1939](apps/mobile/components/settings/SettingsBundleContent.tsx#L1936-L1939) — `Alert.alert("Deletion failed", json.error || "Please try again.")` surfaces raw codes like `deletion_incomplete` / `auth_delete_failed`.
  - [/api/account/delete/route.ts:66-78](app/api/account/delete/route.ts#L66-L78) doesn't include `user_recipe_notes`, `user_custom_foods`, `user_favorite_foods`, `user_saved_meals`, `user_saved_meal_meals`, `recipe_cook_history`, `web_push_subscriptions`, `health_snapshots`, `daily_targets`, `households`, `household_members` in the explicit-delete list. All cascade via `auth.users` so happy-path is clean — but if any other table fails, auth deletion is gated and these tables remain. Retry self-heals.
  - Post-delete navigation: signOut + Alert race the `onAuthStateChange` listener.
- **Proposed fix sketch:** error-code → copy table; add missing tables to defensive list.
- **Test pin:** yes — unit test mapping every error code.

#### Y02 — Cross-user AsyncStorage leak (signOut doesn't clear)
- **Verdict:** finding
- **Severity:** **P0** (structurally broken; protected only by N=1 today)
- **Surface:** mobile (auth)
- **Lens:** State
- **Evidence:** [apps/mobile/app/(tabs)/settings.tsx:183](apps/mobile/app/(tabs)/settings.tsx#L183) — `supabase.auth.signOut()` clears the Supabase session. AuthProvider does not clear AsyncStorage. Global keys (no userId in key) that persist across logout/login:
  - `cachedUserTier` ([apps/mobile/lib/cachedUserTier.ts:29-39](apps/mobile/lib/cachedUserTier.ts#L29-L39)) — **User A's `pro` read by User B** until first refresh. Pro UI without payment.
  - `WRITTEN_IDS_KEY` (HealthKit-written meal IDs, [healthKitMealWriter.ts:47-72](apps/mobile/lib/healthKitMealWriter.ts#L47-L72)) — User B's writes suppressed because User A's IDs collide.
  - `FOOD_HISTORY` / `EAT_AGAIN_LEGACY_KEY_V1` — User B sees User A's eat-again list.
  - `SLOTS_STORAGE_KEY` / `ACTIVE_SLOT_STORAGE_KEY` — meal-plan slot prefs leak.
  - `health_sync_apple_connected`, `health_import_nutrition`, `health_import_generic_labels`, `health_export_nutrition` — toggle states leak.
  - `NOTIFICATIONS_PROMPT_DISMISSED_KEY`, `LAST_PUSH_TOKEN_CACHE_KEY` — User B never gets push prompt because User A dismissed it.
  - `FIRST_LOG_LOCAL_KEY` — first-log analytics suppressed.
  - `FirstRunChecklist`, `cookHandsfree`, theme pref, onboarding context state.
- **N=1 caveat:** solo-tester per `project_solo_tester.md`. Operational risk today is N=1, but architecture is structurally broken. As soon as a second user signs in on the same device (TestFlight handoff, dev sim re-use, family iPad), they inherit User A's state.
- **Proposed fix sketch:** in `AuthProvider` `onAuthStateChange` for `SIGNED_OUT`, run `await AsyncStorage.multiRemove([...])`. HealthKit meal-writer ID set must be userId-keyed.
- **Test pin:** yes — `signOut` must clear non-profile keys.

#### Y03 — Household removal → solo state cross-surface refresh
- **Verdict:** deferred — runtime check
- **Reason:** local card refresh wired ([HouseholdCard.tsx:226](apps/mobile/components/HouseholdCard.tsx#L226)). Cross-surface refresh (Plan tab HouseholdBar, Progress, Today's "household share" filter) cannot be confirmed code-only. Reproduction: leave household; navigate to Plan WITHOUT app restart; HouseholdBar should immediately reflect solo.
- **Test pin:** integration — needs sim or RTL with mocked focus events.

#### Y04 — Apple Health empty-state copy + first-sync delay
- **Verdict:** finding
- **Severity:** P1
- **Surface:** mobile (Today)
- **Lens:** Copy + State
- **Evidence:** [TodayActivityBonusCard.tsx:185-191](apps/mobile/components/today/TodayActivityBonusCard.tsx#L185-L191) — empty-state copy says "Open **More → Connected**". Per Settings IA collapse (decision 2026-04-28), the route is now `Settings → Connections`. [TodayActivityCard.tsx:86](apps/mobile/components/today/TodayActivityCard.tsx#L86) already corrected; Activity Bonus card was missed. Also: copy implies one sync gesture is enough; `health-sync.tsx` paginates 30 days, takes 5–15s on cold cache.
- **Proposed fix sketch:** update copy to "Settings → Connections"; either auto-refresh on focus after connect or change copy to "Sync runs in the background".
- **Test pin:** copy-snapshot.

### 1.9 Activity / burn (B01–B03)

#### B01 — Steps progress bar overflow — clean. [TodayActivityCard.tsx:60-66](apps/mobile/components/today/TodayActivityCard.tsx#L60-L66) — `Math.min(stepsCount/dailyStepsGoal, 1) * 100%`. Clamped, switches colour at goal. Numeric label unchanged.

#### B02 — Active vs basal double-counting — clean. HealthKit reads split: `getActiveEnergyBurnedPromise` writes `activity_burn_by_day`, `getBasalEnergyBurnedPromise` writes `basal_burn_by_day`. Display sites combine `active + basal`, never `active + (active+basal)`. *Adjacent caveat (NOT a finding here):* maintenance TDEE explainer popover composes "BMR + activity multiplier × BMR" formula text alongside "today's burn = active + basal" actuals — two definitions of "energy expenditure" in adjacent paragraphs. Nutrition-engine area for a separate pass.

#### B03 — Workouts list ordering
- **Verdict:** finding
- **Severity:** P2
- **Surface:** mobile (burn-detail)
- **Lens:** State
- **Evidence:** HealthKit returns workout samples via `hk.getSamples({type: "Workout"}, callback)` ([apps/mobile/lib/healthSync.ts:343](apps/mobile/lib/healthSync.ts#L343)). Default order undocumented for the `react-native-health` patch. No `.sort` at write or read. [burn-detail.tsx:215-222](apps/mobile/app/burn-detail.tsx#L215-L222) renders array order. No timestamps shown beside each row → user can't verify.
- **Proposed fix sketch:** sort by `w.start desc` at read time; surface start time on each row.
- **Test pin:** yes — fixture asserts newest-first.

---

## 2. Prioritised punch-list

### P0 — must close before fix-batch ships

| # | ID | Title | Owner |
|---|---|---|---|
| 1 | **I01** | Vendor-name + Postgrest leaks at image route, saveImportedRecipe, web RecipeUpload, mobile create-recipe | repo-auditor → executor |
| 2 | **I05** | Image-fallback retry is silent; no `imageUsed: false` flag propagated → user gets caption-only output thinking the image was used | nutrition-engine + executor |
| 3 | **S01 (≡ T10)** | Streak count drift — Today raw vs Settings/Recap/Push protected | executor (one-line `<StreakPip days={protectedStreakLength}>` swap) |
| 4 | **Y02** | Cross-user AsyncStorage leak on signOut — `cachedUserTier` gives User B Pro UI without payment | security-reviewer + executor |
| 5 | **R03** | Cross-platform contradiction at `goal=0` (mobile green vs web red) | executor (host-level guard) |

### P1 — confusing / retention / legal-adjacent

| # | ID | Title |
|---|---|---|
| 6 | **T01** | Two definitions of "deficit-shaped" math on Today (ring REMAINING vs deficit banner) — gated on Grace direction call |
| 7 | **I02** | Retry-After dropped at clients; caption route flattens AI 429 to `parse_failed` |
| 8 | **I03** | Empty-string LLM ingredients pass empty check; recipe with one blank line saved |
| 9 | **I04** | No aggregate "unverified" banner on import preview when verifyIngredients fails |
| 10 | **I06** | Library-link save failure leaves half-saved recipe + duplicate-on-retry for manual paste |
| 11 | **I07** | Three hand-rolled client-copy surfaces — "Network error" vs "Import failed" vs "API not configured" |
| 12 | **I08** | Manual paste skips IG/TT caption flow; legal posture bypassed |
| 13 | **M04** | Meal source raw token leaks to user copy ("openfoodfacts", "apple_health") |
| 14 | **M05** | Edit→save round-trip drift compounds across portion changes |
| 15 | **M06** | Today carbs (net-carbs lens) vs `/macro-detail?macro=carbs` (raw) divergence |
| 16 | **P03** | GBP hardcoded; `_regionCurrency` arrives but is unused (known bug, re-evidenced) |
| 17 | **P05** | Web post-checkout webhook race — Free tier UI after paid checkout until refresh |
| 18 | **O01** | Verify `apps/mobile/app/onboarding-v2.tsx` redirect is in a shipped TestFlight build |
| 19 | **S03** | DST off-by-one in `computeProtectedStreak` (uses MS_PER_DAY instead of calendar arithmetic) |
| 20 | **Y04** | Activity Bonus empty-state copy "More → Connected" stale (Settings IA collapsed 2026-04-28); first-sync delay not surfaced |

### P2 — polish

| # | ID | Title |
|---|---|---|
| 21 | **T03** | Macro tile remaining caption off by ≤1g vs displayed Xg/Yg |
| 22 | **T08** | "Snap a meal" CTA always-on regardless of `mealsToday.length` (4 entry points for one action) |
| 23 | **T13** | Weekly rollup deficit colour ignores `weekConsumed === 0` neutral-grey rule |
| 24 | **T14** | 7700 vs 3500 kcal/kg constant split; centralise on 7700 |
| 25 | **M01** | Macro % rounding can sum 99% / 101% (largest-remainder fix) |
| 26 | **M07** | Macro-detail bar clamp + kcal subtitle on fiber page |
| 27 | **P04** | "Save 37%" badge hardcoded in two places; will silently lie on price change |
| 28 | **Y01** | Delete error codes leak; defensive table list missing rows (no orphans on happy path) |
| 29 | **B03** | Workouts list ordering undefined; no per-row timestamp for user to verify |

### Deferred — runtime check required

| # | ID | What to verify |
|---|---|---|
| D1 | **R04** | Empty-state opacity 0.18 visible on light + dark, mobile + web |
| D2 | **M03** | Apple Health + barcode + AI-photo micros: post-portion or per-serving? Log portion-×2 entries from each source |
| D3 | **M05** | Measure 4-cycle portion-edit drift bound to set the regression-test threshold |
| D4 | **P01** | Vercel `STRIPE_TAX_ENABLED` env value + Stripe Tax `tax_behavior: inclusive` config on Pro Price objects |
| D5 | **Y02** | Confirm 2-user reproduction (sign A out, sign B in, observe `cachedUserTier`/eat-again leak) |
| D6 | **Y03** | Household leave: Plan tab HouseholdBar refreshes immediately without app restart? |
| D7 | **O01** | TestFlight install verifies `/onboarding-v2` redirect is live on device |

---

## 3. Automation-test candidates

Bugs that should produce a regression-test pin alongside the fix. Highest-leverage first.

| Pin | Tied to | Shape |
|---|---|---|
| `today/streakPip-uses-protected.test` | S01 | Render Today, Settings, Recap with same fixture (1 freeze consumed); assert all three pips show identical number |
| `ring/goal-zero-cross-platform.test` | R03 | Mobile + web ring renderers given `{goal:0, consumed:500}`; assert same colour token |
| `recipe-import/error-shape.test` | I01 | Walk every error branch (URL/caption/image routes + saveImportedRecipe + web RecipeUpload); assert response carries `message` field with no vendor strings or Postgrest tokens |
| `recipe-import/image-fallback-flag.test` | I05 | Mock OpenAI 400 then 200; assert response includes `imageUsed: false` |
| `recipe-import/empty-ingredients.test` | I03 | Mock LLM returning `[""]` ingredients; assert empty-branch fires |
| `recipe-import/retry-after-passthrough.test` | I02 | 429 from any route; assert client wrapper reads `Retry-After` header |
| `auth/signOut-clears-asyncstorage.test` | Y02 | After signOut, assert `cachedUserTier`, `WRITTEN_IDS_KEY`, `FOOD_HISTORY`, `health_*` keys are removed |
| `nutrition/macro-detail-net-carbs-parity.test` | M06 | Same fixture; macro-detail's carbs total === Today carbs tile's value via `netCarbsForRow` helper |
| `nutrition/portion-edit-roundtrip.test` | M05 | 4 cycles of portion ×2 / ×0.5; assert final delta < threshold (set after runtime measurement) |
| `nutrition/source-label-humanised.test` | M04 | Snapshot empty-state + count-line copy with USDA + Apple Health fixtures |
| `today/macro-tile-remaining.test` | T03 | Fixture with fractional grams; assert displayed remaining = `displayedTarget − displayedCurrent` (not raw subtraction) |
| `streak/dst-boundary.test` | S03 | Fake `now` to spring-forward + fall-back boundaries in `Europe/London` and `America/Los_Angeles`; assert protected streak == raw streak when no zero-days |
| `pricing/annual-savings-derived.test` | P04 | `PRICING_TIERS[1].annualSavings` == `computedAnnualSavingsPct(annualPrice, price) ± 1pp` |
| `pricing/vat-disclosure-flag-states.test` | P01 | `BillingDisclosure` correct copy under both `STRIPE_TAX_ENABLED` values for UK/EU |
| `pricing/post-checkout-refresh.test` | P05 | `/home?checkout=success` triggers `refreshProfileBasics()` |

---

## 4. Deferred to roadmap (not this audit)

- **P03** wide currency support (USD/EUR Price IDs + `formatRegionPrice`) — ongoing workstream per `project_region_aware_pricing.md`.
- **M05 schema-correct fix** (persist `base_*` macros) — needs `data-integrity` sign-off and migration; the audit's lighter alternative is the right hot-fix.
- **B02 caveat** — TDEE explainer "energy expenditure" double-definition — for nutrition-engine pass, not this batch.
- **T08 product call** — Snap CTA empty-day vs always-on intent.
- **T01 product call** — deficit-math direction (`burn − consumed` vs `goal − consumed`).

---

## 5. Open questions — RESOLVED 2026-05-05

All seven decided by Grace 2026-05-05. Canonical doc: [`docs/decisions/2026-05-05-debug-audit-decisions.md`](../../decisions/2026-05-05-debug-audit-decisions.md).

| # | Resolution |
|---|---|
| T01 deficit-math | `burn − consumed` is canonical. Anywhere `goal − consumed` is labelled "deficit", rename to "remaining". |
| T08 snap CTA | Empty-day prompt only. Hide once `mealsToday.length >= 1`. |
| T14 kcal/kg | 7700 only. Replace Activity Bonus card's 3500/0.4536 path. |
| P01 Stripe Tax | Jurisdiction-aware (UK/EU inclusive, US automatic). **Deferred** to Notion task https://www.notion.so/35859b4150308164a858d4bb71d6295b — legal sign-off needed. Not in fix-batch. |
| P05 mechanism | Supabase Realtime subscription on `profiles.user_tier`. Not delayed poll. |
| O01 v2 naming | **STATUS CORRECTION:** the v2 → canonical rename already shipped 2026-04-30 in commit `080c90a`. Current state: `/onboarding` is canonical; `/onboarding-v2` is a 21-line redirect shim. Remaining cleanup is small UI-string sweep + keep/delete call on the shim. PostHog flag + analytics event names preserved for data continuity. |
| Y02 carve-out | Fix now. SignOut handler clears non-profile AsyncStorage keys; HealthKit-written-IDs set userId-keyed at write time. |

---

## 6. Acceptance check vs plan §7

- [x] Every question in plan §4 has an answer (clean / finding / deferred). No silent skips.
- [x] Every finding cites file:line evidence + a screenshot path where visual.
- [x] Every finding has either a proposed fix sketch OR an explicit deferred-with-reason.
- [x] No code edits performed.
- [x] Findings doc committed location: `docs/audits/2026-05-05-debug-audit/findings.md` (this file).

---

## 7. What happens next (per plan §8)

I will NOT touch product code until you sign off on a fix batch.

When you sign off, the recommended sequence is:

1. **Resolve open questions §5** (T01 direction, T08 intent, T14 constant, P01 Stripe state, P05 mechanism, O01 build verify, Y02 carve-out).
2. **P0 batch** — I01, I05, S01, Y02, R03 (in that order; S01 is one line, do first as a win).
3. **P1 batch** split into:
   - Recipe import cluster (I02, I03, I04, I06, I07, I08) — single PR, scoped to import.
   - Today cluster (T01 once direction is locked) — separate PR.
   - Nutrition cluster (M04, M05 lighter, M06) — separate PR.
   - Pricing/web cluster (P03 doc-only, P05) — separate PR.
   - Mobile/copy cluster (S03, Y04, O01 verify) — separate PR.
4. **P2 polish** — consolidate into one cleanup PR after the P1 batches.
5. **Test pin batch** — co-land with each fix batch; aim to ship every test in §3.

Each fix batch ships with BEFORE/AFTER captures per `feedback_visual_validation_mandatory.md`.

---

## 8. Appendix: per-area capture references

All paths absolute on Grace's Mac, fresh as of 2026-05-05 17:21 (mobile) / 2026-05-05 morning (web).

- **Today:** `apps/mobile/screenshots/latest/state-60-today-current.png`, `state-61-today-scrolled.png`, `route-progress-metric-calories.png`, `docs/audits/2026-05-05-full-sweep/web/web-desktop-authed-tracker-today.png`
- **Macro detail:** `apps/mobile/screenshots/latest/route-macro-detail-{protein,carbs,fat,fiber}.png`
- **Meal nutrition:** `apps/mobile/screenshots/latest/route-meal-nutrition.png` (empty-state — not load-bearing for findings)
- **Recipe import:** `apps/mobile/screenshots/latest/route-import-shared.png`, `route-create-recipe.png`
- **Pricing + paywall:** `docs/audits/2026-05-05-full-sweep/web/web-desktop-pricing.png`, `web-mobile-pricing.png`, `apps/mobile/screenshots/latest/route-paywall.png`
- **Onboarding:** `docs/audits/2026-05-05-full-sweep/web/web-desktop-onb-*.png`, `apps/mobile/screenshots/latest/onb-*.png` (all 404 in capture — see O01)
- **Settings + profile:** `apps/mobile/screenshots/latest/route-tabs-settings.png`, `route-profile.png`, `route-household-settings.png`
- **Burn:** `apps/mobile/screenshots/latest/route-burn-detail.png`, `route-health-sync.png`
