-- Household-aware shopping list (Honeydew parity, 2026-04-30)
--
-- Goal:
--   Make `shopping_items` shareable across a household. Items added /
--   checked / removed by any member propagate live to every other
--   member via Supabase real-time. The single biggest gap competitive
--   audit flagged versus Honeydew (per-user list → shared list).
--
-- Shape:
--   - Existing rows keep `user_id` + `household_id IS NULL` → unchanged
--     per-user behaviour. Backward compat without any data migration.
--   - New rows generated while the user is in a household carry
--     `household_id` (set by client). Reads filter `household_id =
--     <active>` for household users and `household_id IS NULL AND
--     user_id = me` for solo users.
--   - `checked_by` records who toggled the item last so the UI can
--     attribute checks ("Sarah checked Eggs"). Nullable for legacy
--     rows + items that have never been checked.
--
-- RLS contract:
--   - Per-user rows (household_id IS NULL): only `user_id = auth.uid()`.
--     Mirrors the legacy "Own shopping items" policy this replaces.
--   - Household rows (household_id IS NOT NULL): every member of that
--     household can SELECT / INSERT / UPDATE / DELETE. The `with check`
--     on INSERT / UPDATE forces `household_id` to a household the
--     caller belongs to (cannot stamp another household's id on a row).
--
--   `public.auth_household_ids()` (security definer helper, defined in
--   `20260423110000_household_rls_recursion_fix.sql`) is used to break
--   the policy-recursion cycle that would otherwise form between
--   `shopping_items` and `household_members`.
--
-- Real-time:
--   `shopping_items` is exposed via Supabase real-time. Clients
--   subscribe with a filter on `household_id=eq.<id>` (or
--   `user_id=eq.<id>` for solo). RLS is re-checked server-side on
--   every change-event payload, so a non-member never sees another
--   household's edits.
--
-- Idempotence:
--   Every statement uses `if not exists` / `drop policy if exists`
--   so the migration can be re-applied on a partially-applied DB.
--
-- Filename note:
--   Stamped `20260504100100_*` (not `_100000_*`) to avoid a timestamp
--   collision with a parallel branch's
--   `20260504100000_recipe_cook_history.sql`.
--
-- Apply path:
--   STAGED ONLY. Per CLAUDE.md, this file must NEVER be applied via
--   MCP `apply_migration` (rewrites schema_migrations.version to
--   wall-clock NOW() and corrupts ordering). Run instead:
--     supabase db push --linked
--   from the repo root after Grace reviews.

-- ────────── 1. Schema ──────────

alter table public.shopping_items
  add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table public.shopping_items
  add column if not exists checked_by uuid references auth.users(id) on delete set null;

alter table public.shopping_items
  add column if not exists checked_at timestamptz;

create index if not exists shopping_items_household_idx
  on public.shopping_items (household_id, created_at desc)
  where household_id is not null;

create index if not exists shopping_items_user_solo_idx
  on public.shopping_items (user_id, created_at desc)
  where household_id is null;

-- ────────── 2. RLS ──────────
--
-- Replace the legacy "Own shopping items" FOR ALL policy with four
-- explicit per-action policies that handle both the per-user and the
-- household scope. The legacy policy is dropped first (idempotent) so
-- the upgrade is clean on partially-applied databases.

drop policy if exists "Own shopping items" on public.shopping_items;
drop policy if exists "household_shopping_select" on public.shopping_items;
drop policy if exists "household_shopping_insert" on public.shopping_items;
drop policy if exists "household_shopping_update" on public.shopping_items;
drop policy if exists "household_shopping_delete" on public.shopping_items;

create policy "household_shopping_select"
  on public.shopping_items for select
  to authenticated
  using (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

create policy "household_shopping_insert"
  on public.shopping_items for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      household_id is null
      or household_id in (select public.auth_household_ids())
    )
  );

create policy "household_shopping_update"
  on public.shopping_items for update
  to authenticated
  using (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  )
  with check (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

create policy "household_shopping_delete"
  on public.shopping_items for delete
  to authenticated
  using (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

-- ────────── 3. Real-time ──────────
--
-- `supabase_realtime` publication may not exist on every fresh project
-- (the bootstrap migration on Supabase Cloud creates it). Wrap in a
-- guarded DO block so the migration is portable.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- alter publication is idempotent only across versions; guard with
    -- a check against pg_publication_tables.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'shopping_items'
    ) then
      alter publication supabase_realtime add table public.shopping_items;
    end if;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
