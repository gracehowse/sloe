# Product roadmap — ReciMe / recipe + macro platform

This document extends the MVP hardening work with **nutrition depth**, **activity-adjusted targets**, and **social discovery**. It is the north-star for prioritization; implementation order should follow dependencies below.

---

## Product thesis

- **Macro trackers**: strong logging and targets; weak joyful food discovery and meal planning from real recipes.
- **Recipe / social food apps**: strong scroll and saves; weak closing the loop to *your* calorie and protein budget.
- **Our wedge**: targets → plan → shop → cook → log in one place, with a feed that’s genuinely fun to browse—and **creator-friendly** flows (save, plan, shop) built for recipes.

---

## Phase A — Macro-native meal planning (near-term)

**Status:** Onboarding and Profile now capture **fiber** and **water** daily goals plus an **“adjust calories for activity (Apple Health)”** preference stored in `profiles` (`target_fiber_g`, `target_water_ml`, `prefer_activity_adjusted_calories`). The Nutrition tab shows those goals; per-meal fiber/water logging and HealthKit sync are still to build.

**Goal:** Meal plans respect user goals, not just library slots.

**Status (partial):** `generateMealPlan.ts` scores **breakfast + lunch + snack + dinner** combinations from saved recipes to minimize deviation from **daily calories, protein, carbs, and fat** within configurable **±% bands** (defaults ±12% kcal, ±18% carbs/fat). Multi-day plans reduce repeat fatigue by clearing the “recent” pool every 3 days. `MealPlanner` shows **actual vs target** per macro with band messaging, **Discover / Library** CTAs when the library is empty, and blocks generate until at least one recipe is saved.

- Planner inputs: daily calorie target, protein floor (and optional carb/fat bands).
- Outputs: per-day totals vs targets, swap suggestions, clear empty-library CTAs (Discover / Library).
- **Expanded macros in planning & logging (foundation):**
  - **Fiber** — track per food/recipe/day; optional daily target and “remaining fiber” in summaries.
  - **Water** — daily goal (ml or cups), quick log, optional streaks; show on dashboard / nutrition day view.
- **Schema / data:** extend recipe and log models beyond P/C/F where needed (fiber per serving; water as its own daily series, not a “macro” in the chemical sense but a first-class health metric).

*Depends on:* stable `nutrition_journals` / per-day logging patterns in the app.

---

## Phase B — Activity-adjusted calorie allowance

**Goal:** Steps and workouts adjust **net** or **goal calories** so the product matches how serious trackers behave.

- **Apple Health integration (iOS):**
  - Read **active energy** and/or **step count** (and optionally workout sessions) with user permission.
  - Define a clear rule (product + copy): e.g. “add back” a fraction of active calories to the daily budget, or use a TDEE-style adjustment—**document the formula** for trust.
- **Manual fallback:** log exercise minutes / steps without Health for users who opt out.
- **UX:** show **base goal vs activity adjustment vs net target** in one line or expandable panel (avoid black-box math).
- **Daily deficit from full burn (Apple Health):**
  - Read **total daily energy expenditure** from HealthKit in line with Apple Health’s end-of-day picture—e.g. **basal/resting energy + active energy** (so if the user burned ~500 active kcal and Health reports ~1900 kcal total burned, implied BMR/resting is ~1400; not only “add back active” but **intake vs total out**).
  - **Deficit for the day:** `total calories burned − calories eaten` (positive = under maintenance). Example: burned ~1900, ate ~1500 → **~400 kcal deficit today**.
  - **Projection UX (benchmark: Lose It):** surface copy like “You’re at about **400 kcal under** today” and, if that pace held all week, “**~2,800 kcal** deficit this week → rough order **~0.4 kg** fat-equivalent” with a **goal-weight-by date** estimate—always framed as **projected**, not guaranteed.
  - **Trust / timing:** totals and deficit **finalize toward end of day** (resting burn and activity still accrue); messaging should admit uncertainty intraday and refresh after EOD—same psychological contract as strong calorie apps (reference UI: Lose It–style projection screens for design reviews).
