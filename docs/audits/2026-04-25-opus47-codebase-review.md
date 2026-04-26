# Opus 4.7 codebase review — 2026-04-25

**Author:** Claude Opus 4.7 (Cowork mode)
**Trigger:** Grace requested a "review the entire codebase, where are the gaps and what's preventing Suppr from being best-in-class / competition-beating" audit ahead of soft TestFlight launch.
**Method:** Six parallel exploration agents (architecture, nutrition core, tests/CI, UX/parity, production readiness, docs/brand) followed by an eighth verification agent that ground-truthed the most consequential claims against actual file contents and line numbers.
**Predecessor:** Builds on `docs/audits/2026-04-24-full-sweep.md` and `docs/decisions/2026-04-24-full-sweep-ship-verdict.md`. This review verifies what the team shipped in the last 24 hours (T6, T7, T12, T13, T15, T19–T24, F-71–F-79) and surfaces what those agents missed.
**Status:** Active.

---

## TL;DR

You are roughly **75% of the way** between "real product" and "best-in-class". The 2026-04-24 verdict was a HOLD; you have closed at least 12 of the 20 blockers in the last 24 hours, which is exceptional pace. But the things still open are not "polish" — they are **the exact features you market on**. Specifically:

1. **You ship density-aware staples in the food DB but `totalGramsForVerifyScale` still treats 1 ml as 1 g.** Olive oil under-scales kcal by ~9%, honey over-scales by ~42%. The bug is pinned by a deliberately-failing test (`it.fails(...)`), so CI doesn't break — but it is live in production. This single bug undoes Pillar 2 of the best-in-class plan.
2. **`coerceMacrosWhenCaloriesButNoGrams` synthesizes a 28/42/30 P/C/F split** when calories are known but grams aren't. The coerce helper now flags `isCoerced: true`, **but no journal-write path checks the flag.** The infrastructure to be honest exists; it isn't wired. This is the same class of "fabricated nutrition reaches `nutrition_entries`" violation the 2026-04-24 audit flagged as a non-negotiable.
3. **`profiles` column-level lockdown only covers `user_tier` and `stripe_customer_id`.** `subscription_status`, `trial_started_at`, `trial_ends_at`, `trial_days_given` are still client-writable through `profiles_update_own`. Anyone with the anon key can hand themselves a permanent trial.
4. **`generateSmartPlan` is still on the UI thread** with a 20 000-combo sampler. `InteractionManager.runAfterInteractions` is imported in `apps/mobile/app/(tabs)/planner.tsx:13` but never wraps the call. The 6–11 second freeze the prior audit flagged is still live.
5. **`/api/household/join` rate-limit is IP-only.** A botnet or an IP-rotating attacker can exhaust the bucket and lock out legitimate joiners, or rotate past it entirely.
6. **Schema drift repair migration `20260503101000_schema_drift_repair.sql` is staged but unapplied.** Until it lands, `barcode_mappings`, `author_follows`, `recipe_plan_add_events`, the public `*_count` RPCs and `notify_followers_on_recipe_publish` are missing on prod, and `recipe_ingredients.is_verified` defaults to `true` (silent verification of unverified rows).

Against MyFitnessPal / Cronometer / Lifesum / LoseIt you have **three real moats already in code** (Atwater plausibility gate, macro-split confidence, source-aware vocabulary). Those moats are the ones the bugs above invalidate. **Fix the six items in §2 before any cohort expansion and Suppr's nutrition-honesty story becomes defensible — and unique — at launch.** Skip them and you are competing on a feature wall, where MFP wins.

What follows: verified state of the prior audit's Phase 1/2 closures, then the new gaps surfaced in this review, then the competitive read, then a prioritized punch list.

---

## 1. What the team shipped since 2026-04-24 (verified)

The git log shows aggressive blocker closure. Spot-checking the actual code:

