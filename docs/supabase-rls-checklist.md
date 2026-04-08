# Supabase RLS verification checklist

Row Level Security for Platemate is defined in [`supabase/schema.sql`](../supabase/schema.sql) and follow-on migrations under `supabase/migrations/`. Use this list before shipping auth-sensitive features or opening beta widely.

## Tables with user-scoped data

For each table below, confirm in the Supabase SQL editor (or `psql`) that **RLS is enabled** and policies match intent: users can only read/write their own rows unless the product explicitly needs public read (e.g. published recipes).

| Table | Intent |
| --- | --- |
| `profiles` | Select/insert/update own row only (`auth.uid() = id`). |
| `saves` | Own saves only (see schema / migrations). |
| `meal_plans` | One row per user; upsert keyed by `user_id`. |
| `nutrition_journals` | One row per user; journal JSON is private. |
| `shopping_lists` | One row per user. |
| `recipes` | Public select for discovery; insert/update/delete where `author_id = auth.uid()`. |
| `ingredients` / joins | Follow schema: typically service-role or controlled writes. |

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