- **Lose It–style onboarding & day-math transparency (UX benchmark):**
  - **Onboarding:** dense but clear first-run flow—primary objective, plan speed (e.g. kg/week) with **calorie budget** and weeks-to-goal, optional **flexible weekly calorie schedule** (“high days” that shuffle the same weekly allowance), **nutrition strategy** (e.g. high protein vs high satisfaction with explicit macro targets), then a **program summary** with a **weight projection** headline (goal weight + target date) before paywall/continue.
  - **Deficit / allowance copy:** spell out **extra burn today vs typical**, **estimated total burn** (intraday partial + projection or EOD), **baseline budget / expected average**, and **how much extra food fits** while **holding the same intended deficit**—users should never wonder why the number moved.
  - **Imported food logs:** when nutrition is **read from HealthKit**, entries may originate in another logger (e.g. MacroFactor); show **source** where the platform provides it and expect **day totals to match the writer app** when import is complete. Operational reality (batching, read timing) is documented in [`health-platform-phase-b.md`](health-platform-phase-b.md).

*Depends on:* Phase A daily targets UI; native or Capacitor wrapper if web-only today (HealthKit requires native iOS surface—roadmap should flag **platform decision**).

*Risks / notes:* Web apps cannot access HealthKit directly; typical paths are **iOS app shell**, **Shortcuts export**, or **partner wearables API** later. Engineering spike: choose one path for private beta. **Apple Health is a permissioned datastore, not a live sync bus**—see [`health-platform-phase-b.md`](health-platform-phase-b.md).

---

## Phase C — Daily summary quality (retention)

- Remaining macros vs targets (including **fiber** and **water**).
- Per-meal breakdown; export day as CSV.
- Optional: weekly rollups for fiber and hydration adherence.

*Depends on:* Phase A fields present in logs and UI.

---

## Phase D — Social feed (differentiator)

**Goal:** If users want recipe inspiration, they open **this** app.

- Feed: scroll, save, filters (macros, diet), creator attribution, honest timestamps (sample vs community).
- Behaviors: save → library → add to meal plan → shopping list; creator collections; share links for recipes/lists.
- **Creator loop (later):** analytics (saves, plan adds), notifications when you follow a creator who publishes.

*Depends on:* stable publish/discover pipeline; can run in parallel with Phase B once core logging is solid.

---

## Phase E — Premium / compliance polish

- Clear disclosure for sponsored or affiliate-linked content when you add commerce-adjacent features.
- Tiering: which adjustments (Health, advanced planner constraints) sit behind **base** vs **pro** should match your business model.

---

## Suggested sequencing

1. **Fiber + water** in targets, logging, and daily summary (Phase A/C overlap).
2. **Macro-aware meal planner** constraints and empty states (Phase A).
3. **Activity adjustment** spike → Apple Health path decision → implement adjustment + UI (Phase B).
4. **Feed + save + plan** depth (Phase D) in parallel where staffing allows.

---

## Open decisions (capture before large build)

| Topic | Question |
|--------|----------|
| Health data | Web-only vs native iOS for HealthKit? |
| Calorie math | Add-back vs TDEE model; show formula to users? |
| Deficit vs allowance | Separate “activity-adjusted goal” (Phase B) from **intake vs total burn** deficit view + weekly/goal projection? |
| Health nutrition | Read dietary data **from** Health only vs also **writing** our logs to HealthKit for cross-app use? |
| Fiber | Per-recipe from DB vs estimates from ingredients first? |
| Water | Single daily total vs time-bucketed logs? |

---

## Related implementation areas in repo

- **Mob-inspired UX / smart-suggestions notes (ingredient overlap, shopping polish):** [`docs/mob-inspired-notes.md`](mob-inspired-notes.md).
- **HealthKit semantics (writer/reader, batching):** [`docs/health-platform-phase-b.md`](health-platform-phase-b.md).
- Nutrition UI: `src/app/components/NutritionTracker.tsx`, `AppDataContext`.
- Planner: `src/lib/planning/generateMealPlan.ts`, `MealPlanner.tsx`.
- Feed / social: `DiscoverFeed.tsx`, `RecipeDetail.tsx`, saves and follows in context + Supabase schema.

This roadmap is **living**; update phases as beta feedback arrives.
