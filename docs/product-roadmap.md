# Product roadmap — Suppr (recipe + macro platform)

This document extends the MVP hardening work with **nutrition depth**, **activity-adjusted targets**, and **social discovery**. It is the north-star for prioritization; implementation order should follow dependencies below.

**Last reviewed:** 2026-04-18. This is a living doc — update phases as beta feedback arrives.

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
| A | Macro-native meal planning | **Mostly shipped** (fiber, water, caffeine/alcohol, dietary prefs, custom foods, saved combos, copy/duplicate, favourites, leftovers, plan templates) |
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
- **Custom foods** (Batch 3.9). Homemade / local-only foods with any number of named serving shortcuts (`1 bowl = 80g`). Shared `scaleMacrosForGrams`. Owner-only RLS on `user_custom_foods`.
- **Saved meal combos** (Batch 2.6). 2+ logged items saved as a named bundle, re-logged in one tap from the "My meals" tab. Parent `user_saved_meals` + child `user_saved_meal_items`.
- **Favourites / Frequent / Recent Quick Add** (Batch 1.3). Tabbed picker; star any meal to one-tap re-log. "Eat again" clock-aware banner. `user_favorite_foods` with unique key on `user_id + lower(title) + round(cal)`.
- **Copy meal / Duplicate day** (Batch 1.4). Per-meal and per-day copy to single day or inclusive range. Shared `copyMeals.ts`.
- **Add ingredient + per-ingredient overrides** (Batch 2.7). Add a missed ingredient post-import or pin manual "label values" on one row without losing the match. `recipe_ingredients.override_macros` + `added_by_user`.
- **Drag-drop meals between days, save-plan-as-template, leftovers-aware planning** (Batch 3.10). `user_plan_templates`; `meal_plan_meals.is_leftover` + `leftover_of_recipe_id`; auto-distribution of multi-serving recipes into matching next-day slots.
- **Adaptive TDEE** (Phase B shipped into A's loop). `computeAdaptiveTDEE` persists `profiles.adaptive_*` when confidence clears medium/high; 6 h throttle; runs after every journal insert/delete on web and every `nutrition_entries` upsert on mobile.

### Still to build

- **Allergen / ingredient-level filtering** — ingredient-level gluten detection for coeliac-strict, peanut/tree-nut splits, sesame, shellfish, etc. Current dietary prefs are profile-level flags; recipes tag themselves, but we don't yet inspect the parsed ingredients to catch hidden conflicts.
- **Hard-filter vs soft-warn policy** — confirm product call for each restriction (see Open decisions below).
- **Recipe label confidence** — surface *why* a recipe is labelled gluten-free (author tag vs derived).

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
- **iOS widget snapshot + Siri Shortcut deep links** (Batch 5.12). `suppr://log/water?ml=N`, `suppr://fast/start?hours=N`, `suppr://today/remaining`. WHATWG URL parsing; single-slot 5-min TTL pending queue; VoiceOver announcements. Native widget extension deferred.
- **Voice logging + AI photo logging (Pro, Batch 5.13).** Press-and-hold mic on Today → transcript → `/api/nutrition/voice-log` → verified-macro review list with confidence badges + "AI estimate" badges → commit. Snap chip → camera/library picker → `/api/nutrition/photo-log` (GPT-4o vision) → same review flow. Low-confidence (<0.5) items flagged with `role="alert"` and can only be committed via explicit "Log anyway". Pro-gated: free + Base tiers see a factual paywall dialog, no countdowns. Analytics: `voice_log_started/_committed/_paywalled`, `ai_photo_log_started/_committed/_paywalled`. Shared helper `src/lib/nutrition/aiLogging.ts` owns sanitisation + classification + totals across web and mobile. 37 new unit tests cover the helper.
- **CSV export** — shared `exportNutritionCsv.ts` (web) + `apps/mobile/lib/exportCsv.ts` (mobile). One row per logged meal per day: date, meal, food, kcal, protein, carbs, fat, fiber, source, time.

### Still to build

- **Weekly fiber + hydration adherence** rollups in Progress (parallel to protein adherence in weekly recap).
- **Per-meal breakdown export** — current CSV is per-logged-row; Lose-It-style per-slot rollup export is a future-cut.
- **Native iOS Home / Lock-screen widget extension** consuming `WidgetSnapshot`.
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
2. **Close out Phase C rollups** — weekly fiber + hydration adherence; native iOS widget extension + Siri donation.
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
