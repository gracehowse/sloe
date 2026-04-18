# TestFlight build 7 — remaining open items

**Date:** 2026-04-18
**Source:** ASC feedback batch (`../testflight-feedback/data/feedback-2026-04-18.json`), 14 items after subtracting `../testflight-feedback/resolved.md`.
**Scope:** mobile-first unless noted. Items already in `resolved.md` are not repeated here.

---

## Do not action yet

These items must not be planned until we have more information.

| ID | Feedback | Blocker |
|----|----------|---------|
| `AMsdTaWai1sJijvuX1VQJg4` | "Not sure if this feature is working at all" | No screenshot, no feature name. Request tester follow-up before triaging. |
| `AISAWnLgU9cjRBOuEY-HuJU` | "Not intuitive" | No screenshot, no screen identified. Logged in `resolved.md` as open but untriaged. Same request. |
| `AFE6h9Tlq0bUCugLAJfVGx8` | "None of the trial/payments stuff is hooked up" | Intentional — paywall is a known placeholder per project memory. No work until monetisation milestone is approved. |
| `ABwH6OVJ-kJxC5LdcL3iEzc` | Imported recipe has inaccurate nutrition | No recipe ID, no import URL. Without a specific recipe the failure mode cannot be determined (import parsing bug vs USDA match vs serving-size error). Request reproduction steps. |

---

## P0 — Broken or data-inaccurate

### P0-1 · APNs push token never registered — notifications silently fail

- **ASC IDs:** `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`
- **Problem:** `apps/mobile/app/notifications-prompt.tsx` calls `requestPermissionsAsync` and stores nothing. There is no `getExpoPushTokenAsync` call anywhere in the mobile codebase — no token is written to Supabase, so the server has no address to push to. The permission prompt recurs because permission state is not persisted after the first grant (the prompt screen does not write an AsyncStorage flag or profile column on success). Result: the user grants permission, the OS records it, but no push is ever delivered.
- **Goal:** On successful permission grant: call `getExpoPushTokenAsync`, persist the token to `profiles.expo_push_token`, and write an AsyncStorage flag so the prompt never re-shows. On the server, use the stored token when scheduling weekly-recap pushes (see `weekly_recap_push_enabled_toggled` decision). All notification delivery should be testable via Expo's push notification tool.
- **Severity:** P0
- **Effort:** M
- **Platforms:** Mobile only
- **Dependencies:** Supabase column `profiles.expo_push_token text` must be added in a migration before the client write can land.
- **Owner:** `executor`
- **Review:** `qa-lead`
- **Acceptance:** After granting permission on a fresh install, firing the weekly-recap push (or a test push via Expo dashboard) delivers the notification on device. The prompt does not re-appear on next app launch.

### P0-2 · HealthKit dietary import inflates macros for bulk-sync apps (MFP via HealthKit)

- **ASC ID:** `AJHZNp8NHTiFNk9TjQfdYBk`
- **Problem:** `apps/mobile/lib/healthSync.ts:syncNutritionFromHealth` correlates energy with macros by `minute|bundleId` key (`dietaryCorrelationKey`). Apps like MyFitnessPal write daily meals to HealthKit as bulk syncs where multiple food items share the same `startDate` (midnight) and `endDate` (actual sync time). When two or more foods from the same app land in the same minute bucket, their carbs, protein and fat are all summed into a single entry — dramatically over-reporting macros for that day.
- **Goal:** Detect bulk-sync patterns (multiple energy samples from the same `bundleId` in the same minute bucket) and de-correlate them: each energy sample becomes its own entry. Macros are matched to the energy sample with the same `id` (via `HKFoodCorrelation` child UUIDs) rather than by wall-clock bucket. Fall back to the current heuristic only when correlation IDs are absent. After fix, re-importing the same MFP day should produce per-food entries with individual macro values matching the source app's display.
- **Severity:** P0 — nutrition accuracy is non-negotiable per project rules.
- **Effort:** M
- **Platforms:** Mobile only (`apps/mobile/lib/healthSync.ts`)
- **Dependencies:** None
- **Owner:** `nutrition-engine`
- **Review:** `qa-lead`, `data-integrity`
- **Acceptance:** Unit test: two energy samples from the same `bundleId` at the same minute, each with distinct `id` values linked to separate `FoodCorrelation` rows, produce two separate `nutrition_entries` with individual macro values — not one summed entry. Manual test: import a multi-meal MFP day; carb total matches MFP's displayed daily carbs within 5%.

