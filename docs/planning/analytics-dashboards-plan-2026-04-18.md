# Analytics Dashboards Plan — April 2026 Sprint (L6)

**Author:** analytics-engineer specialist, 2026-04-18.
**Source:** `src/lib/analytics/events.ts` audit (52 events; ~30 new in April).
**Status:** Plan. Implementation owners named per item.

---

## 1. Top 6 dashboards

### D1. Core Logging Health
Metrics: DAU with ≥1 `food_logged`; `food_logged` volume by `source` (stacked); `meal_copied` / `day_duplicated` per day normalised against `food_logged`; batched-log share; logs-per-logger-day p25/p50/p90.
Refresh: daily. Owner: product-lead weekly + growth-strategist.
**Blocker:** `food_logged` single-meal path doesn't emit `source` uniformly (see G1).

### D2. Quick Add & Habits
Metrics: saved-meal create → log rate (7-day); mean `custom_food_created` per user (28-day); `custom_food_logged` / `food_logged where source in (quick_add, custom)`; hydration adherence; `fit_this_in_previewed` → `food_logged` same session sliced by `overCalories`.
Refresh: daily. Owner: growth-strategist weekly, product-lead monthly.
**Blocker:** `saved_meal_created` has no properties — can't slice by size or origin tab.

### D3. Activation & Retention
Metrics: D1/D7/D28 cohort retention of first-log users; weekly recap funnel (`shown` → `shared` / `dismissed` / silent); streak-freeze save rate; `empty_state_cta_clicked` → downstream within 10 min; `siri_action_invoked` + `widget_snapshot_updated` liveness.
Refresh: weekly cohorts; daily liveness. Owner: growth-strategist.

### D4. Recipes & Cooking
Metrics: recipe view → cook funnel; timer completion rate (`completed` / `started`); note+rating save per view; override activity per recipe; nutrition-confidence correlation (blocked on G4).
Refresh: weekly. Owner: product-lead.

### D5. Planner & Plans
Metrics: plan generate → apply (7-day); drag-drop adoption + `crossDay=true` share; leftover yield; templates per user; `week_start_day_changed` net flow.
Refresh: weekly. Owner: product-lead.

### D6. AI Pro & Monetisation
Metrics: voice funnel commit rate + paywall → checkout; photo funnel same shape; average confidence at commit (p25/p50/p90 over time — model regression guardrail); paywall by `?from=` source; 7-day paid conversion rate from paywalled.
Refresh: daily during AI-Pro launch, weekly after. Owner: monetisation-architect; legal-reviewer sees opt-out/refund guardrails.

---

## 2. Top 3 funnels

### F1 — Activation
`sign_up` → `onboarding_completed` → first `food_logged` → 3rd `food_logged` on a different day → D7 `food_logged`.
Thresholds: sign-up → first log ≥ 60% (alert <50%); first log → 3 days ≥ 35%; 3 days → D7 ≥ 55%.
**Blocker:** no canonical first-log event (G2).

### F2 — AI-Pro paywall conversion
`voice_log_paywalled` (or `ai_photo_log_paywalled`) → `paywall_viewed with from=...` → `checkout_started` → `checkout_completed`.
Thresholds: paywalled → paywall_viewed ≥ 95%; paywall_viewed → checkout_started ≥ 8%; checkout_started → completed ≥ 70%.
**Blocker:** confirm `paywall_viewed.from` emission.

### F3 — Quick Add habit loop
first `food_logged` → `saved_meal_created` → `saved_meal_logged` (same meal, different day) → ≥3 `saved_meal_logged` in 14 days.
Thresholds: first log → create ≥ 20% at D14; create → relog ≥ 50%; relog → 3x ≥ 40%.
**Blocker:** need `savedMealId` on create+log events (G3).

---

## 3. Stop-firing alerts (any 24h silence = regression)

| Event | Trigger | Cadence |
|---|---|---|
| `food_logged` (any source) | hourly rate < 40% of 7d median | hourly |
| `food_logged where source="barcode"` | zero in 24h on mobile | daily |
| `food_logged where source="quick_add"` | zero in 12h | 12h |
| `checkout_completed` | zero in 12h | 12h |
| `paywall_viewed` | zero in 6h business hours | 6h |
| `widget_snapshot_updated` | iOS widget-installed users + zero events in 24h | daily |
| `weekly_recap_shown` | zero on any Monday | weekly (Mon 14:00 UTC) |
| `voice_log_committed` | zero in 48h post AI-Pro launch | daily |
| `ai_photo_log_committed` | zero in 48h | daily |
| `onboarding_completed` | rate < 70% of `sign_up` trailing 24h | daily |
| `streak_freeze_earned` | zero on any day where cohort crosses day-7 boundary | daily |

