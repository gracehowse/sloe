# Data & Schema Reference

**Audience:** Developers

## Database

PostgreSQL via Supabase. Row-Level Security (RLS) enabled on all tables.

## Tables Summary

| Table | Purpose | Storage Model |
|-------|---------|--------------|
| `profiles` | User identity, body stats, macro targets, preferences | Relational |
| `creators` | Curated recipe creators (external) | Relational |
| `recipes` | Recipe content + per-serving macros | Relational |
| `recipe_ingredients` | Per-ingredient macro snapshots | Relational (denormalised) |
| `ingredients` | Food catalog (Phase 0) | Relational |
| `foods` | Unified food entity (Phase 1) | Relational |
| `food_sources` | Food provenance records | Relational |
| `barcode_mappings` | Barcode → food mapping | Relational |
| `food_reports` | User-submitted data quality reports | Relational |
| `saves` | User ↔ recipe bookmarks | Junction |
| `follows` | User → creator follows | Junction |
| `author_follows` | User → user-author follows | Junction |
| `meal_plans` | Per-user meal plan | JSON blob (Phase 0) |
| `nutrition_journals` | Per-user food diary | JSON blob (Phase 0) |
| `shopping_lists` | Per-user shopping list | JSON blob (Phase 0) |
| `promo_codes` | Promotional codes | Relational |
| `promo_redemptions` | Code redemption audit log | Relational |
| `recipe_plan_add_events` | Plan-add analytics events | Append-only log |
| `creator_publish_notifications` | Publish notification inbox | Relational |
| `app_notifications` | General notification inbox | Relational |
| `user_favorite_foods` | Starred meals for one-tap re-log (Quick add Favourites tab) | Relational |
| `user_saved_meals` | User-defined meal combos (e.g. "My usual breakfast") parent row | Relational |
| `user_saved_meal_items` | Child items belonging to a saved-meal combo, ordered by `position` | Relational |
| `user_custom_foods` | User-defined custom foods (e.g. homemade granola). Macros per `base_grams`, natural-portion shortcuts in `servings jsonb`, optional detailed micros (`sugar_g`, `saturated_fat_g`, `sodium_mg`), `servings_per_container`, and `barcode` for scan-same-package recall | Relational |
| `user_plan_templates` | Named reusable snapshots of a 1–7 day meal plan slice (Batch 3.10) | Relational — JSONB `slots` array |

## Key Design Decisions

### Per-serving macros on recipes table
The `recipes` table stores **per-serving** values (calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg). The UI multiplies by `servings` to show recipe totals. This matches how nutrition labels work.

### Denormalised ingredient macros
`recipe_ingredients` stores a snapshot of macros at write time. This avoids re-computing from USDA data on every read. Can be re-verified via the verify screen.

**Per-ingredient override + user-added rows (Batch 2.7):**
- `override_macros jsonb` (nullable) — when set, replaces the snapshot columns when computing recipe totals. Shape: `{ calories, protein, carbs, fat, fiber? }`. All four macros required and finite; fiber optional. Used when the USDA/OFF match is wrong and the user knows the real numbers from a label.
- `added_by_user boolean not null default false` — distinguishes rows the user added post-import (via the "+ Add ingredient" button on web `RecipeDetail` and mobile `recipe/verify.tsx`) from importer-parsed rows. Default `false` means no backfill is needed; existing rows stay classified as importer-parsed.
- Shared totaliser `src/lib/nutrition/ingredientOverrides.ts` exposes `effectiveMacros` + `recomputeRecipeTotals` so web and mobile cannot drift on override precedence. Mobile re-exports the helpers via `apps/mobile/lib/verifyRecipe.ts`.
- Overrides never affect sugar / sodium snapshots (no override surface yet) — those continue to come from the matched source.

### JSON blob tables (Phase 0)
`meal_plans`, `nutrition_journals`, `shopping_lists` each store the entire user's data in a single JSON column. **This is explicitly Phase 0** and will need row-per-entry tables before scale.

