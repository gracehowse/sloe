# Supabase migration drift — inventory

## Status (linked project **Suppr**)

**Resolved on production (2026-04-18):** `supabase db push --linked` completed through **`20260421180000`**. **`supabase migration list --linked`** now shows **Remote** populated for every local version (no empty middle column).

**What we changed in-repo to unblock push:**

1. **`20260418120000_realtime_notification_tables.sql`** — `to_regclass(...)` guards before `ALTER PUBLICATION … ADD TABLE` (prod had missed `creator_publish_notifications` while history looked healthy).
2. **`supabase/scripts/ensure_creator_publish_notifications.sql`** — run once via `supabase db query --linked -f …` before push so the table + trigger exist.
3. **`20260419100000_recipes_rls_published_only.sql`** — `DROP POLICY IF EXISTS` for **`recipes_select_published_or_own`** before `CREATE` (policy already existed on prod).
4. **`20260420100000_household_planning.sql`** — `create extension if not exists pgcrypto` and **`encode(extensions.gen_random_bytes(6), 'hex')`** for `invite_code` (extension lived in `extensions` schema; unqualified `gen_random_bytes` failed).

**Historical capture:** first inventory commit **`d3cdc3d`**; interim notes **`61e4425`** / **`c07c667`** (known-debt docs).

---

## Previously pending (now applied on remote)

These were the gap **after `20260418100000`** before reconcile:

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

**Earlier manual hotfix:** caffeine / alcohol `profiles` columns were applied before history caught up (`supabase/scripts/apply_caffeine_alcohol_columns.sql`); migration **`20260421110000`** then ran cleanly with `IF NOT EXISTS` notices.

---

## Playbook — if drift happens again

1. **`supabase migration list --linked`** — find first row with empty **Remote**.
2. **`supabase db push --linked`** (or SQL editor for surgical fixes), fix idempotency in the failing migration file if prod already partially matches.
3. **`migration repair`** only when you applied SQL **outside** the tracked migration and need history to match.
4. Re-list until no gaps.

## Refresh

```bash
supabase migration list --linked
```