---

## 4. Event-name hygiene issues (rename with 30-day dual-emit)

1. **Cook-mode event sprawl** — `cook_mode_opened` vs `cook_mode_started` vs `cook_mode_completed` vs `cook_mode_meal_logged`. Rename `cook_mode_started` → `cook_mode_first_step_advanced`.
2. **First-run dupes** — `first_run_step_completed` vs `onboarding_step_completed`. Keep only `onboarding_step_completed` + `onboarding_checklist_completed`.
3. **`checkout_completed_return`** — rename to `checkout_completed` (drop return suffix).
4. **Recipe import split** — collapse `recipe_import_url` / `recipe_import_image` into `recipe_imported { source: "url" | "image" }`.
5. **Voice vs photo prefix asymmetry** — `voice_log_*` → `ai_voice_log_*` OR `ai_photo_log_*` → `photo_log_*`. Prefer `ai_voice_log_*` + `ai_photo_log_*` (both clearly AI-gated).
6. **`streak_freeze_earned_seen`** — rename to `streak_freeze_earned_acknowledged`.
7. **`weekly_recap_push_sent`** — split into `_scheduled` (local trigger registered) and `_delivered` (OS fired).
8. **Casing** — lock camelCase in `docs/data/schema.md`; current events consistent, keep discipline.

---

## 5. Minimum instrumentation gaps

### G1. `food_logged.source` inconsistency (P0) — **DONE 2026-04-18 (Ship L6)**
Canonical single-meal path (`useNutritionJournalState.ts` & `NutritionTracker.tsx`) emitted `{ calories, fromPlanner }` with no `source`. Mobile paths varied. Mandated enum:

```
source: "manual" | "quick_add" | "saved_meal" | "custom_food"
      | "copy_meal" | "duplicate_day" | "barcode"
      | "voice" | "photo" | "recipe" | "planner"
```

Exported as `FoodLoggedSource` in `src/lib/analytics/events.ts`. `addLoggedMealForDate` (web primitive) accepts an optional `analyticsSource` arg, defaults to `"manual"`, auto-overrides to `"planner"` when `meal.time === "Planned"`. Every `track(AnalyticsEvents.food_logged, …)` call site now passes a canonical source. Grep-level assertion test lives at `tests/unit/foodLoggedSourceParity.test.ts`.

### G2. No first-ever-log signal (P1) — **DONE 2026-04-18 (Ship L6)**
PostHog user property `first_log_at` set on the first `food_logged` per device. Shared helpers in `src/lib/analytics/firstLog.ts`. Web `track()` uses `posthog.setPersonProperties({}, { first_log_at })` (`$set_once` — idempotent). Mobile `track()` gates on AsyncStorage + calls `identify(distinctId, { first_log_at })`.

### G3. `saved_meal_logged` has no `savedMealId` (P1) — **DONE 2026-04-18 (Ship L6)**
`savedMealId` now present on both `saved_meal_created` and `saved_meal_logged` across all five emit sites (web `NutritionTracker` + `quick-add-panel`, mobile `(tabs)/index` + `QuickAddPanel` + slot-header `logSavedMealFromSlotHeader`). Powers F3 habit-loop join.

### G4. `recipe_ingredient_overridden` lacks `confidence_bucket` (P2) — **DONE 2026-04-18 (Ship L6)**
`confidence_bucket: "high" | "medium" | "low"` now present on `recipe_ingredient_added` + `_overridden` + `_override_cleared`. Added path reuses `classifyConfidence` from `src/lib/nutrition/aiLogging.ts` (thresholds mirror the ConfidenceDot UI). Override + clear paths classify from `ingredient.isVerified` (true → high, false → medium), matching the web UI's ConfidenceDot `level` decision.

### G5. `empty_state_cta_clicked` lacks `surface` (P2) — **DONE 2026-04-18 (Ship L6)**
Exported `EmptyStateSurface` enum. Only current emit site (`ShoppingList.tsx`) now passes `surface: "shopping_list"`; test expectation updated.