### P0-3 · Goal-adjustment parity: web pace-based vs mobile flat ±500

- **Source:** nutrition-engine audit (related to `AAtW7dYcCBPyBdsMU6UqiQQ`)
- **Problem:** `src/lib/nutrition/tdee.ts:calculateBudget` applies `PACE_DAILY_DEFICIT` (275 / 550 / 825 / 1100 kcal for relaxed / steady / accelerated / vigorous). `apps/mobile/lib/calcTargets.ts:goalCalorieAdjustment` ignores pace entirely and applies a flat −500 / 0 / +300. A user on "relaxed" pace to lose weight gets a 275 kcal deficit on web and a 500 kcal deficit on mobile — divergent calorie targets on the same account.
- **Goal:** Align mobile to use the same pace-aware deficit. Extract `PACE_DAILY_DEFICIT` into a shared location (`src/lib/nutrition/tdee.ts` already has it). Mobile `calcTargetsFromStats` should accept the user's `plan_pace` from `profiles` and apply the same lookup table. Default to `steady` when `plan_pace` is null (matches the existing web default).
- **Severity:** P0 — same account, different calorie targets on each platform violates the non-negotiable parity rule.
- **Effort:** M
- **Platforms:** Both (mobile fix; web is already correct)
- **Dependencies:** `profiles.plan_pace` must be readable on mobile (column exists; confirm it is selected in `calcTargets` callers).
- **Owner:** `data-integrity`
- **Review:** `nutrition-engine`, `qa-lead`
- **Acceptance:** A profile with goal=lose, pace=relaxed produces a 275 kcal deficit on both platforms (unit tests covering all four pace values on both `calculateBudget` and the updated `calcTargetsFromStats`).

---

## P1 — Important UX on load-bearing flows

### P1-1 · TDEE explainability: onboarding preview + Today activity-bonus card

- **ASC IDs:** `AAtW7dYcCBPyBdsMU6UqiQQ`, `AFdtq8z_FmWRCispqF04Lsk`
- **Problem:** Three explainability gaps remain after the silent-default fix shipped (see `resolved.md`):
  1. Onboarding activity step (both platforms) shows activity level options but no TDEE preview — user cannot see how their choice affects their calorie target before committing.
  2. `src/app/components/suppr/today-activity-bonus-card.tsx` renders a 3-tile grid (Total burn / Target intake / Under-Over) with no Maintenance tile and no explanation of how those numbers were derived. `profileMaintenanceTdee` is not in the props interface.
  3. No info popover on the card explaining the formula (BMR × multiplier = maintenance; maintenance + active burn = total burn; bonus = burn above maintenance).
- **Goal:**
  1. **Onboarding (both platforms):** When height, weight, age, and sex have been entered and the user reaches the activity step, show a live row: "Sedentary: 1,682 · Light: 1,927 · Moderate: 2,173 …" computed from entered stats. Selection highlights the active level. Uses `calculateTDEE` from `src/lib/nutrition/tdee.ts`.
  2. **Today activity-bonus card (web + mobile):** Add `profileMaintenanceTdee: number` to `TodayActivityBonusCardProps`. Render it as a 4th tile: Maintenance / Total burn / Target / Under-Over. Add an info icon (tap/click) that shows a popover: "Maintenance ≈ {tdee} kcal (BMR {bmr} × {activityLabel} {mult}). Total burn = Resting {basal} + Active {active}. Bonus = burn above maintenance."
