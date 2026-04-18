# Supabase migration drift — inventory

**Generated:** 2026-04-18 (from `supabase migration list --linked` on project **Suppr**).

Last version **applied on remote** matches local through **`20260418100000`**. Everything below has **Local** set but **Remote** empty (not recorded as applied on the linked database).

## Pending on remote (apply in this order)

| Version | Migration file |
|---------|----------------|
| `20260418120000` | `20260418120000_realtime_notification_tables.sql` |
| `20260419100000` | `20260419100000_recipes_rls_published_only.sql` |
| `20260419100001` | `20260419100001_profiles_delete_own.sql` |
| `20260419100002` | `20260419100002_nutrition_entries_user_date_index.sql` |
| `20260420100000` | `20260420100000_household_planning.sql` |
| `20260421100000` | `20260421100000_user_favorite_foods.sql` |
| `20260421110000` | `20260421110000_caffeine_alcohol_tracking.sql` |
| `20260421120000` | `20260421120000_user_saved_meals.sql` |
| `20260421130000` | `20260421130000_recipe_ingredients_overrides.sql` |
| `20260421140000` | `20260421140000_user_recipe_notes_ratings.sql` |
| `20260421150000` | `20260421150000_user_custom_foods.sql` |
| `20260421160000` | `20260421160000_plan_templates_and_leftovers.sql` |
| `20260421170000` | `20260421170000_streak_freeze_weekly_recap.sql` |
| `20260421180000` | `20260421180000_remove_all_seeded_recipes.sql` |

**Count:** 14 pending versions after `20260418100000`.

## 2026-04-18 — `db push` attempt (first blocker)

- **`supabase db push --linked`** failed on **`20260418120000`**: `relation "public.creator_publish_notifications" does not exist` when adding the table to `supabase_realtime`. Migration history on prod implied older migrations were applied, but **this table was never created** (historical drift).
- **Repo fix:** `20260418120000_realtime_notification_tables.sql` now uses **`to_regclass(...)`** so publication changes run **only if the table exists**, allowing `db push` to continue on drifted databases.
- **Prod data fix (when pooler / CLI auth is healthy):** run **`supabase/scripts/ensure_creator_publish_notifications.sql`** in the Supabase SQL editor (same as migration `20260409140000_*`), then re-run **`supabase db push --linked`**. If the CLI hits **`ECIRCUITBREAKER` / password failures**, wait several minutes and retry, or paste the script in the dashboard.
- **`20260421180000`:** deletes seeded/demo recipes by fixed UUIDs and a known seed `author_id` — review before applying on prod with real user content.

## Manual prod hotfix (already done)

- **`20260421110000` (caffeine / alcohol columns on `profiles`):** DDL was applied directly on production (see `supabase/scripts/apply_caffeine_alcohol_columns.sql`). Remote **migration history** still does **not** list `20260421110000` as applied until you reconcile (either `supabase db push` in order after prerequisites exist, or `migration repair` once the chain matches reality).

## Reconcile playbook (when you schedule this)

1. Read each migration above; drop or rewrite any that are obsolete vs current product.
2. Prefer **`supabase db push --linked`** on a maintenance window so Postgres runs migrations in order (resolve dependency errors as they appear), **or** a consolidated catch-up SQL script if push is not viable.
3. After prod schema matches, align history: **`supabase migration repair --status applied <ver> --linked`** per version you applied out-of-band (use sparingly and consistently with what actually ran).
4. Re-run **`supabase migration list --linked`** until every row has Remote populated.

## Refresh this doc

Re-run:

```bash
supabase migration list --linked
```

Paste the tail (from first empty Remote) into this file when the set changes.