### meal_type as text array
`recipes.meal_type` is `text[]` (PostgreSQL array), not a single string. A recipe can be tagged with multiple meal types, e.g. `{lunch,dinner}`. Both `schema.sql` and all TypeScript casts reflect this as `string[]`. The `mealPlannerSlotsFromMealType()` function in `generateMealPlan.ts` handles both `string` and `string[]` defensively for backward compatibility.

### Two creator models
- `creators` — external verified creator accounts (influencers, brands)
- `profiles` used as `author_id` — community users who upload recipes

## Stored Procedures

| Function | Purpose | Security |
|----------|---------|----------|
| `redeem_promo_code(text)` | Atomically validate + redeem promo code | SECURITY DEFINER |
| `handle_new_user()` | Auto-create profile on auth signup | SECURITY DEFINER trigger |
| `notify_followers_on_recipe_publish()` | Fan out notifications on recipe publish | SECURITY DEFINER trigger |
| `public_recipe_save_count(uuid)` | Count saves without exposing individual savers | SECURITY DEFINER |
| `public_creator_follower_count(uuid)` | Count creator followers | SECURITY DEFINER |
| `public_author_follower_count(uuid)` | Count author followers | SECURITY DEFINER |
| `my_recipe_save_stats()` | Author's own recipe save counts | SECURITY DEFINER |
| `my_recipe_plan_add_stats()` | Author's own recipe plan-add counts | SECURITY DEFINER |

## Entity Relationships

```
auth.users ──── profiles
                    │
         ┌──────────┼──────────────────┐
         │          │                  │
    meal_plans  nutrition_journals  shopping_lists
    (1:1 JSON)   (1:1 JSON)        (1:1 JSON)

profiles ──< saves >── recipes ──< recipe_ingredients >── ingredients
                          │
                    ┌─────┴──────┐
                 creators    recipe_plan_add_events

profiles ──< follows >── creators
profiles ──< author_follows >── profiles  (no self-follow)

foods ──< food_sources
foods ──< barcode_mappings ──── profiles

promo_codes ──< promo_redemptions ──── auth.users
```

## Migrations