- **Severity:** P1
- **Effort:** M
- **Platforms:** Both
- **Dependencies:** None (all data is already in state; this is rendering only)
- **Owner:** `executor`
- **Review:** `ui-product-designer`, `qa-lead`
- **Acceptance:** (a) Onboarding: switching activity level on the activity step updates the calorie preview in real time; (b) Today card: Maintenance tile shows a non-zero number matching the profile's effective TDEE; tapping the info icon displays the formula popover with correct values; (c) Mobile and web render identically.

### P1-2 · Weight section redesign (mobile)

- **ASC ID:** `AF7bS2DQrH_wZWxGosBJ3K8` (5 screenshots)
- **Problem:** The tester called the weight section "not particularly helpful nor accurate" and attached 5 reference screenshots. Current `apps/mobile/app/weight-tracker.tsx` has a trend chart, journey progress bar, and HealthKit sync — but: (a) weekly rate of change is not displayed as a prominent stat; (b) the Journey card is entirely hidden when `goal_weight_kg` is not set; (c) there is no indication of where the numbers come from (HealthKit vs manual); (d) the layout matches neither the reference screenshots nor the web Progress section.
- **Goal:** Before speccing exact layout, retrieve the 5 tester screenshots from ASC (`AF7bS2DQrH_wZWxGosBJ3K8`). Once reviewed: surface weekly rate of change as a primary stat on the weight card; show a "no goal set" empty state (not hidden card) with a CTA to set a goal weight; add a source badge ("From Apple Health" / "Manual entry") to each data point or the card header; align the overall information hierarchy with web `ProgressDashboard`.
- **Severity:** P1
- **Effort:** L
- **Platforms:** Mobile primary; web parity review after mobile ships
- **Dependencies:** Screenshots must be retrieved from ASC before layout work begins.
- **Owner:** `ui-product-designer` (layout spec), then `executor` (implementation)
- **Review:** `qa-lead`, `customer-lens`
- **Acceptance:** (a) Screenshots reviewed and design decision recorded; (b) weekly rate visible without setting a goal; (c) empty state shown when goal_weight_kg is null; (d) `ui-product-designer` sign-off that layout matches reference screenshots; (e) web parity reviewed and no regression on `ProgressDashboard`.

### P1-3 · Grocery list does not auto-regenerate when plan regenerates

- **ASC ID:** `AEe5QKJqkPPxtFMbDpVW5yg`
- **Problem:** In `src/app/components/MealPlanner.tsx`, `handleRegenerate` (line 225) only sets `generatedPlan` to null. It does not call `handleGenerate` or `generateShoppingListFromPlan`. The user must then click "Generate plan" again, then wait for the grocery list to appear as a side effect. The "Generate Shopping List" button existing as a separate action after plan generation makes the flow feel manual and clunky.
- **Goal:** `handleRegenerate` should call `handleGenerate` directly (or inline its logic) so that clicking Regenerate produces a new plan and updates the grocery list in a single action. The separate "Generate Shopping List" button can be retained as a manual refresh fallback but should not be the primary path. Web-only; mobile meal planner parity is a separate backlog item.
- **Severity:** P1
- **Effort:** S
- **Platforms:** Web (`src/app/components/MealPlanner.tsx`)
- **Dependencies:** None
- **Owner:** `executor`
- **Review:** `qa-lead`
- **Acceptance:** Clicking "Regenerate" produces a new plan and a refreshed grocery list without any additional user action. Toast reads "N-day plan ready! Shopping list updated." (same as initial generate). Existing grocery list is not shown stale at any point during the flow.

### P1-4 · Meal plan shows no aggregate macro proximity to targets

- **ASC ID:** `AH8csBqtZsBJJr0uHgXyEcE`
- **Problem:** `MealPlanner.tsx` renders per-day `MacroCard` tiles (lines 1214–1217 per day), but there is no summary across the whole plan showing average or total calories/protein/carbs/fat vs targets. The user cannot tell at a glance how well the generated plan fits their goals without inspecting every day individually.
- **Goal:** Add a "Plan summary" row (or collapsed card) above the day grid showing: average daily calories vs target (with a coloured indicator), average protein / carbs / fat vs targets. Values are already computable from `generatedPlan ?? mealPlan` and the target variables in scope. No new data fetching needed.
- **Severity:** P1
- **Effort:** S
- **Platforms:** Web (mobile meal planner parity is a separate item)
- **Dependencies:** P1-3 should ship first to avoid conflicting layout work in `MealPlanner.tsx`
- **Owner:** `executor`
- **Review:** `ui-product-designer`, `qa-lead`
- **Acceptance:** When a plan is generated, a summary row is visible above the day cards showing average daily values for all four macros with visual indicators (green / amber / red) relative to targets. Values update when meals are swapped. No regression on per-day MacroCard tiles.

