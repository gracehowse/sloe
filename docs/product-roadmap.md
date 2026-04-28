# Product roadmap — Suppr (recipe + macro platform)

This document extends the MVP hardening work with **nutrition depth**, **activity-adjusted targets**, and **social discovery**. It is the north-star for prioritization; implementation order should follow dependencies below.

**Last reviewed:** 2026-04-27 (Phase 2 of strategic redesign — tab collapse + canonical Today + caffeine/alcohol opt-in shipped).

**Supabase (2026-04-18):** migration drift on the linked prod project is **reconciled** through **`20260421180000`** (`supabase db push --linked`). Process and replay notes: [`docs/planning/supabase-migration-drift-inventory.md`](../planning/supabase-migration-drift-inventory.md).

---

## Strategic redesign — phase status (2026-04-27)

Authority: `docs/decisions/2026-04-27-strategic-direction.md` (17 binding decisions) + `docs/specs/2026-04-27-production-design-spec.md`.

| Phase | Batch | Status | Notes |
|---|---|---|---|
| Phase 1 | Foundation tokens + primitives (SupprCard / TrustChip / SourceDot / ConfidenceChip / EmptyState / SkeletonRow) | **Shipped** (2026-04-25 / -26) | CI green; both platforms |
| Phase 2 | B1.1 — Tab structure 6 → 4 (Today / Recipes / Plan / You) | **Shipped** (2026-04-27) | Sub-tab pills on Recipes / Plan / You; web sidebar mirrors |
| Phase 2 | B1.2 — Canonical Today (kill 3 variants, StreakPip, persistent LogFab, drop QuickLogStrip) | **Shipped** (2026-04-27) | North-star block deferred to Phase 3 / B2.2 (data dependency) |
| Phase 2 | B1.4 — Caffeine + alcohol behind Settings opt-in | **Shipped** (2026-04-27) | Default off; AsyncStorage / localStorage; no DB schema change |
| Phase 2 | B1.3 — Pricing collapse Free + Pro | **Open** | Separate PR; coordinates with `monetisation-architect` |
| Phase 2.5 | Household demote behind Settings flag | **Open** | Deferred from B2 of strategic batch — next follow-up |
| Phase 3 | B2.1 — Canonical Log FAB → unified `<LogSheet>` | **Open** | Phase 2 ships the FAB placeholder; this batch wires the sheet |
| Phase 3 | B2.2 — North-star "what to eat next" block on Today | **Open** | Threads `mealPlanAlgo` scoring into Today render |
| Phase 3 | B2.3 — Onboarding produces first plan | **Open** | Library seed + auto-plan-from-seed |
| Phase 3 | B2.4 — Trust posture sweep on every macro row | **Open** | TrustChip + SourceDot threading across diary / planner / recipe / saved-meal / Quick Add / search |
| Phase 4 | B3.1 — Adaptive TDEE Progress headline | **Open** | Sits in You tab now (B1.1 prerequisite landed) |
| Phase 4 | B3.2 — Coeliac/gluten depth | **Open** | Depends on B2.4 chip carrier |
| Phase 4 | B3.3 — TestFlight expansion (open beyond N=1) | **Open** | Gated on demo moment shipping (B2.1–2.4) |

Detailed journey: [`docs/journeys/tab-collapse-2026-04-27.md`](journeys/tab-collapse-2026-04-27.md).

---

## P0 launch-readiness status (Opus 4.7 review, 2026-04-25)

