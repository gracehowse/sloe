# Suppr → Sloe Redesign Rollout Plan

**Status: PLANNING — all outstanding inputs CLOSED (2026-06-03). Implementation begins on Grace's approval of this plan (§8).**
Author: Claude · Date: 2026-06-03 · Audit basis: two code-grounded sweeps (full screen/route inventory + non-visual preservation inventory), both verified against source, not docs.

This is the single source of truth for taking the Sloe redesign from Figma into the real dev codebase **incrementally and safely**. It supersedes ad-hoc redesign work. Do not start implementation (including the design foundation) until §7 is resolved with Grace.

---

## 1. Operating principles (non-negotiable, per Grace 2026-06-03)

1. **One thing at a time.** One page / feature / card / chart / component per change. Never redesign multiple major sections at once. Never auto-continue to the next feature — **stop for review after each**.
2. **No feature flags, no hidden rollouts, no duplicate experiences.** The redesign goes **directly into the dev environment** where Grace tests it (dev + simulator). No `isFeatureEnabled` gating of the redesign, no parallel "v2" path. *(This explicitly overrides the CLAUDE.md "visual changes ship behind a flag" rule for the redesign — confirmed by Grace 2026-06-03. It also matches reality: `EXPO_PUBLIC_FLAG_FORCE` is dead in bundles per ENG-840, so flag-gating couldn't be QA'd in the sim anyway.)*
   - **DO NOT COMMIT until Grace approves each change** (Grace 2026-06-03). Work lands in the working tree / dev environment only; it must not reach `main`/production until reviewed and approved. The review gate *is* the safety net that replaces flags.
3. **No invisible work.** No multi-hour refactors or redesigns no one can see. Prioritise small, visible, reviewable improvements.
4. **iOS first, web parity second** (project rule: iOS is the primary surface). For each feature: redesign mobile, verify, then bring web to parity in the same scope.
5. **Anchor every decision in Mobbin + a named best-in-class benchmark**, and keep validating against Mobbin *during* implementation, not just planning. Use **Stitch** for exploration/image-gen; document final screens/flows/components/states/specs in **Figma**. Every decision = rationale + benchmark + implementation path.
6. **Preserve everything.** A redesign re-skins UI; it must not drop a single feature, state, business rule, API call, or data dependency catalogued below.
7. **Per-feature dossier before touching code** (template in §5), and a **post-change summary** after (what changed / preserved / tested / risks / outstanding / single recommended next).

---

## 2. Architecture facts that govern the whole rollout

These came out of the audit and change *how* the redesign must be done:

- **The engine is shared and already centralised.** `apps/mobile/tsconfig.json` + `metro.config.js` alias `@suppr/shared/*` → `src/lib/*`. Nearly all maths (TDEE, macros, adaptive-TDEE, fit%, meal-plan algo, streak/freeze, weight trend, count-to-weight) lives **once** in `src/lib/` and is imported by both platforms, and is **parity-tested**. **A token-swap re-skin preserves the engine for free.** The risk is entirely in the screen files that wire data→logic→render.
- **Web is a single-page app, not per-route pages.** `app/(product)/*` route files render `null`; the shell mounts `src/app/App.tsx` once and switches "views" off `usePathname()` (`history.replaceState` for tabs, `?openLog=1`, `?recipe=` deep-links). **A web redesign edits the view components in `src/app/components/`, not route files.**
- **Everything is real data.** No mocked nutrition in production paths. Every surface reads Supabase / shared libs / real API routes. (Only dev harnesses + one flag-gated-OFF caption importer are non-real.)
- **Five megafiles concentrate the cost & risk** (all violate the 400-line rule, ENG-621): mobile Today `(tabs)/index.tsx` (6,318), mobile Plan `(tabs)/planner.tsx` (4,405), mobile Progress `(tabs)/progress.tsx` (4,006), mobile Recipe detail `recipe/[id].tsx` (3,428), web `NutritionTracker.tsx` (3,576). These are **not clean token swaps** — they tangle data-fetching + the calorie-ring 3-state mapping + tier gating + realtime + the journal-sync side-effect chain. Redesigning them means **extracting hooks/components (shrinking them), not regrowing them**.
- **Realtime exists on exactly two surfaces:** Shopping list + Notifications inbox. Everything else is fetch-on-focus. Don't break those two subscriptions.
- **Calorie ring — RESOLVED (Grace 2026-06-03): the Sloe prototype ring WINS** (it's a redesign). The live `CalorieRing.tsx` mapping (empty=calm-blue, under=green, over=red+overage arc, bonus=yellow) is **superseded** by the Sloe **plum multi-ring** (calories plum + protein-sage / carbs-clay / fat-amber concentric arcs). **Preserve the state legibility**, restyled in Sloe tokens: empty = tracks-only (calm), under-budget = plum calorie arc, over-budget = destructive-red calorie arc (Sloe `today-over`), dark = lilac calorie arc. The exercise-bonus signal must still be representable. This supersedes the locked `feedback_calorie_ring_colour_mapping` memory **for the redesign**.

---

## 3. Inventory to preserve (per redesign area)

Full detail in the two audit transcripts; condensed here. Every item below must survive the redesign.

> Legend: **M** = mobile route file · **W** = web view/component · **Engine** = shared `src/lib` logic · **API** = server dependency · **Data** = tables/realtime.

### (1) Home / Today Dashboard
- **M** `apps/mobile/app/(tabs)/index.tsx` (6,318) · **W** `src/app/components/NutritionTracker.tsx` (3,576) via `/today`,`/home`
- **Engine:** `northStarSuggestion`, `recipeFitPercent`, `activityBonus`, `mealBudget`, `dailyTargetSnapshot`, `todayProgressiveDisclosure`, `belowMealsPromptSelection`, `trackerStats` (streak), `CalorieRing` 3-state mapping, deficit = **burn−consumed** (`TodayDeficitInsight`, /days-logged not /7).
- **Data:** `profiles` (×17 fields), `nutrition_entries`, `meal_plan_days/meals`; `useNutritionEntriesSync` (600ms debounce → write → triggers adaptive-TDEE + daily-target-snapshot + HealthKit write); **feeds the iOS widget** (`widgetSnapshot.ts`). No realtime.
- **States:** loading/empty/error/over-budget/offline/locked. Quick-log, week strip, NorthStar "what to eat next", streak pip, fasting pill, complete-day + 30-day milestone dialogs.

### (2) Weight Tracking
- **M** `weight-tracker.tsx` (standalone) · **W** *no standalone route — lives inside `ProgressDashboard.tsx`* (decide web home — O-3)
- **Engine:** `weightTrend` (EMA, Trend/Scale toggle, confidence band, staleness), `weightProjection`, `weightSurfaceMode` enum, `weightWinMoment`, `weightTrendTile`. **7700 kcal/kg** via `weekDeficitToKg()` (single converter — don't reintroduce per-surface).
- **Data:** `profiles.weight_kg` + weight-log JSONB. States: loading/empty(<2 weigh-ins suppressed)/error/success.

### (3) Nutrition Tracking
- **M** `macro-detail.tsx`, `meal-nutrition.tsx`, `burn-detail.tsx` · **W** `MacroDetailPanel`, `BurnDetailPanel`, `full-nutrient-panel-sheet`
- **Engine:** `tdee.ts` (Mifflin-St Jeor, activity multipliers, pace presets, macro calc w/ protein g/kg by strategy, NHS safety floors), `calcTargets.resolveTargets` (precedence: explicit→computed→defaults), `measureToGrams`/`volumeToGrams`/`inferNaturalServing` (count-to-weight), `estimateIngredientMacros` + `macroPlausibility` (refuses low-confidence; `macrosAreEstimated` rows rejected from journal), `netCarbs` (opt-in), `dailyTargetSnapshot` (freezes history), micros/DV (`dailyValues`, `microNutrientDisplay`, `fullNutrientPanel`).

### (4) Food Logging
- **M** `FoodSearchModal`, `BarcodeScannerModal`, `VoiceLogSheet`, `PhotoLogSheet`, `(tabs)/search.tsx`, `(tabs)/barcode.tsx`, Log FAB · **W** `FoodSearch` + LogSheet (`?openLog=1`)
- **Engine:** `foodSearchCore`/`foodSearchRanking`/`searchRowTrust`, `aiLogging.classifyConfidence`, `photoLogQuota`, barcode confidence/correction/portion-memory, saved/usual meals, `nutritionJournal` (LOCAL-time day key), slot inference, source canonicalisation.
- **API:** USDA / FatSecret / Edamam / OFF (search+barcode); photo-log + voice-log (**Pro, server-enforced**, AI provider Claude→OpenAI, Upstash rate-limit fails-closed); scan-label OCR.

### (5) Analytics / Progress
- **M** `(tabs)/progress.tsx` (4,006), `progress-metric.tsx`, `weekly-recap.tsx` · **W** `ProgressDashboard.tsx`
- **Engine:** `adaptiveTdee` (EMA α=0.1, 28-day, tdee=avgIntake−ΔkgΧ7700, confidence gates), `getEffectiveTDEE` (adaptive only if medium/high & <14d stale), `maintenanceChain` (8-step ledger), `progressStoryGate` (3-day floor, no numerals before), `digest`/`digestStory`/`weeklyRecap`/`weeklyCheckin`/`goalPaceRetune`, **streak-freeze engine** (earn/consume/compact ledger), `milestone30Day`, win-moment.

### (6) AI Coach
- **NOT BUILT on either platform** (no `/ask` route). Spec only at `docs/ux/redesign/ai-coach.md`; classified **DEFERRED post-launch**. Underlying narrative engines exist and already feed Today/Progress. → **O-4: confirm scope before this slot in the sequence.**

### (7) Recipes (Library + Discover + Detail + Cook + Import + Create + Verify + Creator)
- **M** `(tabs)/library.tsx`, `(tabs)/discover.tsx`, `recipe/[id].tsx` (3,428), `cook.tsx`, `create-recipe.tsx` + `recipe/create.tsx` (wizard), `import-shared.tsx`, `cookbook-import.tsx`, `plan-import.tsx`, `recipe/verify.tsx`, `creator/[id].tsx` · **W** `Library`, `DiscoverFeed`, in-SPA `RecipeDetail` **AND** SSR `app/recipe/[id]/page.tsx` (**two web detail surfaces — both must be redesigned**, O-5), `CookMode`, `RecipeUpload` (create+import), `app/creator/[id]/page.tsx`.
- **Engine:** `recipeFitPercent`, `mealPlanAlgo` (parity-pinned constants — sampler cap 2000, recency penalty/reset, planner bands, portion clamp, asymmetric scoring — **do not touch**), `recipeScale`, 4-tier trust (`recipeTrust` + `verifyConfidencePolicy` + `verifyIngredients` accept floors 0.70/0.72), `glutenClassifier` (legal — disclaimer always visible), `inferAllergens` (14 EU FIC), cook session/timers/handsfree, **go-public now BOTH platforms** (parity test exists — memory "web-only" is stale).
- **API:** recipe-import (URL/Reel + caption + image, SSRF-guarded), cookbook-import, verify-recipe; **caption importer is flag-gated OFF in prod.**

### (8) Settings / Account
- **M** `(tabs)/settings.tsx` (+ `SettingsBundleContent`), `profile.tsx`, `targets.tsx`, `household-settings.tsx` (**Partial — grid is AsyncStorage-local; server holds only `share_lunch`**), `health-sync.tsx`, `notifications-prompt.tsx`, `(tabs)/notifications.tsx` (realtime), `nutrition-sources.tsx`, `whats-new.tsx` · **W** `Settings`, `Profile`, `Targets`, `NotificationsCenter`, `HouseholdSettingsPage`, `/account/billing`, `/help|privacy|terms|dmca|licences|whats-new`
- **Engine:** settings search index, targets editor + pace re-tune + goal history, display prefs (macro tile/bar, net-carbs lens, weight-surface-mode, week-start), **account deletion fully wired**, data export.

### (9) Onboarding
- **M** `onboarding.tsx` → `MobileFlow` (12 steps); `onboarding-v2.tsx` thin redirect · **W** `app/onboarding/page.tsx` → `WebFlow` (13 steps — divergence intentional)
- **Engine:** `persist` (writes `profiles`, **never entitlement cols** — tier-lockdown trigger rejects whole row), seeds + `onboardingFirstWeek` (builds first plan), pace mapping ↔ `PACE_WEEKLY_KG`, soft-warn pace floor. Welcome copy is an **intentional platform divergence**.

### (10) Premium / Paywall
- **M** `paywall.tsx` (RevenueCat), `AiPaywallSheet` · **W** `upgrade-paywall-dialog`, `UpgradePrompt`, `ai-paywall-dialog`, `/pricing`, `/account/billing`, `/checkout/success`
- **Engine:** tier resolution RC (mobile) + Stripe (web) → `profiles.user_tier`; cached tier (last-known to avoid gate-flash); server-enforced AI gates; promo/downgrade; pricing SSOT (**£-hardcoded = known region-aware bug**, O-6); VAT-inclusive UK/EU; CMA renewal disclosure.

### Cross-screen flows to preserve (don't break the wiring)
Log → ring + adaptive-TDEE + snapshot + HealthKit · Import → verify → cookbook → plan · Generate plan → shopping list · Move-meal (**mobile-only**, O-7) · Weekly check-in → re-tune → recompute targets · Cook → timers → cook-history · HealthKit two-way · Win-moment/30-day landmarks · Deeplink/Siri routing.

---

## 4. Rollout sequence (locked order)

**Phase 0 — Design foundation (FIRST):** tokens, colours, typography, spacing, core components — into `src/styles/theme.css` + `apps/mobile/constants/theme.ts` via a *semantic remap* of the existing blue 8-slot lock (clay→primary, sage→success, plum→chrome, amber→warning, destructive, macros incl. **fiber #4A7878**), wire **Newsreader**, build/align core components (Button, AppBar, TabBar, Card, Chip, MacroTile, MealRow, CalorieRing, week strip). Validate parity/hex-token tests. *Foundation is the only "broad" change; everything after is per-surface.*

Then, one at a time, **iOS first then web parity**, stopping for review after each:
**1** Home/Today → **2** Weight → **3** Nutrition → **4** Food Logging → **5** Analytics/Progress → ~~**6** AI Coach~~ *(POST-LAUNCH — skipped in the pre-launch run; built after launch)* → **7** Recipes → **8** Settings → **9** Onboarding → **10** Premium.

Per area, the **named benchmark** to anchor on (validate live against Mobbin each time):
| Area | Primary benchmark(s) | Why |
|---|---|---|
| Today | MacroFactor (ring+macro bars), Cal AI (calm daily), Lifesum (warmth) | macro-spine clarity + warm coaching |
| Weight | MacroFactor (trend/scale EMA), Happy Scale | trend-not-scale honesty |
| Nutrition | Cronometer (micro depth), MacroFactor | depth without clutter |
| Food Logging | MacroFactor (speed), Cal AI (photo), MFP (search/barcode) | speed-to-log |
| Analytics | MacroFactor (expenditure/trend), Oura/Whoop (narrative) | story over dashboard |
| AI Coach | Cal AI coach, RISE, MacroFactor microcopy | *if/when scoped* |
| Recipes | Julienne (aesthetic), NYT Cooking (editorial/collections/video), Paprika/Crouton (cook) | viral hook + cook utility |
| Settings | Linear/Spotify (grouped), Cal AI | scannable groups |
| Onboarding | Cal AI (fast value), Noom/Lifesum (intent-first), Headspace | speed-to-value |
| Premium | Cal AI, MacroFactor, Blinkist | value-before-charge |

---

## 5. Per-feature dossier template (fill BEFORE each change; summary AFTER)

```
### <Feature> — <iOS|web>
EXISTING: routes/files, what it does, states, business rules, API, data deps (cite the §3 row)
BENCHMARK: Mobbin refs + named best-in-class app + the 1-2 specific patterns to borrow
PROPOSED: the Sloe redesign (layout, hierarchy, interactions, states) + Figma frame ref
PRESERVE: exact list of features/states/rules/APIs that must still work afterwards
RISK: what could regress (megafile? realtime? gating? side-effect chain?) + mitigation
SCOPE: the single agreed change (small, visible, reviewable)
--- after implementation ---
CHANGED · PRESERVED · TESTED (dev + sim) · RISKS · OUTSTANDING Qs · RECOMMENDED NEXT (one)
```

---

## 6. Figma + tooling state

- File `B3UdOFup7ITersgNuoXh0l`: page **"Sloe · Screens"** (65 frames in **8 labelled Sections**: Core app / Drill-downs & extras / Onboarding flow & states / Loading-Error-Dark / Account-Auth-More / Web app / Landing / Web onboarding) + **"Sloe · Design System"** page (colour tokens incl. new **macro/fiber** + **dark-theme token row**, Button/AppBar*(fixed: Sloe-left, no hamburger)*/TabBar/Card/Chip/MacroTile/MealRow components, full type scale).
- **Figma capture server is intermittently down** (the html-to-design plugin); the Plugin-API connection is live (used for the latest edits). The 3 **landing frames still show a stale render** + need re-capture when the capture plugin reconnects.
- Stitch project `8020514740857471151` for image-gen; Mobbin MCP for per-feature benchmarks.

---

## 7. Decisions (resolved with Grace 2026-06-03)

- **O-1 — RESOLVED:** Redesign ships **flag-free, directly to dev**; the stop-after-each review is the safety net. **Do not commit until Grace approves** each change (must not reach main/prod un-reviewed).
- **O-2 — RESOLVED:** **Sloe prototype ring wins** (plum multi-ring), state legibility preserved in Sloe tokens. Supersedes the locked live mapping for the redesign. (Detail in §2.)
- **O-3 — RESOLVED:** **Web keeps weight inside Progress** (no new standalone web route); mobile keeps standalone `/weight-tracker`. The redesign gives web Progress an elevated, clearly-delineated weight section. Rationale: web has no weight route today; a standalone one is scope creep and Progress already owns the data.
- **O-4 — RESOLVED:** AI Coach is **in scope but POST-LAUNCH.** Removed from the pre-launch sequence (slot 6 is skipped pre-launch); built after launch against the spec + existing narrative engines.
- **O-5 — RESOLVED:** **Both** web recipe-detail surfaces are in scope — the Recipes slot must redesign the in-SPA `RecipeDetail.tsx` (authed) **and** the SSR public `app/recipe/[id]/page.tsx` (share/SEO/viral).
- **O-6 — RESOLVED:** Pricing → **real region-aware** (currency/tax/disclosure by region), replacing £-hardcoded. **Price values confirmed (Grace 2026-06-03): use the already-agreed Suppr prices — Free £0 forever; Pro £7.99/mo or £59.99/yr (Save 37%).** SSOT `src/lib/landing/pricingTiers.ts` (per `docs/decisions/2026-04-19-pricing-v1.md`); GBP are the anchors, the region-aware layer applies local currency + tax/disclosure per region around them. Input CLOSED.
- **O-7 — RESOLVED (investigated):**
  - **web move-meal is NOT shipped** — deliberately cut (Grace 2026-04-20; `MealPlanner.tsx:144` lists "Move dialog" under "intentionally cut"). Web only has **Swap** (replace recipe in a fixed slot), not move-between-days/slots. Shared algo `moveMealInPlan` (`src/lib/nutrition/leftoversPlanner.ts:249`) exists, mobile-only UI. → **DECIDED (Grace 2026-06-03): ADD web move-meal for parity.** Build at the Plan slot using the shared `moveMealInPlan`; mirror mobile's `MoveMealSheet.tsx` (move-between-days/slots), not just web's current Swap. Input CLOSED.
  - **web fasting: real + functional** (`FastingTimer.tsx`, 527 lines — presets, ring, milestones, history, same Supabase fields as mobile). Decision doc `2026-04-fasting-web-scope.md` was updated 2026-05-14 to match — **no drift.** In scope to restyle, not rebuild.
  - **two web recipe details confirmed** (authed `RecipeDetail.tsx` + public SSR `app/recipe/[id]/page.tsx`) — redesign both.
  - **net-carbs lens + household settings are already at web↔mobile parity** (not mobile-only). Correct the stale "go-public web-only" / "move-meal" framing accordingly.
- **O-8 — RESOLVED (contracts documented — FROZEN, a re-skin must not change these):**

  | Contract | Frozen signature / rule | Source |
  |---|---|---|
  | **profiles tier-lockdown** | client `UPDATE profiles` must **exclude** `user_tier`, `stripe_customer_id` (+ forward-banned `subscription_*`/`trial_*`/`billing_period_*`/`paid_through_at`). Any locked col in the payload → **whole row rejected (42501)**. Settings/Onboarding persist must scope to user-profile fields only. | `migrations/20260503100000_*`, `…102000_*` |
  | **`save_meal_plan`** | `(p_slot_id text, p_start_date date, p_plan jsonb)`; `p_plan` = `[{day,meals:[{slot_index,name,recipe_title,recipe_id,calories,protein,carbs,fat,portion_multiplier,is_placeholder}]}]`; atomic DELETE+INSERT → `meal_plan_days/meals`. Callers: planner.tsx, AppDataContext, onboardingFirstWeek. | `migrations/20260503100400_*` |
  | **`save_verified_ingredients`** | `(p_recipe_id uuid, p_recipe_update jsonb, p_ingredient_updates jsonb)`; must keep sending per-ingredient `confidence`/`source`/`override_macros`; atomic → `recipes`+`recipe_ingredients`. Caller: `verifyRecipe.ts`. | `migrations/20260527100000_*` |
  | **adaptive-TDEE** | web recomputes on its own via shared `refreshAdaptiveTdeeForUser` fired from journal-write callbacks (`useNutritionJournalState.ts`) — **a re-skin is safe; rewiring the journal write path must preserve the `void refreshAdaptiveTdeeForUser(...)` calls** or web silently falls back to static Mifflin-St Jeor. | `src/lib/nutrition/refreshAdaptiveTdee.ts` |
  | **iOS widget snapshot** | Today must keep producing `WidgetSnapshot` (`kcalConsumed/Target`, `{protein,carbs,fat}LeftG`, `fastActive/StartsAt/TargetHours`) + the debounced `buildWidgetSnapshot→writeWidgetSnapshot` call. **No native widget consumer shipped yet** (future work) so breakage wouldn't regress a live widget, but keep the data shape. | `src/lib/nutrition/widgetSnapshot.ts` |

  ⚠️ **Two facts to verify before the slots that touch them:** (a) ✅ **RESOLVED (2026-06-03):** `save_verified_ingredients` WAS missing from prod `pg_proc` (migration `20260527100000` marked applied but never ran — ENG-557 drift). Fixed via `supabase migration repair 20260527100000 --status reverted` + `supabase db push --include-all` → function now live (verified in `pg_proc`: SECURITY INVOKER, `authenticated` EXECUTE, correct 3-arg signature). Types regenerated (`npm run db:types`, both web + mobile). **Side-finding:** recipe-verify saves were silently failing in prod since 2026-05-27 (no fallback — `verifyRecipe.ts:2055` returns the RPC error). Low real impact (sole tester, pre-launch) but now fixed. (b) adaptive-TDEE is a *write-side-effect*, not render — safe under pure re-skin, risk only if the journal write path is rewired.
- **O-9 — RESOLVED:** Megafiles get **decomposed while redesigned** — extract `use<Screen>()` hooks + child component files, shrinking toward the 400-line bar (ENG-621). Re-attach the data/logic wiring; never reimplement the engine.
- **O-10 — RESOLVED:** QA loop = **implement (no flags) → Grace tests in dev + simulator → approve → then commit.** No automated flag ramp.

### Still-open inputs — ALL CLOSED (2026-06-03)
- ~~Real per-region price values~~ → **CLOSED:** Free £0; Pro £7.99/mo · £59.99/yr (O-6).
- ~~web move-meal decision~~ → **CLOSED: ADD for parity** (O-7).
- ~~Verify `save_verified_ingredients` live in prod~~ → **CLOSED: now live in prod + types regenerated** (O-8 flag a).

**No open inputs remain. The only gate to start is Grace's approval of this plan (§8).**

---

## 8. Gate

**Phase 0 (design foundation) may begin once Grace approves this plan** — it touches tokens/typography/components only and depends on no open contract. Each subsequent slot opens only after the prior is reviewed + approved, and after its specific open input above is closed. Nothing is committed until Grace approves.