| Migration | Date | Purpose |
|-----------|------|---------|
| `20260407220000` | Apr 7 | Promo code idempotent redemption |
| `20260408143000` | Apr 8 | Micro-nutrients, verification metadata |
| `20260408170000` | Apr 8 | Unified food database (Phase 1) |
| `20260408180000` | Apr 8 | Creator social (author follows, plan events) |
| `20260409140000` | Apr 9 | Publish notifications |
| `20260409160000` | Apr 9 | App notifications inbox |
| `20260409161000` | Apr 9 | Notification seeding flag |
| `20260411180000` | Apr 11 | Recipe source attribution |
| `20260411200000` | Apr 11 | Ingredient micro-nutrients |
| `20260412100000` | Apr 12 | Onboarding profile fields |
| `20260412200000` | Apr 12 | meal_type text → text[] array |
| `20260413200000` | Apr 13 | Profile `extra_water_by_day` + `activity_burn_by_day` JSONB |
| `20260414200000` | Apr 14 | SELECT policies for `food_reports` + `recipe_plan_add_events` |
| `20260414210000` | Apr 14 | `profiles.week_start_day` — `text NOT NULL DEFAULT 'monday'` with CHECK `('monday','sunday')` |
| `20260421100000` | Apr 21 | `user_favorite_foods` — starred meals per user with RLS; unique index on `(user_id, lower(recipe_title), round(calories))` prevents dupes; no UPDATE policy (unstar + re-star to change). Types are not auto-regenerated; add manually if/when wiring generated types |
| `20260421110000` | Apr 21 | **Batch 2.5** — hydration & stimulants: adds `profiles.target_caffeine_mg` (integer default 400 — FDA upper bound), `profiles.target_alcohol_g_weekly` (integer default 0 — hidden until opted-in), `profiles.extra_caffeine_by_day` (JSONB), `profiles.extra_alcohol_g_by_day` (JSONB). Maps follow the `{YYYY-MM-DD: <number>}` pattern from `extra_water_by_day`. Types not regenerated — add manually if/when wiring. |
| `20260421120000` | Apr 21 | **Batch 2.6** — saved-meal combos: adds `user_saved_meals` (parent row with `name`, optional `default_meal_slot`, `log_count`, `last_logged_at`) and `user_saved_meal_items` (child rows keyed by `saved_meal_id`, ordered by `position`). Listing uses `(last_logged_at desc nulls last, created_at desc)` so recently re-logged combos bubble to the top. Full CRUD RLS for owner; item rows gated on parent ownership via `exists` checks. Types not regenerated — add manually if/when wiring. |
| `20260421130000` | Apr 21 | **Batch 2.7** — per-ingredient overrides + user-added rows: adds `recipe_ingredients.override_macros jsonb` (nullable; `{ calories, protein, carbs, fat, fiber? }`) and `recipe_ingredients.added_by_user boolean not null default false`. Overrides replace the matched-source snapshot columns when computing recipe totals; `added_by_user` marks rows the user inserted via "+ Add ingredient" post-import. No RLS change — existing `recipe_ingredients_write_own_recipe` policy already gates writes to the recipe owner. Types not regenerated — add manually if/when wiring. |
| `20260421150000` | Apr 21 | **Batch 3.9** — user custom foods: adds `user_custom_foods` (per-user library for homemade / local-only foods not in USDA or OFF). Macros stored per `base_grams` (default 100 — industry norm); `servings jsonb` holds an ordered array of `{label, grams}` shortcuts bounded by CHECK to 20 rows. Unique index on `(user_id, lower(name))` with client-side " (2)"…" (9)" suffix fallback. Index on `(user_id, updated_at desc)` drives the library listing. Full CRUD RLS for owner only. Types not regenerated — add manually if/when wiring. |
| `20260421170000` | Apr 21 | **Batch 4.11** — streak freeze + weekly recap: adds `profiles.streak_freeze_budget_max` (smallint default 3, CHECK 0..10 — 0 disables the feature), `profiles.streak_freezes_earned_at` (JSONB array `[{earnedAt: ISO}]` — append-only ledger of credited freezes, pruned to 90 days by `dropOldFreezesForMonth`), `profiles.streak_freezes_used_history` (JSONB array `[{dateKey, earnedAt}]` — never dropped, powers the "Freeze used (Tue)" UI), `profiles.weekly_recap_push_enabled` (boolean default true — opt-out), `profiles.weekly_recap_last_seen_week_key` (text nullable — `YYYY-Www` gate for recap card re-show). Raw streak (`computeLoggingStreak`) never overwritten — the protected value is derived in `computeProtectedStreak`. Types not regenerated — add manually if/when wiring. |

## Client-only Data (localStorage)

Some state is stored **only** in the browser's `localStorage` (`suppr-app-v1` key) and is **not** synced to Supabase. This data will be lost when the user switches devices or clears browser storage.

| Data | Key in snapshot | Cross-device? | Notes |
|------|----------------|---------------|-------|
| Named meal plan slots | `mealPlanSlots`, `activeMealPlanSlotId` | No | Only the **active** plan is synced to `meal_plans`. Other named slots and the slot index are local-only. |

> **Why not sync named slots?** Meal plan slots contain full `DayPlan[]` arrays. Syncing every slot would mean writing large JSON blobs on every change. The active plan already syncs; additional slots are a convenience feature for local experimentation.

## Generated TypeScript Types

`src/lib/supabase/database.types.ts` and `apps/mobile/lib/database.types.ts` contain auto-generated types from the remote Supabase schema (`npx supabase gen types typescript --project-id <id>`). These are **not yet wired into the client** — the generated types are missing several tables that exist in migrations but haven't been applied to the remote DB:

| Missing from generated types | Exists in |
|------------------------------|-----------|
| `author_follows` | Migration `20260408180000` |
| `recipe_plan_add_events` | Migration `20260408180000` |
| `creator_publish_notifications` | Migration `20260409140000` |
| `meal_plan_days`, `meal_plan_meals` | Migration `20260413100000` |
| `nutrition_entries` | Migration `20260413100000` |
| `shopping_items` | Migration `20260413100000` |
| `foods`, `food_sources`, `barcode_mappings` | Migration `20260408170000` |
| `food_reports` | Migration `20260408170000` |
| `profiles.target_fiber_g`, `profiles.target_water_ml` | Migration `20260412100000` |
| `profiles.tracked_macros`, `profiles.week_start_day` | Used by Settings and Today dashboard (added to generated types) |
| `profiles.target_caffeine_mg`, `profiles.target_alcohol_g_weekly`, `profiles.extra_caffeine_by_day`, `profiles.extra_alcohol_g_by_day` | Migration `20260421110000` — Batch 2.5 hydration & stimulants. `target_water_ml` and `extra_water_by_day` stay millilitres on both platforms; the `HydrationStimulantsCard` display respects `profiles.measurement_system` via the shared `formatWaterAmount` / `imperialWaterQuickAdds` helpers (audit C3 fix, 2026-04-18). |
| `user_saved_meals`, `user_saved_meal_items` | Migration `20260421120000` — Batch 2.6 saved-meal combos |
| `user_custom_foods` | Migration `20260421150000` — Batch 3.9 user-defined custom foods with multiple serving sizes. Extended by migration `20260424100000_custom_foods_servings_micros_barcode.sql` (TestFlight `AE52_fIRZ-ZIupmoJ8T4yaI`) with `servings_per_container`, `sugar_g`, `saturated_fat_g`, `sodium_mg`, and `barcode` (partial unique index on `(user_id, barcode) where barcode is not null`) — all nullable, non-negative check constraints on the numeric micros |
| `user_plan_templates` | Migration `20260421160000` — Batch 3.10 named plan templates (1–7 day slices, JSONB slots) |
| `meal_plan_days.servings_used`, `meal_plan_meals.is_leftover`, `meal_plan_meals.leftover_of_recipe_id` | Migration `20260421160000` — Batch 3.10 leftovers distribution state |
| `profiles.streak_freeze_budget_max`, `profiles.streak_freezes_earned_at`, `profiles.streak_freezes_used_history`, `profiles.weekly_recap_push_enabled`, `profiles.weekly_recap_last_seen_week_key` | Migration `20260421170000` — Batch 4.11 streak freeze + weekly recap |

**To wire up**: apply all pending migrations to the remote DB, regenerate types, then add `<Database>` generic to `createBrowserClient` and `createClient` calls.

### `user_plan_templates` (Batch 3.10)
Columns:
- `id uuid` — primary key.
- `user_id uuid` — owner; `on delete cascade` from `auth.users`.
- `name text` — 1..80 chars. Case-insensitive unique per user (`unique (user_id, lower(name))`).
- `day_count smallint` — 1..7.
- `slots jsonb` — array of `{ dayIndex, slot, recipeId?, recipeTitle, calories, protein, carbs, fat, fiberG?, servings, portionMultiplier }`. Base (per-serving) macros — the renderer scales by `portionMultiplier` on apply.
- `created_at`, `updated_at` timestamps (updated via trigger).
RLS: owner-only (auth.uid() = user_id). See `src/lib/nutrition/planTemplates.ts` for the pure helpers (`buildTemplateFromWeek`, `applyTemplateToWeek`, `validatePlanTemplate`) and `planTemplatesClient.ts` for the Supabase wrapper.

