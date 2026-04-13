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

## Key Design Decisions

### Per-serving macros on recipes table
The `recipes` table stores **per-serving** values (calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg). The UI multiplies by `servings` to show recipe totals. This matches how nutrition labels work.

### Denormalised ingredient macros
`recipe_ingredients` stores a snapshot of macros at write time. This avoids re-computing from USDA data on every read. Can be re-verified via the verify screen.

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

## Client-only Data (localStorage)

Some state is stored **only** in the browser's `localStorage` (`platemate-app-v1` key) and is **not** synced to Supabase. This data will be lost when the user switches devices or clears browser storage.

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

**To wire up**: apply all pending migrations to the remote DB, regenerate types, then add `<Database>` generic to `createBrowserClient` and `createClient` calls.

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [API Reference](../api/endpoints.md)
- [Security: Auth & RLS](../security/auth.md)