### G6. Hydration / stimulant payload thin (P2) — **DONE 2026-04-18 (Ship L6)**
`hydration_logged` now carries `amount_ml` + `via: "quick_chip" | "manual"`. `stimulant_logged` now carries `kind: "caffeine" | "alcohol"` + `amount_mg_or_g` + `via`. Five emit sites updated (web `AppDataContext` add/reset, mobile `(tabs)/index` add/reset). Back-compat: `{ type, amount, unit, preset }` retained.

### G7. `widget_snapshot_updated` has no `trigger` (P3) — **DONE 2026-04-18 (Ship L6)**
`trigger: "totals_changed" | "fast_state_changed" | "scheduled_refresh"` now present on every `widget_snapshot_updated` emit. Mobile `(tabs)/index.tsx` widget-snapshot effect diffs totals + fast-state against a `useRef` signature; first write after hydrate is `"scheduled_refresh"`.

### G8. No streak-reset event (P1) — **DONE 2026-04-18 (Ship L6)**
New event `streak_reset` in the registry. Pure predicate `didStreakReset(prior, current)` in `src/lib/nutrition/streakReset.ts` (9 unit tests). Both Today hosts memoize `computeProtectedStreak(...)` exposing `streakLength` and diff in a `useEffect` with a ref seeded to `null`. Fires exactly once per `>=1 → 0` transition with payload `{ priorStreak }`. D3 metric 3 ("freeze save rate") denominator now available.

### G9. Paywall `from` property consistency (P1) — **DONE 2026-04-18 (Ship L6)**
Exported `PaywallViewedFrom` enum. Mobile `app/paywall.tsx` reads `?from=` via `useLocalSearchParams`; web `app/pricing/page.tsx` is now an async server component awaiting `searchParams`. Both platforms run the value through a shared `normalisePaywallFrom()` guard (unknown values fall back to `"deep_link"`). Every `paywall_viewed` now carries `from`.

### G10. PII/sensitive check
Nothing in current set carries raw PII. Keep AI transcripts OFF `voice_log_committed`.

---

## 6. Handoffs

- **executor** — ~~implement G1–G9 property additions~~ **CLOSED 2026-04-18 (Ship L6).** Rename cycle (§4) remains open.
- **sync-enforcer** — ~~verify `food_logged.source` enum identical web + mobile after G1.~~ Closed — enum shared from `src/lib/analytics/events.ts` and grep-tested.
- **data-integrity** — ~~confidence-bucket on override events (G4); first-log user property (G2); streak-reset (G8).~~ Closed.
- **qa-lead** — ~~assertion test: every `track(AnalyticsEvents.food_logged, …)` call site passes `source`.~~ Closed via `tests/unit/foodLoggedSourceParity.test.ts`.
- **monetisation-architect** — confirm `paywall_viewed.from` enum; sign off F2. *(enum landed; sign-off open)*
- **product-lead** — sign off dashboard ownership + refresh cadences + alert thresholds.
- **analytics-engineer** (post-ship) — build the 6 PostHog dashboards + 3 funnels + 11 alerts.

---

## 7. Open decisions

1. ~~`paywall_viewed.from` currently bare? — if yes, F2 blocked until G9 lands.~~ **Closed 2026-04-18** — G9 shipped; mobile reads `?from=` via `useLocalSearchParams`, web via async `searchParams`, both routed through the shared `normalisePaywallFrom()` guard.
2. Dual-emit 30d vs atomic flip for renames? — dual safer, doubles volume briefly.
3. Streak-reset trigger: server-cron vs client on next open? — server gives clean denominators. *(Shipped as client-on-next-open 2026-04-18; server-cron remains a future option if the client-side denominator turns out to be noisy.)*

---

## Relevant files

- `src/lib/analytics/events.ts` — event registry.
- `apps/mobile/lib/analytics.ts` — mobile PostHog shim.
- `src/context/appData/useNutritionJournalState.ts` — primary web `food_logged` emit sites (missing `source`).
- `src/app/components/NutritionTracker.tsx` — web quick-add `food_logged`.
- `src/app/components/FoodSearch.tsx` — `custom_food_logged`.
- `apps/mobile/app/(tabs)/index.tsx` — mobile emit sites (barcode, quick_add, voice, photo, batched).
- `apps/mobile/components/FoodSearchModal.tsx` — mobile `custom_food_logged`.
- `tests/unit/analyticsEvents.test.ts` — keep in sync with renames.
- `tests/unit/nutritionJournalBulkInsert.test.tsx` — extend to assert `source` presence.
- `docs/planning/sweep-2026-04-executor-backlog.md` — F9 analytics schema backlog item (this plan closes it).