### Streak freeze ledger columns (Batch 4.11)
Columns live on `public.profiles`:
- `streak_freeze_budget_max smallint not null default 3` — CHECK `0..10`. `0` disables the feature for a user.
- `streak_freezes_earned_at jsonb not null default '[]'::jsonb` — append-only `[{earnedAt: ISO}]`. One entry per earned freeze (one per 7-day milestone). Entries older than 90 days are pruned client-side by `dropOldFreezesForMonth`.
- `streak_freezes_used_history jsonb not null default '[]'::jsonb` — `[{dateKey: "YYYY-MM-DD", earnedAt: ISO}]`. Never dropped — drives the "Freeze used (Tue)" history row on Progress.
- `weekly_recap_push_enabled boolean not null default true` — opt-out on the local Sun/Sat-18:00 push.
- `weekly_recap_last_seen_week_key text null` — `YYYY-Www` format. Gates `shouldShowRecap` — same week → card suppressed; flipped → card re-appears.

Pure helpers: `src/lib/nutrition/streakFreeze.ts` (`availableFreezes`, `computeProtectedStreak`, `earnFreezeIfMilestone`, `dropOldFreezesForMonth`, `readFreezeLedger`). Recap helpers: `src/lib/nutrition/weeklyRecap.ts` (`buildWeeklyRecap`, `weekKeyFor`, `shouldShowRecap`, `nextRecapFireDate`, `formatRecapForShare`). Both re-exported at `apps/mobile/lib/streakFreeze.ts` and `apps/mobile/lib/weeklyRecap.ts` so mobile never duplicates the logic.

### Leftovers on `meal_plan_meals` (Batch 3.10)
- `is_leftover boolean default false` — visual flag; macros are identical to the parent.
- `leftover_of_recipe_id text` — when non-null, points to the parent recipe id. Used when the user swaps a parent to cheaply locate downstream copies.
- `meal_plan_days.servings_used jsonb default '{}'` — `{recipeId: servingsConsumed}` map powering leftover math.
Shared pure helper: `src/lib/nutrition/leftoversPlanner.ts` (`distributeLeftovers`, `markLeftoversOnSwap`, `countLeftoversOfRecipe`, `moveMealInPlan`).

## Analytics event catalog (Ship L6 G1-G9, 2026-04-18)

Every event name lives in `src/lib/analytics/events.ts`. The table below locks the **mandatory enum values** for the properties product dashboards + funnels depend on. Additions are backwards-compatible — a property gaining a new enum value is additive (dashboards treat unknown values as "other"), but a rename is a breaking change and must go through a 30-day dual-emit cycle.

### `food_logged.source` enum (G1)
```
"manual"         // FoodSearch text/inline search confirm
"quick_add"      // QuickAddPanel tap (Favourite/Frequent/Recent/Eat-again)
"saved_meal"     // Re-log from My meals tab
"custom_food"    // Logged from custom food entry
"copy_meal"      // Per-meal copy flow
"duplicate_day"  // Day-level duplicate flow
"barcode"        // Barcode scanner commit
"voice"          // Voice log commit
"photo"          // AI photo log commit
"recipe"         // Logged from recipe detail / recipe mode
"planner"        // Logged from planner slot
```
Exported as `FoodLoggedSource`. Grep-level assertion at `tests/unit/foodLoggedSourceParity.test.ts` fails if any `track(AnalyticsEvents.food_logged, …)` call site drops `source`.

### `paywall_viewed.from` enum (G9)
```
"voice_log"     // Free / Base user tapped Voice on Today
"photo_log"     // Free / Base user tapped Snap on Today
"settings"      // "View plans" row in Settings / More
"onboarding"    // End-of-trial or onboarding handoff
"trial_end"     // Expired trial landing
"deep_link"     // Any other entry (fallback for unknown ?from=)
"meal_planner"  // Free user hit the Base-gated multi-day planner
```
Exported as `PaywallViewedFrom`. Mobile reads `?from=` via `useLocalSearchParams`; web via `searchParams` in the async server component. Both run the value through a shared `normalisePaywallFrom()` guard so a malformed URL never bypasses the dashboard slice.

**Full `paywall_viewed` contract (2026-04-19 round-2).** Every emit site must pass all four keys:

| key | type | values |
|---|---|---|
| `from` | `PaywallViewedFrom` | see enum above |
| `tier` | `"pro"` \| `"base"` | the tier being sold on this surface; today all three live emit sites sell Pro |
| `surface` | `"route"` \| `"promo_panel"` | `route` = full-route `/pricing` / `/paywall`; `promo_panel` = in-Settings upgrade promo (web `App.openUpgradePromo`) |
| `platform` | `"web"` \| `"ios"` \| `"android"` | web = `/pricing`, ios/android = mobile `/paywall` derived from `Platform.OS` |

Three live emit sites today: `app/pricing/page.tsx` (web, `surface: "route"`), `apps/mobile/app/paywall.tsx` (mobile, `surface: "route"`), `src/app/App.tsx` → `openUpgradePromo` (web, `surface: "promo_panel"`, debounced 500ms to collapse render-loop double-fires). A CI-time source-grep assertion in `tests/unit/analyticsEvents.test.ts` walks `src/`, `app/`, and `apps/mobile/` and fails if any `track(AnalyticsEvents.paywall_viewed, …)` / `<PageViewTracker event={AnalyticsEvents.paywall_viewed} …>` call is missing one of the four required keys.

#### Precedents (set 2026-04-19 by analytics-engineer)

**Precedent 1 — `from` vs `surface`: intent-origin vs render-context**

`from` and `surface` answer different questions and must never be conflated:

- `from` — where the user's **intent originated**: the feature or location they interacted with that caused them to end up at the paywall. This is the trigger origin.
- `surface` — where the paywall **renders**: the route or UI component that is actually displaying the paywall. This is the render context.

Example: a Free user taps the locked 7-day tile in the meal planner and is navigated to the in-Settings upgrade promo panel.
- Correct: `from: "meal_planner"`, `surface: "promo_panel"`
- Wrong: `from: "settings"` — "settings" describes where the promo panel lives, not what the user intended to do.

This distinction applies to all surface-origin events, not just `paywall_viewed`. Whenever an event has both a trigger-origin and a render-context property, `from` carries the former and `surface` carries the latter.

**Precedent 2 — `"onboarding"` vs `"trial_end"` are distinct funnel stages**

Both values appear on the `paywall_viewed.from` enum but describe fundamentally different conversion moments:

- `"onboarding"` — the first-offer moment. The user has just completed onboarding and is being shown a paid offer for the first time. They have never had paid access.
- `"trial_end"` — the conversion-or-lose moment. The user previously had paid access (for example via the 7-day free trial) and is now being shown the paywall as that access expires. They are about to lose something they have had.

These map to different funnel stages (acquisition vs retention) and must not be conflated in dashboards or A/B tests. Emitting `"onboarding"` for a trial-expiry screen, or `"trial_end"` for a first-offer screen, will corrupt both funnels.

### `empty_state_cta_clicked.surface` enum (G5)
```
"today" | "quick_add_favourites" | "quick_add_frequent" | "quick_add_recent"
"quick_add_my_meals" | "recipes_library" | "planner_weekly" | "shopping_list" | "progress"
```
Exported as `EmptyStateSurface`.

### `hydration_logged.via` + `stimulant_logged.via` enum (G6)
```
"quick_chip" | "manual"
```
Exported as `HydrationStimulantVia`. Hydration now carries `amount_ml`; stimulant carries `kind: "caffeine" | "alcohol"` + `amount_mg_or_g`. Legacy `{ type, amount, unit, preset }` retained.

### `widget_snapshot_updated.trigger` enum (G7)
```
"totals_changed" | "fast_state_changed" | "scheduled_refresh"
```
Exported as `WidgetSnapshotTrigger`. First-write after hydrate is `"scheduled_refresh"` so initial liveness pings aren't misattributed to totals.

