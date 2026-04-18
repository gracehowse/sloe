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
| `user_custom_foods` | User-defined custom foods (e.g. homemade granola) with multiple named serving sizes | Relational |
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
| `user_custom_foods` | Migration `20260421150000` — Batch 3.9 user-defined custom foods with multiple serving sizes |
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

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [API Reference](../api/endpoints.md)
- [Security: Auth & RLS](../security/auth.md)
