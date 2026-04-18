-- Household RLS — break the infinite recursion
--
-- Symptom (production, 2026-04-18):
--   `infinite recursion detected in policy for relation "household_members"`
--   on any read of household_members, households, or household_meals.
--
-- Root cause:
--   The original `20260420100000_household_planning.sql` SELECT policy on
--   `household_members` queried `household_members` directly to decide
--   visibility:
--     using (
--       household_id in (
--         select household_id from public.household_members hm
--         where hm.user_id = auth.uid()
--       )
--     )
--   The subquery is also subject to RLS on `household_members`, which
--   re-enters the same policy → Postgres detects the cycle and aborts.
--   The same pattern poisons every policy that joins via a subquery on
--   `household_members` (the SELECTs on `households` and
--   `household_meals`, and the management policies that use it).
--
-- Fix:
--   1. Add a `security definer`, `stable`, `search_path = public` helper
--      `public.auth_household_ids()` that returns the household ids the
--      caller belongs to. `security definer` bypasses RLS inside the
--      function body, so the function reads `household_members`
--      without re-triggering policies.
--   2. Rewrite every policy that previously did
--      `IN (SELECT … FROM household_members …)` to call the helper
--      instead. This removes the cycle without changing the visibility
--      contract.
--   3. Tighten `EXECUTE` to `authenticated` so the helper is never
--      callable by `anon` / `public`.
--
-- Visibility contract preserved:
--   - You can read your own household_members row.
--   - You can read other members of any household you belong to.
--   - You can read the household row(s) you belong to OR own.
--   - You can read household_meals for any household you belong to.
--   - Owner-only management on households + household_members is
--     unchanged (those policies never recursed in the first place).
--
-- Idempotence: every `drop policy if exists` + `create policy` so this
-- migration can be re-run safely on a partially-applied database.

-- ────────── 1. Helper ──────────

create or replace function public.auth_household_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid();
$$;

revoke all on function public.auth_household_ids() from public;
grant execute on function public.auth_household_ids() to authenticated;

-- ────────── 2. household_members policies (was the recursion site) ──────────

drop policy if exists "Members can read household members" on public.household_members;
create policy "Members can read household members"
  on public.household_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or household_id in (select public.auth_household_ids())
  );

-- Owner-only management — keep using `households.owner_id` (that
-- subquery hits `households` not `household_members`, no cycle).
drop policy if exists "Owner can manage members" on public.household_members;
create policy "Owner can manage members"
  on public.household_members for all
  to authenticated
  using (
    household_id in (select id from public.households where owner_id = auth.uid())
  )
  with check (
    household_id in (select id from public.households where owner_id = auth.uid())
  );

-- Self-insert / self-delete — already non-recursive (compares to
-- `auth.uid()` directly). Re-create idempotently to keep the
-- migration self-healing.
drop policy if exists "Users can join households" on public.household_members;
create policy "Users can join households"
  on public.household_members for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can leave households" on public.household_members;
create policy "Users can leave households"
  on public.household_members for delete
  to authenticated
  using (user_id = auth.uid());

-- ────────── 3. households SELECT (used the recursive subquery) ──────────

drop policy if exists "Household members can read" on public.households;
create policy "Household members can read"
  on public.households for select
  to authenticated
  using (
    owner_id = auth.uid()
    or id in (select public.auth_household_ids())
  );

-- Owner full-access policy unchanged — it only reads `households`
-- itself and uses `auth.uid()` directly. Re-asserted for safety.
drop policy if exists "Household owner full access" on public.households;
create policy "Household owner full access"
  on public.households for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ────────── 4. household_meals (also used the recursive subquery) ──────────

drop policy if exists "Members can read household meals" on public.household_meals;
create policy "Members can read household meals"
  on public.household_meals for select
  to authenticated
  using (household_id in (select public.auth_household_ids()));

drop policy if exists "Members can add household meals" on public.household_meals;
create policy "Members can add household meals"
  on public.household_meals for insert
  to authenticated
  with check (
    household_id in (select public.auth_household_ids())
    and added_by = auth.uid()
  );

drop policy if exists "Creator or owner can update meals" on public.household_meals;
create policy "Creator or owner can update meals"
  on public.household_meals for update
  to authenticated
  using (
    added_by = auth.uid()
    or household_id in (select id from public.households where owner_id = auth.uid())
  );

drop policy if exists "Creator or owner can delete meals" on public.household_meals;
create policy "Creator or owner can delete meals"
  on public.household_meals for delete
  to authenticated
  using (
    added_by = auth.uid()
    or household_id in (select id from public.households where owner_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