| Phase 1/2 item | Commit | Verified state |
|---|---|---|
| **T2** profiles tier-write lockdown | `20260503100000_profiles_tier_column_lockdown.sql` | **Partial.** Trigger guards `user_tier` and `stripe_customer_id` but **not** `subscription_status` / `trial_*`. See §2.3. |
| **T6** RevenueCat webhook | `dbdbe27` `app/api/revenuecat/webhook/route.ts` | **Shipped, hardened.** Constant-time signature compare, idempotent dedup via `revenuecat_events` PK on `event_id`, service-role tier writes, handles INITIAL_PURCHASE / RENEWAL / CANCELLATION / EXPIRATION / PRODUCT_CHANGE / BILLING_ISSUE. The remaining work is ops (RC dashboard URL + secret in Vercel env). |
| **T7** meal_plans calendar anchor | `9e3b64a` + `meal_plan_days_start_date` migration | **Shipped.** Persisted anchor; `findPlanDayIdForCalendarDate` reads it. Tests rewritten — `tests/unit/planCalendarAnchor.test.ts` no longer pins the first-match-offset bug. |
| **T12** allergen surfacing v0 | `5fdccd3` + `recipes_allergens` migration | **Shipped.** Closes DI-P0-01. |
| **T13** weight surface mode | `6fec8ac` + `profiles_weight_surface_mode` migration | **Shipped.** Closes DI-P0-03. Three-value enum (show / hide / trends_only) honoured by Digest + Progress on both platforms. |
| **T15** atomic save_meal_plan RPC | `8a285aa` + `save_meal_plan_rpc` migration | **Shipped.** Replaces 15-RTT chain with one RPC. |
| **T19** FatSecret Basic-tier compliance | `072cb31` + `fatsecret_basic_tier_zeroing` migration | **Shipped at code level.** `fatsecretCacheGuard.ts` scrubs at ingest; data cleanup migration is staged but **not yet applied** (see §1.1). Licence page text still claims commercial licence — needs sweep. |
| **T20** household write-path hardening | `b42ae43` + `household_write_path_hardening` migration | **Shipped.** UPDATE WITH CHECK on `household_meals`; RPC checks `disbanded_at IS NULL` and `invite_code_expires_at > now()`. |
| **T21** web_push_subscriptions atomic claim | `e1eb672` + `claim_web_push_subscription` migration | **Shipped.** SECURITY DEFINER RPC atomically deletes stale endpoint and inserts for caller. |
| **T22** paywall dark-pattern audit | `b40662d` | **Shipped.** Mobile + web both emit `paywall_dismissed`; mobile `paywall_viewed` deduped by tier within mount; documented in `docs/decisions/2026-04-25-paywall-dark-pattern-audit.md`. PASS for App Store on items A–D, F–H. |
| **T23** Stripe webhook persisted dedup | `7527bfa` | **Shipped.** `stripe_webhook_events` table; INSERT-then-process pattern survives cold starts. |
| **T24** upgrade-dialog annual toggle + CMA disclosure | `38a1a47` | **Shipped.** Dialog renewal copy now matches mobile shape, pinned visible above CTAs. |
| **F-71/F-73** coerce unexplained calories + 1×-first scaler | `8ce2766` | **Shipped at planner level.** But coercion still reaches journal writes — see §2.2. |
| **F-77** OFF Atwater plausibility gate | `edf9cb5` | **Shipped.** This is one of your real moats. |
| **F-78** barcode hardening | `edf9cb5` | **Shipped.** |
| **F-79** OFF micronutrient set on logged entries | `28fade0` + `a4f3643` | **Shipped.** Web wiring complete. |
| **Branding rename** ("Suppr Club" → "Suppr") | (no single commit) | **Shipped at code level.** Grep for "Suppr Club" across `app/`, `src/app/`, `apps/mobile/app/` returns **zero user-facing matches** (case-insensitive). T18 PR effectively landed. Remaining: licence page copy referencing FatSecret commercial licence (T19 follow-up). |

That is a real shipping pace. The next sections are about what is still wrong and what was not on the prior audit's radar.

### 1.1 Schema-drift repair is staged, not applied

`supabase/migrations/20260503101000_schema_drift_repair.sql` exists and contains:

- `CREATE TABLE foods, food_sources, barcode_mappings, food_reports` (lines 31–78).
- `CREATE TABLE author_follows, recipe_plan_add_events` (lines 116–135).
- `CREATE FUNCTION public_recipe_save_count, public_creator_follower_count, public_author_follower_count` (lines 157–168).
- `CREATE FUNCTION notify_followers_on_recipe_publish` with `is_verified` gate (lines 208–228).
- `ALTER TABLE recipe_ingredients ALTER COLUMN is_verified SET DEFAULT false` (line 28).

Until this is pushed via `supabase db push --linked` (not MCP — see CLAUDE.md), **production is missing**:

- The `barcode_mappings` table → `app/api/barcode-mapping/route.ts` returns 500.
- The `author_follows` table → "Follow author" on recipe detail fails.
- The `recipe_plan_add_events` table → "planned meal" analytics dropped.
- The public `*_count` RPCs → save / follower counts always zero or stale.
- The `recipe_ingredients.is_verified` default of `true` silently flags service-role inserts as verified (the audit's "Tier 0 silent corruption").

The web client and mobile client both type-check against `database.types.ts` which assumes these objects exist, so neither platform catches the absence at compile time. **Apply this migration before any external user touches the app.**

---

## 2. The six remaining blockers, verified against source

### 2.1 `totalGramsForVerifyScale` treats ml as g (live in production)

**File:** `src/lib/nutrition/totalGramsForVerifyScale.ts:19–25`. The `treatAmountAsGrams` branch returns true for both `"g"` and `"ml"`. Comment on line 5–9 acknowledges the inaccuracy.
**Test:** `tests/unit/totalGramsForVerifyScale.test.ts:65,74` use `it.fails(...)`. CI passes; bug is live.
**Impact:** When a user scales an oil-heavy or honey-heavy recipe on the verify screen, the kcal estimate is off by ±10–40%. This contradicts the best-in-class Pillar 2 ("Never imply precision you don't have") more visibly than any other current bug, because the user sees a precise number that is wrong by inspection.
**Fix:** Add a density lookup that pulls `gPerMl` from the same staple table `estimateIngredientMacros.ts` already uses (olive oil 0.92, flour 0.53, etc.). Remove the `it.fails(...)` markers when the assertion flips. Effort: ~half a day.

### 2.2 `coerceMacrosWhenCaloriesButNoGrams` is unenforced at journal writes

**File:** `src/lib/nutrition/coerceRecipeMacrosForPlanning.ts`. The function returns `{ p, c, f, kcal, isCoerced: true }` when it synthesizes a 28/42/30 split. A `wouldCoerceMacros` cheap-check helper exists at lines 71–85.
**Gap:** Greps for `wouldCoerceMacros` and `isCoerced` across `src/`, `app/`, and `apps/mobile/` find **no consumer** at any nutrition-entry write site. The flag is computed and discarded.
**Impact:** A planner row with synthesized macros can be logged directly to `nutrition_entries` on either platform. The user's daily totals include fabricated protein/carb/fat. This is the exact non-negotiable violation the 2026-04-24 verdict centred on; the fix shipped half-way.
**Fix:** Add a guard at every `nutrition_entries` insert (web + mobile) that calls `wouldCoerceMacros(input)` and either rejects (preferred for the journal) or persists a flag on the row so the UI can render "estimated" with a confidence chip. Effort: 1 day with parity tests.

### 2.3 `profiles` column-level lockdown is incomplete

**File:** `supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql`. Trigger guards `user_tier` (line 66) and `stripe_customer_id` (line 75).
**Gap:** `subscription_status`, `trial_started_at`, `trial_ends_at`, `trial_days_given` remain client-writable via `profiles_update_own`.
**Impact:** Any authenticated user can give themselves a never-ending trial by writing `trial_ends_at = '2099-12-31'`. RevenueCat / Stripe webhook reconciliation will eventually overwrite, but the damage window is real, especially if the user pairs it with `subscription_status = 'trialing'`. The security review for App Store submission will flag this.
**Fix:** Extend the trigger to cover the four trial columns (and `subscription_status`). Effort: ~1 hour SQL + test.

### 2.4 `generateSmartPlan` still freezes the UI thread

**File:** `apps/mobile/app/(tabs)/planner.tsx:13` imports `InteractionManager`; line 42 imports `generateSmartPlan`. There is **no** `InteractionManager.runAfterInteractions(...)` wrap at the call site. The sampler at `src/lib/nutrition/mealPlanAlgo.ts:498` still uses `Math.min(20_000, …)` — no stratified reduction to 2 k.
**Impact:** Generating a plan from a 30+ meal pool freezes the JS thread for 6–11 seconds on iPhone 12 / Android equivalents. Users will perceive a hang and force-quit. This is the most-felt-by-users perf bug in the app.
**Fix:** Wrap the dispatch in `InteractionManager.runAfterInteractions`, render an inline progress state, and reduce the sampler to a stratified 2 k. The 2 k reduction needs a quick eyeball that meal variety stays acceptable (the prior audit suggested ~5 % delta on objective). Effort: 1 day with a benchmark.

### 2.5 `/api/household/join` rate-limit is IP-scoped, not user+IP

**File:** `app/api/household/join/route.ts:21` — `keyPrefix: "household_join"`. **File:** `src/lib/server/rateLimit.ts:112` — `key = ${opts.keyPrefix}:${ip}`.
**Impact:** Two failure modes: (a) a single IP can starve all legitimate joiners; (b) an IP-rotating attacker can bypass the 5/min cap entirely. Neither is catastrophic, but household joins are a known abuse vector (invite-code enumeration).
**Fix:** Compose the key as `household_join:${userId ?? "anon"}:${ip}` once `getUserIdFromRequest(req)` runs (line 29). For unauthenticated requests, fall back to IP-only. Apply the same scoping to `/api/nutrition/photo-log`, `/api/nutrition/voice-log`, `/api/usda/search`, `/api/stripe/checkout` — none of which currently rate-limit. Effort: 2–3 hours including tests.

### 2.6 Schema-drift repair migration unapplied (covered in §1.1)

---

## 3. New gaps the 2026-04-24 audit didn't surface

These were not in the prior verdict. They are not all P0, but they are all material.

### 3.1 Confidence threshold inconsistency (`0.42–0.50` silent acceptance)

**Files:** `src/lib/nutrition/verifyConfidencePolicy.ts` (`INGREDIENT_VERIFY_REVIEW_AVG_THRESHOLD = 0.45`) vs `src/lib/nutrition/verifyIngredients.ts` (`RECIPE_INGREDIENT_REVIEW_CONFIDENCE = 0.5`).
**Issue:** A recipe with all lines at 0.42–0.50 confidence triggers no review nudge at the recipe level but *would* at the ingredient level. The mobile log UI uses neither consistently; some entries auto-accept silently. This contradicts CLAUDE.md "if nutrition is uncertain, do not guess".
**Fix:** Pick one threshold (suggest 0.55), surface it from a single constants module, and route all UI gates through it. Tests should pin the threshold.

### 3.2 Web ↔ mobile planner algorithm divergence

**Files:** `src/lib/nutrition/mealPlanAlgo.ts` (mobile uses `calorieBandPct: 5`, recency penalty `+100`, asymmetric portion penalty `*3/*1.5`) vs `src/lib/planning/generateMealPlan.ts` (web uses `calorieBandPct: 12`, recency `+40`, flat portion `*2`).
**Issue:** Same user, same saved recipes, same targets → web and mobile produce different plans. This is silent because both plans are "fine" individually, but it directly violates the CLAUDE.md non-negotiable: "Web and mobile must stay in sync at all times." The prior audit flagged it as C8.
**Fix:** Pick one algorithm. Migrate the other platform to import it. Add a parity test that asserts identical plans for a fixture profile + fixture recipe set. Effort: ~half a day if you choose to keep `mealPlanAlgo.ts` and have web wrap it.

### 3.3 Supabase client version mismatch (web 2.56.0 vs mobile 2.102.1)

**Files:** root `package.json` vs `apps/mobile/package.json`.
**Issue:** ~2 months and dozens of release notes between the two pins. Realtime subscription auth, edge function invocation signatures, and `select` query type inference have all changed in that window. Both platforms type-check independently, so any latent breakage surfaces only at runtime in one platform.
**Fix:** Bump web to match mobile, regression-test auth + RLS + realtime + storage. Effort: 1 day.

### 3.4 Web e2e and migration drift checks not in CI

**File:** `.github/workflows/ci.yml`. `npm run test:e2e` (Playwright) is wired but not invoked in CI; `npm run check:migrations` is local-only; mobile Maestro flows are manifest-checked, not executed.
**Impact:** Regressions in core flows (auth, paywall, journal log, weekly recap) only surface on Vercel preview, where Grace catches them by hand. With cohort expansion that scales poorly.
**Fix:** Add a `e2e` job to the workflow gated to PRs and `main`; add `check:migrations -- --strict` to the same job; document Maestro device runs as a release-prep step (full CI emulator runs are expensive and probably not worth it pre-launch).

### 3.5 No optimistic update on mobile journal writes

**File:** `apps/mobile/app/(tabs)/index.tsx`. The Tracker tab inserts via `supabase.from('nutrition_journal').insert()` and waits for the round-trip. There is no local optimistic update and no offline buffer.
**Impact:** On a flaky cell connection a user logs food, sees nothing, taps again, and double-logs. Or they log offline, see nothing, and lose the entry. The web `AppDataContext` *does* optimistically update.
**Fix:** Mirror the web pattern: optimistic `byDay` insert with a pending flag, retry queue, error toast on terminal failure, reconciliation on reconnect. Effort: 1–2 days.

### 3.6 Mobile Tracker is a single 1400-line component

**File:** `apps/mobile/app/(tabs)/index.tsx`. Holds `byDay`, `selectedDate`, `profileTargets`, copy-meal logic, rendering, scroll handling, all inline. No shared state context (the web `AppDataContext` is mobile's missing twin).
**Impact:** Future refactors are expensive; tab-switching invalidates state caches because nothing is hoisted; multi-tab consistency hazards. Not a launch blocker but a v1.1 ceiling.

### 3.7 Mobile observability incomplete

**File:** `.env.example:86` exposes `EXPO_PUBLIC_SENTRY_DSN`. Beyond DSN configuration, there's no mobile Sentry integration file in the audit scope (no `apps/mobile/lib/sentry.ts`, no Sentry init in `apps/mobile/app/_layout.tsx`). PostHog mobile event coverage is unverified.
**Impact:** When a TestFlight tester crashes, you may not see the stack. When someone churns at the paywall, the funnel is invisible.
**Fix:** Wire `@sentry/react-native` (or `sentry-expo` per Expo SDK), confirm `onboarding_completed`, `paywall_viewed`, `paywall_dismissed`, `journal_logged`, `meal_plan_generated` are all firing on mobile.

### 3.8 Two missing critical decision docs

The decisions log is excellent (40+ recent entries) but five Phase 2 architecture decisions ship without companion docs:

1. **RevenueCat webhook architecture** — direct tier-write vs append-only events table + reducer. T6 shipped; the why-this-shape isn't recorded.
2. **`meal_plans` schema fix shape** — `meal_plan_days.start_date` chosen over a parent `meal_plans` table; rationale not captured.
3. **Allergen populate strategy** — confident-matches-only vs user-input vs both.
4. **`profiles.weight_surface_mode` enum values** — why three values, not two; UX expectation captured separately?
5. **Onboarding v2 mobile architecture** — `apps/mobile/app/onboarding-v2.tsx` exists and is functional, but there's no decision doc for the auth/HealthKit/import sequence.

Adding these takes ~2 hours total and matters more than it sounds, because in six months your future self (or a hire) will read the migration without knowing which alternative was rejected.

### 3.9 No written launch checklist

`scripts/prelaunch-checklist.ts` automates parts of this, but there is no `docs/launch/checklist.md` covering pre-deploy code readiness, smoke tests, analytics setup, legal/entity finalization, App Store listing assets, and post-deploy monitoring ramp. The Phase 1/2/3 verdict is the closest analogue but is decision-log shaped, not checklist-shaped.

### 3.10 Legal entity placeholders block legal-page finalization

`app/privacy/page.tsx` carries three `[PLACEHOLDER — pending incorporation]` strings (data controller, UK rep, EU rep). `docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md` is open. Until that decision lands, privacy / terms / DMCA cannot be finalized — and **DMCA-1 (designated-agent registration) is a Phase 1 hard deadline** per TODO.md.

---

## 4. Architecture posture

### 4.1 The `app/` vs `src/app/` split

Two parallel hierarchies: `app/` holds Next.js routes + API; `src/app/` holds component buckets (`suppr/`, `ui/`, `onboarding-v2/`). The split appears to be a half-finished refactor. Routes import from the component bucket via the `@/*` alias to `src/*`. It works, but the cognitive overhead is real and onboarding any non-Grace developer will feel it. Either consolidate or document the split with a CONTRIBUTING.md rule. Not urgent.

### 4.2 Nutrition logic duplication

`src/lib/nutrition/` has ~80 files. Some are re-exported by mobile (`apps/mobile/lib/mealPlanAlgo.ts` re-exports from `src/lib/nutrition/mealPlanAlgo.ts`). Others have divergent mobile copies. The audit found:

- `apps/mobile/lib/verifyRecipe.ts` is ~1100 lines orchestrating multi-source nutrition matching, scaling, conflict resolution. Procedural choreography, no abstraction. Splitting into `verifyIngredients` / `resolveNutritionConflict` / `scaleAndFallback` would halve its surface area.
- `apps/mobile/lib/calcTargets.ts` mirrors `src/lib/nutrition/tdee.ts`; verified functionally identical via parity test, but two sources of truth.
- Planner algo divergence (§3.2) is the worst case.

The right fix is a shared `packages/nutrition` workspace package, but that is a v1.1 refactor — for launch, *unify the planner algo only*.

### 4.3 Supabase migrations cleanliness

91 migrations. The most recent batch is dated `2026-05-03` (eight days in the future from today). Per CLAUDE.md this is deliberate (monotonic ordering). The drift-repair migration (`20260503101000_schema_drift_repair.sql`) is well-written: idempotent, well-commented, reasoned. The schema is in better shape than the ops state — apply it.

---

## 5. Test posture

- **125+ web unit, ~46 mobile unit, ~5 integration, 7 Playwright e2e specs, 27 mobile Maestro flows.** Ratio is roughly 90/5/5 unit/integration/e2e.
- **Pin-the-bug tests cleaned up.** `planCalendarAnchor.test.ts` is rewritten to assert correct behaviour; `totalGramsForVerifyScale.test.ts` uses `it.fails(...)` to flag the bug as deliberately-failing pending fix. No further pinned-bug tests found.
- **Determinism is strong.** No `new Date()` in test files; `vi.useFakeTimers()` + `dateKeyInPreviousWeek` helpers used correctly; meal-plan algo tests use `seed: 0`.
- **Webhook tests are mocked.** Stripe and RevenueCat webhook handlers have unit tests that mock the Supabase client; no live replay test confirms idempotency end-to-end. Worth adding a manual prelaunch step in `prelaunch:checklist`.

The CI gap (no e2e in workflow, no migration drift gate) is real. The test bench itself is good.

---

## 6. Competitive positioning

Pulled from `docs/best-in-class-plan.md`, `docs/competitive-principles.md`, `docs/competitor-intelligence-report.md`, `docs/competitor_feature_catalog_scout.md`, `docs/competitor_feature_catalog_sentiment.md`, plus current code state.

### 6.1 Where Suppr genuinely beats MFP / Cronometer / Lifesum / LoseIt today

1. **Atwater plausibility gate at ingestion.** `src/lib/nutrition/macroPlausibility.ts` rejects implausible kcal/macro mismatches before search results render. MFP and LoseIt show OFF junk rows ("40 kcal from 3 g protein") as-is. Cronometer is closer but still doesn't gate at the search layer. Code evidence: `checkMacroPlausibility` called at every OFF / FatSecret / Edamam fetch point in `verifyIngredients.ts`.
2. **Macro-split confidence rendering.** `src/lib/nutrition/macroSplitConfidence.ts` flags `state: "single_macro"` when only fat is reported and surfaces "Only fat reported — protein and carbs not published" instead of a misleading 100 %-of-one-macro pie chart. None of the four big competitors does this; the chili-crisp / hot-sauce class of items show "100 % fat" misleadingly across all of them.
3. **Source-aware vocabulary.** `VerifiedIngredient.source` carries USDA / OFF / Edamam / FatSecret / community / manual through to UI badges. MFP collapses everything into a generic "verified" tick that conflates user-submitted entries with USDA-verified ones.

These three are the moat. They are real, in code, today. The bugs in §2.1 and §2.2 are the only things stopping you from saying so on the App Store listing.

### 6.2 Where the implementation under-delivers vs. the stated bar

- **"Density-aware staples"** — the staple table in `estimateIngredientMacros.ts` does carry `gPerMl`, but `totalGramsForVerifyScale.ts` ignores it (§2.1).
- **"Cook → log loop"** — Cook mode exists but the cook-mode → log-this-meal affordance is missing on mobile. `RecipeDetail` → "Add to journal" is partial.
- **"Macro-aware plan from saved recipes"** — exists, but web and mobile produce different plans for the same input (§3.2).
- **"URL + social import both required"** — URL import wired; no screenshot / Instagram / TikTok DM import path.
- **Power features** — meal-plan named slots exist with shared CRUD helpers but the mobile UI has no slot switcher; web does.

### 6.3 Where competitors do something Suppr doesn't (yet)

Not all of these are P0 for soft launch, but they're the things a determined reviewer or power user will ask about.

- **Cronometer:** deeper micronutrient tracking (you ship F-79 OFF micros — close the gap with USDA-only micros for verified rows), supplement ingestion path, integrations with Withings / Garmin / Eight Sleep beyond Apple Health.
- **MyFitnessPal:** sheer breadth of barcode database (you'll never match this; differentiate on accuracy, not coverage), social / community features, recipe importer (you have URL; they have ~everything).
- **Lifesum:** pre-curated meal plans by goal+diet (you have plan generation; they ship "3-day reset" / "high-protein week" templates).
- **LoseIt:** Snap goal achievement gamification, family / sharing primitives more polished than household v0.
- **Carb Manager:** keto / fiber / net carbs as a first-class lens (you don't currently differentiate net carbs; if you market keto support this is table stakes).
- **All of them:** smart-scale integrations, Apple Watch complications, widget polish, Siri / Shortcuts depth (you have shortcut deep-links — make sure they cover food log + water + weight).

The right competitive bet given your code is **double down on nutrition honesty and density accuracy** rather than chasing breadth. MFP wins on data volume; you win on data integrity. The §2 fixes are exactly the table stakes for that bet.

---

## 7. Prioritized punch list

### P0 — must close before any cohort expansion (this week)

1. Apply `20260503101000_schema_drift_repair.sql` via `supabase db push --linked`. Regenerate `database.types.ts`. (§1.1)
2. Add density lookup to `totalGramsForVerifyScale.ts`; flip `it.fails(...)` to `it(...)`. (§2.1)
3. Wire `wouldCoerceMacros` (or the `isCoerced` flag) into every `nutrition_entries` insert path on web and mobile. Decide: reject, or persist with a confidence chip. (§2.2)
4. Extend the `profiles` column-lockdown trigger to cover `subscription_status`, `trial_started_at`, `trial_ends_at`, `trial_days_given`. (§2.3)
5. Wrap `generateSmartPlan` dispatch in `InteractionManager.runAfterInteractions`; reduce sampler from 20 k → 2 k stratified. (§2.4)
6. Scope `/api/household/join` rate-limit key to `userId:ip` not `ip`. Add rate limits to `/api/nutrition/photo-log`, `/api/nutrition/voice-log`, `/api/usda/search`, `/api/stripe/checkout`. (§2.5)
7. Run RevenueCat webhook ops setup (RC dashboard URL + secret in Vercel env). Confirm by sending the test event.

### P1 — close before public launch (next 2 weeks)

8. Unify confidence thresholds; pick one constant; route all gates through it. (§3.1)
9. Pick one meal-plan algorithm; migrate the other platform to import it; add parity test. (§3.2)
10. Bump web `@supabase/supabase-js` to match mobile (`2.102.1`). Regression-test. (§3.3)
11. Add Playwright e2e job + `check:migrations --strict` to CI workflow. (§3.4)
12. Optimistic mobile journal writes + offline buffer + reconnection reconciliation. (§3.5)
13. Wire `@sentry/react-native` in `apps/mobile/app/_layout.tsx`. Verify mobile PostHog event coverage. (§3.7)
14. Wire RevenueCat live replay test into `prelaunch:checklist`.
15. Resolve incorporation jurisdiction → fill privacy / terms / DMCA placeholders → register DMCA designated agent. (§3.10)
16. Write `docs/launch/checklist.md` and `docs/launch/app-store-listing.md`. (§3.9, §6 of docs audit)
17. Backfill the five missing decision docs (RC webhook arch, meal_plans schema, allergens, weight surface, onboarding v2). (§3.8)
18. Sweep the licence page for FatSecret commercial-licence wording → Basic-tier compliant copy.

### P2 — v1.1 hygiene (post-launch)

19. Refactor `apps/mobile/app/(tabs)/index.tsx` into `TrackerProvider` + leaf components; share state via context. (§3.6)
20. Refactor `apps/mobile/lib/verifyRecipe.ts` into `verifyIngredients` / `resolveNutritionConflict` / `scaleAndFallback`. (§4.2)
21. Decide on `app/` vs `src/app/` split; document or consolidate. (§4.1)
22. Mobile library: add kind filter (saved/created/imported) for parity. (UX agent §6 #4)
23. Mobile planner: add named-slot switcher UI. (UX agent §6 #5)
24. Cook mode → log-this-meal affordance.
25. Screenshot / Instagram / TikTok recipe import path.
26. Net-carbs lens for keto users.
27. Apple Watch complication, smarter widget surface.

---

## 8. The honest competitive verdict

You are closer to best-in-class than most pre-launch products. The reason you are *not yet there* is not feature breadth — it's that two specific bugs (§2.1 ml=g and §2.2 unenforced coercion) silently invalidate the exact differentiator you are marketing on. Fix those two and the FAQ-ready story becomes:

> "Every other tracker shows you precise numbers it can't actually produce. Suppr only shows you a number when it can actually compute it; when it can't, it tells you so. We use USDA and Open Food Facts as our spine, gate every entry through an Atwater plausibility check, and refuse to fabricate macros from kcal alone."

That pitch is unfalsifiable in code today — once §2.1 and §2.2 land. Without them, a curious reviewer can break the claim with one olive-oil scan and one `nutrition_entries` insert.

The path to launch is short. The path to defensible-best-in-class is the same six items in §2 plus the four P1 items most directly tied to the nutrition-honesty story (confidence threshold unification, planner algo unification, mobile observability, journal optimism). Everything else is post-launch v1.1.

---

## Related artefacts

- Audit predecessor: [`docs/audits/2026-04-24-full-sweep.md`](./2026-04-24-full-sweep.md)
- Ship verdict: [`docs/decisions/2026-04-24-full-sweep-ship-verdict.md`](../decisions/2026-04-24-full-sweep-ship-verdict.md)
- Best-in-class plan: [`docs/best-in-class-plan.md`](../best-in-class-plan.md)
- Competitive principles: [`docs/competitive-principles.md`](../competitive-principles.md)
- Schema drift audit: [`docs/audits/2026-04-25-schema-drift.md`](./2026-04-25-schema-drift.md)
- Paywall dark-pattern audit: [`docs/decisions/2026-04-25-paywall-dark-pattern-audit.md`](../decisions/2026-04-25-paywall-dark-pattern-audit.md)

## Revisit when

- Items 1–7 (P0) shipped → re-run nutrition-engine + security-reviewer → cohort expansion gate.
- Items 8–18 (P1) shipped → re-run full sweep → public launch gate.
- Any change to `coerceMacrosWhenCaloriesButNoGrams`, `totalGramsForVerifyScale`, the planner algorithm, or the `profiles` lockdown trigger.