| # | Item | Status |
|---|------|--------|
| P0-1 | Apply schema-drift repair migration `20260503101000` | **Applied on linked prod** (was already present pre-push 2026-04-25; `supabase migration list --linked` confirms remote parity) |
| P0-2 | Density-aware `totalGramsForVerifyScale` — close ml=g bug | **Shipped** — 13/13 tests green; mobile verify screen renders "needs density" hint |
| P0-3 | Enforce `wouldCoerceMacros` at every `nutrition_entries` write | **Shipped** — recipe-detail mobile guarded; meta-test pins inventory of 5 sites; planner paths were already guarded |
| P0-4 | `profiles` lockdown forward-compat for unborn billing columns | **Applied on linked prod 2026-04-25** via `supabase db push --linked` — original audit was a phantom finding (columns don't exist); runtime + static safety net active |
| P0-5 | `generateSmartPlan` UI thread + sampler reduction | **Shipped** — sampler 20 000 → 2 000 via shared `MEAL_PLAN_SAMPLER_CAP` constant; `InteractionManager.runAfterInteractions` already in place since T14 |
| P0-6 | Rate-limit per-user scoping (16 endpoints) | **Shipped** — `RateLimitOptions.userId` field; key shape `${prefix}:user:${uid}:${ip}`; meta-test fails CI on regressions |
| P0-7 | RevenueCat webhook ops runbook | **Runbook shipped** at `docs/operations/revenuecat-webhook-runbook.md`; ops actions remain for Grace (RC dashboard + Vercel env + redeploy) |

**Test surface:** 198 unit tests green across the touched surface.

**Migrations applied on linked prod (2026-04-25 push session):**
1. `20260503101000_schema_drift_repair.sql` (P0-1) — was already on remote pre-push; `supabase migration list --linked` shows remote parity. ✅
2. `20260503102000_profiles_lockdown_forward_compat.sql` (P0-4) — applied during this push. ✅

Local + remote now match through `20260503102000`. Harmless warning during push: `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` unset (only needed for Apple Sign-In on web, which is not a launch path).

**Ops actions remaining for Grace:**
- RevenueCat webhook setup per [`docs/operations/revenuecat-webhook-runbook.md`](operations/revenuecat-webhook-runbook.md) (P0-7 — ~10 minutes).

P1 (11 items) and P2 (9 items + new P1-19 chip) remain. Beginning P1 batch next.

## P1 launch-readiness status (Opus 4.7 review, 2026-04-25)

| # | Item | Status |
|---|------|--------|
| P1-8 | Unify ingredient confidence thresholds | **Shipped** — per-line + mean unified at 0.50; 7/7 tests green; mobile duplicate removed |
| P1-9 | Unify meal-plan algorithm web ↔ mobile | **Shipped** — 4 divergent constants now shared (recency penalty, reset window, both bands); 60/60 tests green; full deduplication tracked as P2-28 |
| P1-10 | Bump web `@supabase/supabase-js` 2.56.0 → 2.102.1 | **Shipped** — 134/134 Supabase-touching tests green |
| P1-11 | CI gates — Playwright e2e + check:migrations | **Shipped** — Playwright e2e was already wired; new `--static` migration check + `--migrations-dir` flag + 5/5 tests + new CI step |
| P1-12 | Optimistic mobile journal writes | **Shipped** — `logPlannedMealWithPortion` now optimistic + rollback; persistent offline queue → P2-29 |
| P1-13 | Mobile Sentry + PostHog event coverage | **Shipped** — `onboarding_completed` now fires from mobile (skip + full paths); `syncObservabilityUser` stamps Sentry + PostHog identity on every auth state change |
| P1-14 | RevenueCat live-replay test in `prelaunch:checklist` | **Shipped** — `scripts/test-revenuecat-replay.mjs` posts twice and asserts `skipped_duplicate`; gracefully skips when env unset |
| P1-15 | Resolve incorporation + finalize legal pages | **Runbook + lint shipped** — 5 placeholders inventoried (3 privacy + 2 terms; audit said 3, missed 2); legal-finalization-runbook details 10-step sequence |
| P1-16 | Launch checklist + App Store listing doc | **Shipped** — `docs/launch/checklist.md` (3 phases, 31 rows) + `docs/launch/app-store-listing.md` (full scaffold) |
| P1-17 | Backfill 5 missing decision docs | **Shipped** — RC webhook arch, meal_plans schema, allergen populate, weight_surface_mode enum, onboarding v2 mobile arch |
| P1-18 | FatSecret licence page sweep | **No-op (already shipped 2026-04-25 in commit `072cb31`)** — licence page line 39 already reads "Basic developer tier — non-caching"; audit was stale |
| P1-19 | Planner-row "estimated · verify" chip | **Deferred to P2** (created during P0-3) — JSON guards for journal writes are sufficient; chip is visual-honesty enhancement |

**Test surface:** 239 unit tests green across the touched surface.

**Decision docs (Notion mirrored):** P1-8 to P1-18 each have a decision doc in `docs/decisions/` dated 2026-04-25.

**New P2 items added during P1 execution:**
- P1-19 — Planner-row "estimated · verify" chip on coerced rows (deferred from P0-3)
- P2-28 — Full meal-plan algorithm deduplication (one shared findBestMealSet)
- P2-29 — Persistent offline write queue (mobile journal)

P2 (12 items now) is post-launch v1.1 hygiene.

## P2 launch-readiness status (Opus 4.7 review, 2026-04-25)

| # | Item | Status |
|---|------|--------|
| P1-19 | Planner-row "estimated · verify" chip | **Shipped** — flag threaded through both algorithms; chip rendered on both platforms |
| P2-19 | Mobile Tracker monolith refactor | **Deferred to v1.1** — structured 4-phase plan in decision doc |
| P2-20 | verifyRecipe.ts decomposition | **Deferred to v1.1** — structured 5-step plan |
| P2-21 | `app/` vs `src/app/` decision | **Documented** — CONTRIBUTING.md update; convention enforced at PR review |
| P2-22 | Mobile library kind filter | **No-op (audit stale)** — already shipped in Pass 6 / 2026-04-18 |
| P2-23 | Mobile named-slot switcher | **No-op (audit stale)** — already shipped (lines 244–259 + 1350–1395) |
| P2-24 | Cook mode → log-this-meal | **Shipped** — autoLog query param + useRef fire-once on recipe page |
| P2-25 | Social/screenshot recipe import | **No-op (audit stale)** — both URL + image OCR + iOS share-extension already shipped |
| P2-26 | Net-carbs lens | **Foundation shipped, display rollout → P3-30** — migration + helper + 8/8 tests; UI rollout would create UX trap if shipped without all surfaces |
| P2-27 | Apple Watch + widget | **Foundation already shipped, native target → P3-31** — widgetSnapshot.ts canonical schema in place; Xcode work deferred |
| P2-28 | Full meal-plan algorithm dedup | **Deferred to v1.1** — P1-9 closed user-visible drift; structural dedup via generic `findBestMealSet<R>` is the v1.1 PR |
| P2-29 | Persistent offline write queue | **Deferred to v1.1** — P1-12 closed 80% via optimistic+rollback; persistent queue is coordinated web+mobile feature |

**Test surface:** 251 unit tests green across the touched surface.

**Audit corrections (P2 batch):** Five items the audit flagged as gaps were already shipped (P2-22, P2-23, P2-25 fully; P2-27 foundation; P1-19 has all the data but UI was the missing piece). Pattern continues from P0/P1: the audit verifier missed existing implementations because the keywords didn't match.

**Decision docs (Notion mirrored):** P1-19, P2-19, P2-20, P2-21, P2-22, P2-23, P2-24, P2-25, P2-26, P2-27, P2-28, P2-29 each have a decision doc in `docs/decisions/` dated 2026-04-25.

**New v1.1 follow-up tasks (P3 backlog):**
- P3-30 — Net-carbs lens display rollout (Settings + Tracker + Recipe Detail).
- P3-31 — Apple Watch complication + iOS widget Swift extension.

## 2026-04-26 visual-QA polish round

Tester feedback (with screenshots) flagged 9 distinct issues observed on live mobile + web. All landed in a single polish round, decision doc at `docs/decisions/2026-04-26-visual-qa-polish-round.md`. None of P0/P1/P2 was reopened.

| # | Item | Status |
|---|------|--------|
| Polish-1 | `[TEMP SEED]` description leak | **Shipped** — source-side strip + render-time `sanitizeRecipeDescription` (5 tests) |
| Polish-2 | Floating-point macro display ("105.80000000000001g") | **Shipped** — shared `formatMacro` helper, 5 render sites (8 tests) |
| Polish-3 | Discover macro icon parity (carbs/fat/fibre) | **Shipped** — icon-per-macro on web + mobile Discover; fibre joins when present |
| Polish-4 | ALL-CAPS imported recipe titles | **Shipped** — shared `normalizeRecipeTitle` at 3 save sites (6 tests) |
| Polish-5 | Recipe Detail spacing (calories ↔ macros gap) | **Shipped** — dropped redundant overline + tightened margin |
| Polish-6 | Search tokenization ("wasabi katsu curry" returned nothing) | **Shipped** — shared `recipeSearchMatch` token-AND helper, web + mobile Discover (7 tests) |
| Polish-7 | Zero-cal serving accepted at high confidence | **Shipped** — `sourceIsAllZero` guard in FatSecret path (`verifyIngredients.ts`) |
| Polish-8 | Meal plan portion clamp + low-fit fallback | **Shipped** — clamp tightened {0.5, 2.0, 0.5}; 4-candidate fallback re-sample on both web + mobile |
| Polish-9 | Short micronutrient list | **Deferred — FatSecret upgrade** (Grace owns; sibling decision doc) |

**Test surface (delta):** 31 new tests across 5 new test files; 2 existing tests updated (`mealPlanMacroFit.test.ts`, `discoverThreeSectionLayout.test.ts`); web `tsc --noEmit` clean; mobile `tsc --noEmit` clean.

**Vendor decision:** FatSecret tier upgrade chosen over OFF-search shadow path. See `docs/decisions/2026-04-26-fatsecret-upgrade.md`. Engineering work is no-op until tier flips; storage + renderer already accept the wider 32-nutrient panel.

---

## Product thesis

- **Macro trackers**: strong logging and targets; weak joyful food discovery and meal planning from real recipes.
- **Recipe / social food apps**: strong scroll and saves; weak closing the loop to *your* calorie and protein budget.
- **Our wedge**: targets → plan → shop → cook → log in one place, with a feed that's genuinely fun to browse — and **creator-friendly** flows (save, plan, shop) built for recipes.

---

## At a glance — where we actually are

We've **jumped around and ahead** of the original phase order. Several Phase A items rolled out alongside Phase B HealthKit work, and a first slice of Phase F (household planning) shipped before Phase D (social feed) is done. Treat phases as **themes**, not gates.

| Phase | Theme | State |
|---|---|---|
| A | Macro-native meal planning | **Mostly shipped** (fiber, water, caffeine/alcohol, dietary prefs, custom foods, usual-meal bundles, copy/duplicate, favourites, leftovers, plan templates) |
| B | Activity-adjusted calories + HealthKit | **Shipped on iOS** (HealthKit read/write, adaptive TDEE, deficit projection, burn detail); **web relies on manual burn entry** |
| C | Daily summary quality / retention | **Mostly shipped** (remaining macros bar, fit-this-in, streak freeze, weekly recap + push, CSV export). Weekly fiber/hydration rollups still TBD |
| D | Social feed | **Partial** — publish moderation + verified notification are in; discover feed polish, creator loop, and multi-format authoring still TBD |
| E | Premium / compliance polish | **Live trust surfaces only** — privacy, terms, AI disclosure, Stripe (web) + IAP paywall UI (mobile). Deeper tiering / affiliate disclosure deferred |
| F | Friends / households | **Phase 1 shipped early** — single-household, shared dinners, per-member remaining macros, invite codes. Friends graph, partner sync, plan sharing still TBD |

---

## Phase A — Macro-native meal planning

**Goal:** Meal plans respect user goals, not just library slots.

### Shipped

- **Macro-aware planner.** `generateMealPlan.ts` scores breakfast + lunch + snack + dinner combinations from saved recipes to minimize deviation from daily kcal / protein / carbs / fat within ±% bands (defaults ±12% kcal, ±18% C/F). Multi-day plans clear the "recent" pool every 3 days. `MealPlanner` shows actual vs target per macro with band messaging, Discover / Library CTAs when the library is empty, and blocks generate until at least one recipe is saved.
- **Fiber + water as first-class goals.** `profiles.target_fiber_g`, `profiles.target_water_ml`. Nutrition tab shows both; quick-add chips for water; per-meal fiber aggregation in day totals. Fiber column in RemainingMacrosBar is conditional on non-zero target (see `decisions_batch_1_1_1_2` DEC-005).
- **Caffeine + alcohol tracking** (Batch 2.5). `profiles.target_caffeine_mg` (FDA 400 mg default), `profiles.target_alcohol_g_weekly` (opt-in, row hidden until set). Quick-add chips, week-rolling alcohol sum, factual over-target copy in amber (never red whole-card shame). Shared `hydrationStimulants.ts`.
- **Dietary requirements + preferences.** `profiles.dietary` stores `vegetarian / vegan / pescatarian / gluten-free / dairy-free / nut-free / halal / kosher` via the canonical `DIETARY_PREFERENCE_ENTRIES` set (`src/constants/dietaryPreferences.ts`). Recipe labeling and discovery filtering apply the same ids. **Coeliac-strict and allergen-ingredient-level filtering is still TBD**.
- **Custom foods** (Batch 3.9). Homemade / local-only foods with any number of named serving shortcuts (`1 bowl = 80g`). Shared `scaleMacrosForGrams`. Owner-only RLS on `user_custom_foods`. **FoodSearch integration shipped 2026-04-18 (audit C1)** — `FoodSearch.tsx` + `FoodSearchModal.tsx` now list custom foods at top of results with a "Custom" badge, a "+ Create custom food" row always below results, portion chips for named servings, and edit/delete via overflow menu (web) / long-press (mobile). Primary log path on web NutritionTracker inline search still uses legacy USDA-only search (C1a backlog follow-up).
- **Usual meals** (Batch 2.6 + Ship M1). 2+ logged items saved as a named bundle, re-logged in one tap from the **Usual meals** tab in Quick add. Parent `user_saved_meals` + child `user_saved_meal_items`.
- **Favourites / Frequent / Recent Quick Add** (Batch 1.3). Tabbed picker; star any meal to one-tap re-log. "Eat again" clock-aware banner. `user_favorite_foods` with unique key on `user_id + lower(title) + round(cal)`.
- **Copy meal / Duplicate day** (Batch 1.4). Per-meal and per-day copy to single day or inclusive range. Shared `copyMeals.ts`.
- **Add ingredient + per-ingredient overrides** (Batch 2.7). Add a missed ingredient post-import or pin manual "label values" on one row without losing the match. `recipe_ingredients.override_macros` + `added_by_user`.
- **Drag-drop meals between days, save-plan-as-template, leftovers-aware planning** (Batch 3.10). `user_plan_templates`; `meal_plan_meals.is_leftover` + `leftover_of_recipe_id`; auto-distribution of multi-serving recipes into matching next-day slots. **Mobile Move action shipped 2026-04-18 (audit C2)** — long-press a meal row → action sheet → `MoveMealSheet` destination picker → shared `moveMealInPlan` helper. No native drag-drop on mobile by design; parity is now real.
- **Adaptive TDEE** (Phase B shipped into A's loop). `computeAdaptiveTDEE` persists `profiles.adaptive_*` when confidence clears medium/high; 6 h throttle; runs after every journal insert/delete on web and every `nutrition_entries` upsert on mobile.

### Still to build

- **Allergen / ingredient-level filtering** — ingredient-level gluten detection for coeliac-strict, peanut/tree-nut splits, sesame, shellfish, etc. Current dietary prefs are profile-level flags; recipes tag themselves, but we don't yet inspect the parsed ingredients to catch hidden conflicts.
- **Hard-filter vs soft-warn policy** — confirm product call for each restriction (see Open decisions below).
- **Recipe label confidence** — surface *why* a recipe is labelled gluten-free (author tag vs derived).
- **Period & pregnancy target presets (account-only, non-medical)** — optional profile / Settings modes so users can **re-point calorie and macro targets** when life stage changes (e.g. switch from a weight-loss band to **maintenance** for first trimester, then apply a **user-entered** +kcal delta per trimester or week that mirrors what their clinician suggested). v1 scope: **no** cycle prediction, symptom logging, coaching copy, or implied clinical accuracy — only structured goal edits + honest disclaimers. Surfaces: web + mobile goal / targets flows; may reuse existing target override + provenance fields (`target_calories_source` pattern) for auditability. **Also on public roadmap** (`src/lib/landing/content.ts` → `/roadmap`).

*Depends on:* stable `nutrition_entries` / per-day logging patterns (✅).

---

## Phase B — Activity-adjusted calorie allowance

**Goal:** Steps and workouts adjust net or goal calories so the product matches how serious trackers behave.

### Shipped (iOS)

- **HealthKit read.** `react-native-health` wired via Expo config plugin. Reads active energy, basal energy, workout sessions, weight, body fat, and dietary samples (protein, carbs, fat, fibre, caffeine) into `nutrition_entries` with `health_sample_id` idempotency key. Steps + workouts populate `nutrition_entries.workout_kcal` + `basal_kcal` columns.
- **HealthKit write.** `exportDayToHealth` writes `Suppr` food + caffeine samples; imported-food source attribution is visible in the UI.
- **Burn detail screen** (`app/burn-detail.tsx`, mobile) explains the day's basal vs active split, the net budget, and the adjustment rule.
- **Adaptive TDEE** (`src/lib/nutrition/adaptiveTdee.ts`). Persists `profiles.adaptive_calories / adaptive_confidence` after enough weight + intake history; respects user override. Refresh is throttled and only medium/high confidence is persisted.
- **Deficit projection** (`src/lib/nutrition/deficitProjection.ts`). Lose It–style "~X kcal under today → projected ~Y kg/wk" copy, framed as projected (not guaranteed), and messaging admits intraday uncertainty.
- **Manual activity burn fallback** on web + mobile for users who opt out of Health. Kept as the default on web.
- **Source-honest copy.** Health-written meals show source attribution; "synced" means "last successful read", not a live pipe (`docs/health-platform-phase-b.md`).

### Still to build

- **Android equivalent** — Google Fit or Health Connect spike; currently Android falls back to manual.
- **Web parity** — no HealthKit on web; current approach is manual-only plus a documented honest gap.
- **Partner APIs** — Strava / Garmin / etc. for users who track workouts outside Apple Health.
- **Back-of-week rollup** — "this week vs maintenance" in Progress; currently the daily deficit projection is solid but the weekly framing is looser than Lose It.

*Risks / notes:* HealthKit is a permissioned datastore, not a live sync bus. Imported food logs originating in another writer (e.g. MacroFactor) should agree with the writer app once flushed; batching reality documented in `docs/health-platform-phase-b.md`.

---

## Phase C — Daily summary quality (retention)

### Shipped

- **Remaining macros bar** (Batch 1.2) — kcal / protein / carbs / fat (+ fiber when a fiber target is set). Shared `remainingMacros.ts`. Over-budget macros show `+N over` in destructive colour on the number only — no whole-card red (DEC-004).
- **Fit-this-in preview** — food search portion pickers show projected remaining after the candidate portion would be logged (`projectRemaining`).
- **Week-start-day setting** (Batch 1.1) — Monday / Sunday; `profiles.week_start_day`; affects DayStrip, weekly views, `progressWeekReport`, rolling-window calcs.
- **Favourites / Frequent / Recent / Eat-again** — see Phase A.
- **Copy meal / Duplicate day** — see Phase A.
- **Hydration + caffeine + alcohol card** — see Phase A.
- **Saved meals, add-ingredient + overrides, custom foods, leftovers / plan templates, drag-drop** — all shipped in Batches 2.6, 2.7, 3.9, 3.10.
- **Streak freeze + Weekly recap + weekly push** (Batch 4.11). Freeze credits (default cap 3) earned at 7-day milestones; raw streak untouched, protected streak derived. Weekly recap card at EOW (Sun or Sat based on `week_start_day`) with avg kcal, protein adherence, streak + freezes, weight delta (suppressed <2 weigh-ins), best day. Mobile `expo-notifications` WEEKLY trigger at 18:00 local. Web push deferred.
- **Siri Shortcut deep links** (Batch 5.12). `suppr://log/water?ml=N`, `suppr://fast/start?hours=N`, `suppr://today/remaining`. WHATWG URL parsing; single-slot 5-min TTL pending queue; VoiceOver announcements. **iOS widget explicitly removed from launch scope (2026-04-18 product decision — not critical for launch)** — `widgetSnapshot.ts` infra still writes the JSON so a native WidgetKit extension can be added later without more code changes; no native target exists today.
- **Voice logging + AI photo logging (Pro, Batch 5.13).** Press-and-hold mic on Today → transcript → `/api/nutrition/voice-log` → verified-macro review list with confidence badges + "AI estimate" badges → commit. Snap chip → camera/library picker → `/api/nutrition/photo-log` (GPT-4o vision) → same review flow. Low-confidence (<0.5) items flagged with `role="alert"` and can only be committed via explicit "Log anyway". Pro-gated: free + Base tiers see a factual paywall dialog, no countdowns. Analytics: `voice_log_started/_committed/_paywalled`, `ai_photo_log_started/_committed/_paywalled`. Shared helper `src/lib/nutrition/aiLogging.ts` owns sanitisation + classification + totals across web and mobile. 37 new unit tests cover the helper.
- **CSV export** — shared `exportNutritionCsv.ts` (web) + `apps/mobile/lib/exportCsv.ts` (mobile). One row per logged meal per day: date, meal, food, kcal, protein, carbs, fat, fiber, source, time.

### Still to build

- **Weekly fiber + hydration adherence** rollups in Progress (parallel to protein adherence in weekly recap).
- **Per-meal breakdown export** — current CSV is per-logged-row; Lose-It-style per-slot rollup export is a future-cut.
- **Native iOS Home / Lock-screen widget extension** consuming `WidgetSnapshot`. **Deferred post-launch** — user decision 2026-04-18: widgets not critical for launch. Do not reinvestigate scope until the post-launch widget track is opened.
- **`react-native-siri-shortcut` donation** to auto-populate the Shortcuts app.
- **Web push** for weekly recap (blocked on service-worker infra).

*Depends on:* Phase A fields present in logs and UI (✅).

---

## Phase D — Social feed (differentiator)

**Goal:** If users want recipe inspiration, they open **this** app.

### Shipped (foundations)

- **Publish moderation + notify-only-verified** migrations — author-published recipes gate on moderation flags before showing in discover; notification fanout is scoped to verified recipes to avoid low-quality noise.
- **Social import** — Instagram / TikTok caption → OpenAI → structured recipe, wired into the import pipeline with provenance.
- **Community recipes pool** — discover reads published recipes with author attribution.

### Still to build

- **Feed depth** — filters (macros, diet), creator profile pages, saves → library → plan → shopping loop completion.
- **Creator loop** — saves / plan-adds analytics to creators, follower notifications on new recipe publish.
- **Honest timestamps + sample vs community** badges throughout discover.
- **Creator publishing — LTK-style multi-format** (later). Many creators won't want a **recipe-only** upload that feels disconnected from how they work on **Instagram, TikTok, and similar**. They will expect to attach the **same kind of content** they already ship elsewhere — reels, short video, carousel-style posts, captions — alongside (or wrapped around) the structured recipe so the feed feels native and shoppable.
- **Create once, share everywhere** (later). Investigate a single authoring or syndication path analogous to how **LTK** lets creators produce once and fan out to every channel that matters. Suppr as a first-class destination in that mix — creators publish once (or connect an existing source) and reach Suppr plus other platforms without a separate "recipe-only" production line. Implications: media pipeline, rights + attribution, moderation, how structured recipe data maps to rich posts.

*Depends on:* stable publish / discover pipeline (✅ groundwork).

---

## Phase E — Premium / compliance polish

### Shipped

- **Privacy + Terms pages** on web, with AI / photo / voice / subprocessors disclosure.
- **Privacy + Terms links** in mobile (More / Settings → WebView / `Linking`).
- **In-product AI disclosure** on photo tracker and voice modal pointing to Privacy.
- **Stripe (web) + mobile paywall UI** — tier read via `getUserTier` with RLS-safe path; voice / photo 403 `upgrade_required` surfaces as a clear paywall prompt, not a parse error.
- **Subscription narrative doc** — `docs/product/subscriptions-stripe-and-iap.md` (web Stripe vs mobile IAP; Supabase tier as shared truth).
- **Account delete** — shipped on both platforms with data-nuke pipeline (`nukeAccountData.ts`).

### Still to build

- **Affiliate / sponsored disclosure** — required before any commerce-adjacent feature ships (shopping list shoppable links, creator commerce).
- **Tiering audit** — which Health / advanced-planner features sit behind base vs pro; align with business model.
- **Mobile IAP wiring** — paywall UI exists, but full RevenueCat integration is pending env / offerings config (see `docs/decisions/2026-04-revenuecat-offerings-empty.md`).

---

## Phase F — Friends, shared meals, household meal plans

**Goal:** Let people who cook and eat together stay aligned in Suppr without duplicating work — while each person keeps their own targets and fills their own gaps.

### Shipped (Phase F.1 — household dinners, jumped ahead of Phase D polish)

- **One household per user.** `public.households` (invite code), `household_members` (owner + members, RLS), `household_meals` (shared dinners with per-serving macros). `profiles.household_id` links a user to their household.
- **Shared dinner list** (read-only for members, editable for owner / creator). Date + meal label + recipe + per-serving macros.
- **Per-member remaining macros** on household view — each member sees their own consumed / targets / remaining after the shared meal.
- **Surfaces:** `HouseholdPanel.tsx` (web), `HouseholdCard.tsx` (mobile).

### In progress (Phase F.2 — Netflix-model v1, 2026-05-01)

- **Per-member sharing preset** — `household_members.share_preset` with five values (`all`, `dinners`, `dinners_weekends`, `lunch_dinner`, `custom`). Supersedes the owner-level `share_lunch` boolean; `custom` preserves the per-cell override grid. Schema shipped; UI + read-path switch pending.
- **Soft-delete on households** — `households.disbanded_at` gives a 30-day retention window before hard-delete so historical `household_meals` don't orphan. Schema shipped.
- **Cook display-name snapshot** — `household_meals.cook_display_name` keeps leavers' historical attributions legible. Schema + backfill shipped.
- **Privacy boundary pin** — structural RLS test (`tests/unit/householdPrivacyRls.test.ts`) fails CI if any household migration ever adds a policy on `profiles`, `weight_entries`, `nutrition_entries`, `health_snapshots`, or similar personal-data tables. See `docs/decisions/2026-05-01-household-netflix-model-v1-schema.md`.

### Still to build

- **Friends graph** — trusted connections outside of household (one-to-one share).
- **Share meals / share plans / share slices** — send or link individual logged / saved meals, or specific slots, without sharing an entire plan.
- **Plan-for-one, cook-for-many semantics** — explicit rule for "my portion" vs "household batch" when scaling a recipe for 2+ diners.
- **Partner sync** — shared dinners land on the partner's planner; B / L / snacks stay theirs; **macro-aware gap fill** generates meals that fill only the remaining budget, not the fixed shared slots.
- **Privacy + consent model** — opt-in per share type; revoke; recipient permissions.
- **Conflict handling** — when two users edit the same slot.
- **Portion math + double-count guardrails** — whose "one serving" when scaled for two; avoid silent misallocation.
- **Notifications** — plan updated, meal swapped, shopping list impact; frequency + muting.

*Depends on:* solid single-user planning + day totals (✅); friends primitives may overlap with Phase D.

---

## Suggested sequencing (refreshed)

We've already completed much of the Phase A + B + C breadth. The remaining sequence is:

1. **Close out Phase A allergen depth** — ingredient-level hard-filter vs soft-warn for coeliac, nut, shellfish. Surfaces in discover + planner.
2. **Close out Phase C rollups** — weekly fiber + hydration adherence. (Native iOS widget extension + Siri donation explicitly deferred post-launch per user decision 2026-04-18 — widgets not critical for launch.)
3. **Phase B breadth** — Android / Health Connect spike; Strava / Garmin partner APIs; weekly deficit rollup.
4. **Phase D depth** — feed filters, creator profile + follow + notifications, saves→library→plan loop polish. Multi-format creator authoring is exploratory until baseline and compliance are clear.
5. **Phase F.2** — friends graph + one-to-one meal / plan sharing. Partner sync with macro-aware gap fill. Keep sharing opt-in per type, revokable.
6. **Phase E commerce polish** — affiliate / sponsored disclosure when commerce ships; tiering audit.

---

## Open decisions (capture before large build)

| Topic | Question | State |
|---|---|---|
| Android health | Google Fit vs Health Connect; v0 scope? | Open |
| Partner APIs | Strava / Garmin priority vs stronger Apple Health depth? | Open |
| Allergen depth | Profile-level hard filter vs soft warning per restriction; ingredient data source (manual vs supplier vs third-party)? | Open |
| Creator syndication | Build in-house "post once" vs partner integrations; v1 format scope (recipe + link vs in-app video)? | Open |
| Shared plans (F.2) | Invite model (link vs in-app friend); edit vs view-only; how shared slots merge into recipient's week without overwriting their other meals? | Open |
| Shared plans (F.2) | Portion + logging model when one recipe serves multiple Suppr users — single log split vs mirrored entries? | Open |
| Shared plans (F.2) | Which macro / micro fields drive "gap fill" suggestions for B / L / snacks after dinners are fixed? | Open |
| Commerce disclosure | When shopping list / recipe cards get affiliate / sponsored links, what's the in-product disclosure pattern? | Open |

### Resolved (moved out)

- ~~Web-only vs native iOS for HealthKit?~~ → Native iOS via Expo / `react-native-health`; web stays manual.
- ~~Add-back vs TDEE model?~~ → Adaptive TDEE with confidence gating + documented formula in burn-detail screen.
- ~~Fiber per-recipe vs estimates?~~ → Both: DB-first with ingredient estimation fallback; fiber column conditional on non-zero target.
- ~~Water: single daily total vs time-bucketed?~~ → Single daily total with quick-add chips; time-bucketing not planned.
- ~~Fasting on web?~~ → Mobile-only MVP (`docs/decisions/2026-04-fasting-web-scope.md`).
- ~~Recipe routes auth-gated?~~ → Yes until SEO / share is prioritised (`docs/decisions/2026-04-recipe-routes-auth-middleware.md`).

---

## Related implementation areas in repo

- **Mob-inspired UX / smart-suggestions notes (ingredient overlap, shopping polish):** [`docs/mob-inspired-notes.md`](mob-inspired-notes.md).
- **HealthKit semantics (writer/reader, batching):** [`docs/health-platform-phase-b.md`](health-platform-phase-b.md).
- **Subscriptions (Stripe web vs IAP mobile):** [`docs/product/subscriptions-stripe-and-iap.md`](product/subscriptions-stripe-and-iap.md).
- **Brand tokens:** [`docs/ux/brand-tokens.md`](ux/brand-tokens.md).
- **Decisions log:** [`docs/decisions/`](decisions/).
- Nutrition UI: `src/app/components/NutritionTracker.tsx`, `AppDataContext`.
- Planner: `src/lib/planning/generateMealPlan.ts`, `MealPlanner.tsx`.
- Feed / social: `DiscoverFeed.tsx`, `RecipeDetail.tsx`, saves + follows in context + Supabase schema.
- Household: `src/app/components/HouseholdPanel.tsx`, `apps/mobile/components/HouseholdCard.tsx`, migration `20260420100000_household_planning.sql`.
- HealthKit: `apps/mobile/lib/healthSync.ts`, `apps/mobile/lib/healthDietaryNutrients.ts`, `apps/mobile/app/health-sync.tsx`, `apps/mobile/app/burn-detail.tsx`.
