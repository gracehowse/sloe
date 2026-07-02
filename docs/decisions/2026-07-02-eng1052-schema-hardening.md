# ENG-1052 schema hardening batch

Date: 2026-07-02

## Decision

Ship a forward-only Supabase migration for the two SQL-backed hardening items:

1. Validate the existing `nutrition_entries_source_canonical` CHECK constraint.
2. Replace `save_verified_ingredients` with the latest ENG-1244-safe body plus:
   - `SET search_path = public, pg_temp`
   - an explicit `recipes.author_id = auth.uid()` guard that raises `42501` for non-authors

Do not ship SQL for the remaining two brief items:

- The `calories smallint -> int` finding is closed as mis-scoped. The live audit found no calorie-bearing `smallint` columns; calorie fields are already `integer` or `numeric`.
- HIBP leaked-password protection is a Supabase Auth configuration toggle, not a database migration. Grace should enable it in the Supabase Dashboard/Auth config after the migration is pushed.

## Rationale

The CHECK validation and RPC hardening are low-risk, schema-local changes. Replacing the RPC instead of using `ALTER FUNCTION` is intentional because the author guard must run before any recipe or ingredient writes, and the function body must keep the ENG-1244 rule that recipe-level trust columns remain server-owned.

The calorie item would be a different data-model cleanup (`numeric` to `integer` in some tables) with rounding and compatibility implications, not the smallint overflow fix described in the launch audit. Folding that into this batch would increase risk without fixing a real overflow bug.

## Apply and verify

Apply only with `supabase db push --linked`; do not use MCP `apply_migration` or Dashboard "Save as migration" because those can create migration timestamp drift.

Before pushing live, re-run the source audit:

```sql
select distinct source
from public.nutrition_entries
where source is not null
order by source;
```

After pushing, verify:

```sql
select convalidated
from pg_constraint
where conname = 'nutrition_entries_source_canonical';

select prosecdef, proconfig
from pg_proc
where proname = 'save_verified_ingredients';
```

Expected results: `convalidated = true`, `prosecdef = false`, and `proconfig` includes `search_path=public, pg_temp`. Also confirm a non-author call to `save_verified_ingredients` raises SQLSTATE `42501`, and confirm the Supabase security advisor no longer reports mutable `search_path` for this function. The HIBP advisor warning clears only after the dashboard/Auth config toggle is enabled.