### `recipe_ingredient_added.confidence_bucket` +
### `recipe_ingredient_overridden.confidence_bucket` +
### `recipe_ingredient_override_cleared.confidence_bucket` (G4)
```
"high" | "medium" | "low"
```
Exported as `ConfidenceBucket`. Added path reuses `classifyConfidence` from `src/lib/nutrition/aiLogging.ts` (`>=0.75 → high, >=0.5 → medium, else low`). Override + clear paths classify from `ingredient.isVerified` (true → high, false → medium), matching the UI's `<ConfidenceDot level={ing.isVerified ? "high" : "medium"} />` decision.

### `streak_reset` event (G8)
New event. Payload `{ priorStreak: number }`. Fires once per `>=1 → 0` transition of `computeProtectedStreak(...).streakLength`. Predicate: `didStreakReset(prior, current)` in `src/lib/nutrition/streakReset.ts`.

### `saved_meal_created` + `saved_meal_logged` — `savedMealId` (G3)
Both events carry `savedMealId: string` so F3 (habit loop) can join create → log without name-matching.

### `first_log_at` — person property (G2)
Not an event. Set on the first `food_logged` per user via `posthog.setPersonProperties({}, { first_log_at })` (web, `$set_once` idempotent) or `identify(distinctId, { first_log_at })` (mobile, AsyncStorage-gated). Helper: `src/lib/analytics/firstLog.ts`.

### Rename cycle (post-ship #1, 2026-04-18 → retire 2026-05-18)

Eight event names are being renamed for consistency per `docs/planning/analytics-dashboards-plan-2026-04-18.md` §4. Every legacy name continues to fire **alongside** its canonical replacement during the 30-day migration window so PostHog dashboards and funnels can be re-pointed without a reporting gap. Retirement is scheduled for 2026-05-18 — on that date, the retirement PR deletes the legacy entries from `events.ts` and every dual-emit `track()` line (grep marker in the registry: `RENAME-CYCLE-RETIRE-2026-05-18`). Payload shapes are unchanged except rename #4, which adds a `source` property on the consolidated event.

| # | Legacy name (retires 2026-05-18) | Canonical name | Payload change | Emit site(s) |
|---|---|---|---|---|
| 1 | `cook_mode_started` | `cook_mode_first_step_advanced` | none | web `CookMode.tsx` |
| 2a | `first_run_step_completed` | `onboarding_step_completed` | none | web `FirstRunChecklist.tsx` |
| 2b | `first_run_checklist_completed` | `onboarding_checklist_completed` | none | web `FirstRunChecklist.tsx` |
| 3 | `checkout_completed_return` | `checkout_completed` | none | **none today** (registry-only) |
| 4a | `recipe_import_url` | `recipe_imported` | adds `source: "url"` | web `RecipeUpload.tsx` |
| 4b | `recipe_import_image` | `recipe_imported` | adds `source: "image"` | web `RecipeUpload.tsx` |
| 5a | `voice_log_started` | `ai_voice_log_started` | none | web `voice-log-dialog.tsx`, mobile `VoiceLogSheet.tsx` |
| 5b | `voice_log_committed` | `ai_voice_log_committed` | none | web `voice-log-dialog.tsx`, mobile `VoiceLogSheet.tsx` |
| 5c | `voice_log_paywalled` | `ai_voice_log_paywalled` | none | web `NutritionTracker.tsx`, mobile `(tabs)/index.tsx` |
| 6 | `streak_freeze_earned_seen` | `streak_freeze_earned_acknowledged` | none | web `NutritionTracker.tsx`, mobile `(tabs)/index.tsx` |
| 7 | `weekly_recap_push_sent` | `weekly_recap_push_scheduled` + `weekly_recap_push_delivered` (split) | none | scheduled: mobile `(tabs)/progress.tsx`. delivered: **not yet wired** — pending `Notifications.addNotificationReceivedListener` in `apps/mobile/app/_layout.tsx`. |

Exported helper type: `RecipeImportedSource = "url" \| "image"`. Collision / drop regressions are guarded by `tests/unit/analyticsEvents.test.ts`' `rename-cycle dual-emit` `describe` block.

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [API Reference](../api/endpoints.md)
- [Security: Auth & RLS](../security/auth.md)
