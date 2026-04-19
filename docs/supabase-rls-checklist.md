# Supabase RLS verification checklist

Row Level Security for Suppr is defined in [`supabase/schema.sql`](../supabase/schema.sql) and follow-on migrations under `supabase/migrations/`. Use this list before shipping auth-sensitive features or opening beta widely.

## Tables with user-scoped data

For each table below, confirm in the Supabase SQL editor (or `psql`) that **RLS is enabled** and policies match intent: users can only read/write their own rows unless the product explicitly needs public read (e.g. published recipes).

| Table | Intent | Policies |
| --- | --- | --- |
| `profiles` | Select/insert/update own row only (`auth.uid() = id`); delete_own added 20260419100001 | select_own, insert_own, update_own, delete_own |
| `saves` | Own saves only | select_own, insert_own, delete_own |
| `author_follows` | Follower can read/insert/delete own follow rows only | for_all (follower_id) |
| `recipe_plan_add_events` | Own rows + recipe authors read aggregates via RPC | select_own, insert_own |
| `follows` | User↔creator follows; counts via `public_creator_follower_count` | for_all (user_id) |
| `food_reports` | Users can insert and read their own reports | select_own, insert_own |
| `meal_plans` | One row per user; upsert keyed by `user_id` | for_all (user_id) |
| `meal_plan_days` | Per-user meal plan days | for_all (user_id) |
| `meal_plan_meals` | Per-user planned meals (via meal_plan_days join) | for_all (via join) |
| `nutrition_journals` | One row per user; journal JSON is private | for_all (user_id) |
| `nutrition_entries` | Per-user nutrition log entries | for_all (user_id) |
| `shopping_lists` | One row per user | for_all (user_id) |
| `shopping_items` | Per-user shopping items | for_all (user_id) |
| `app_notifications` | User's notification inbox | select_own, update_own |
| `creator_publish_notifications` | Publish notifications (insert via trigger) | select_own, update_own |
| `recipes` | `published = true` is publicly selectable; unpublished = author-only (`recipes_select_published_or_own`, fix migration 20260419100000); insert/update/delete restricted to `author_id = auth.uid()` | select_published_or_own, insert_own, update_own, delete_own |
| `recipe_ingredients` | Public read; write via recipe author | select (public), insert/update/delete (author) |
| `foods` / `food_sources` / `barcode_mappings` | Public read; write via service role | select (public) |
| `ingredients` | Legacy food catalog; public read | select (public) |
| `user_foods` | Community barcode contributions; public read; **owner-only insert/update/delete** — UPDATE has `with check (submitted_by = auth.uid())` (added 20260425100000) so authorship can't be reassigned | select (authenticated), insert_own, update_own (with check), delete_own |
| `user_favorite_foods` / `user_saved_meals` / `user_saved_meal_items` / `user_recipe_notes` / `user_custom_foods` / `user_plan_templates` | Per-user private; full CRUD scoped to `auth.uid() = user_id` | for_all (user_id) |
| `recipe_ingredients_overrides` | Per-recipe-owner; gated by parent `recipes` author check | parent-row owner check |
| `fasting_sessions` / `caffeine_logs` / `alcohol_logs` / `streak_freeze_*` | Per-user private | for_all (user_id) |
| `households` | Owner full access + members read | owner_full_access, members_read (via `auth_household_ids()` helper) |
| `household_members` | Self-CRUD + owner manage | self_insert, self_delete, members_read, owner_manage |
| `household_meals` | Members read + creator/owner write — UPDATE has `with check` mirroring USING (added 20260425100100) so `household_id` can't be re-assigned across boundaries | members_read, members_insert, creator_or_owner_update (with check), creator_or_owner_delete |

## Quick verification queries

Run as a **normal authenticated user** (not service role) in the SQL editor with “Run as user” if available, or from the app:

1. **Policies exist**

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

2. **RLS enabled**

```sql
select relname, relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relkind = 'r'
order by relname;
```

3. **Cross-user isolation (manual)**  
   Sign in as user A, note a recipe id or profile id. Sign in as user B. Confirm B cannot select or update A’s `profiles` row, private journals, or shopping list via the client (expect empty result or RLS error).

## When adding a new table

- Enable RLS: `alter table public.my_table enable row level security;`
- Add explicit policies; avoid leaving “no policies” on tables exposed through the anon/authenticated Supabase client.
- Document whether the table is **user-private**, **public read**, or **service-role only**.

## Related

- Environment and keys: [`docs/environment.md`](environment.md)