---

## P2 — Quality and discoverability

### P2-1 · Progress page slow to load

- **ASC ID:** `AEb7NcjnvK4PpVPHaaVUeI0`
- **Problem:** Tester reports Progress tab takes a noticeable time to load. No profiling data yet.
- **Goal:** `performance-optimizer` audits `apps/mobile/app/(tabs)/progress.tsx` (and `src/app/components/ProgressDashboard.tsx` for web parity). Identify the slowest query or render path. Produce a specific fix proposal before `executor` touches code.
- **Severity:** P2
- **Effort:** S (audit) + unknown (fix)
- **Platforms:** Both (mobile is the reported surface; web should be benchmarked too)
- **Dependencies:** None
- **Owner:** `performance-optimizer` (audit), then `executor` (fix)
- **Review:** `qa-lead`
- **Acceptance:** `performance-optimizer` produces a named cause and proposed fix. After fix: Progress tab visible content renders within 1 s on a throttled connection in the Expo dev build.

### P2-2 · Edamam food/restaurant search not surfaced in Discovery

- **ASC ID:** `AOI9xgY88Dx-uphiXI8IzEk`
- **Problem:** `src/lib/edamam/client.ts` integrates the Edamam Food Database API (1,000 req/day free tier; 200K restaurant meals in index) but there is no mobile integration — the Discovery tab does not expose food or restaurant search. The tester expected to find restaurant meals there.
- **Goal:** Product decision required before planning: (a) is Edamam food search in scope for the current milestone? (b) if yes, should it sit in Discovery (browsing intent) or in the Today "Add meal" flow (logging intent)? This is a new capability, not a bug.
- **Severity:** P2
- **Effort:** L (if approved)
- **Platforms:** Both
- **Dependencies:** Product decision (see Open Decisions below)
- **Owner:** `integration-manager` (once decision is made)
- **Review:** `product-lead`
- **Acceptance:** Cannot be defined until the product decision is made.

---

## Critical path

The minimum sequence to unblock the next TestFlight build:

```
P0-1 (push token + permission persistence)
  → P0-2 (HealthKit macro inflation fix)
  → P0-3 (goal-adjustment parity)
  → P1-3 (grocery auto-regen, S effort, unblocks P1-4)
  → P1-4 (plan macro summary)
  → P1-1 (TDEE explainability, can run parallel with P1-3/4)
```

P1-2 (weight redesign) requires the tester screenshots first — it runs in parallel once those are retrieved and design is specced. P2 items are not on the critical path.

## Quick wins

| Title | Why cheap | Owner |
|-------|-----------|-------|
| P1-3 Grocery auto-regen | One-line change: `handleRegenerate` calls `handleGenerate`. No new UI. | `executor` |
| P1-4 Plan macro summary | Data already in scope; rendering only. | `executor` |

## Open decisions

| Decision | Needed for | Route to |
|----------|-----------|---------|
| Is Edamam food/restaurant search in scope for the current milestone? And if so, Discovery (browse) or Add Meal (log)? | P2-2 | `product-lead` |
| Retrieve 5 reference screenshots for `AF7bS2DQrH_wZWxGosBJ3K8` from ASC. | P1-2 | Grace (ASC account holder) |
| Request follow-up screenshot from tester for `AMsdTaWai1sJijvuX1VQJg4` and `AISAWnLgU9cjRBOuEY-HuJU`. | Both items blocked entirely on context. | Grace |
| Request recipe ID + import URL for `ABwH6OVJ-kJxC5LdcL3iEzc`. | Cannot diagnose import path without a concrete case. | Grace |
