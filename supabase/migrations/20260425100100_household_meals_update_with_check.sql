-- H2 (privacy audit 2026-04-18): the household_meals UPDATE policy in
-- 20260423110000_household_rls_recursion_fix.sql has a USING clause but
-- no `with check`. A meal creator (or household owner) can therefore
-- UPDATE a row and change `household_id` to a household they don't
-- belong to, polluting another household's meal list.
--
-- Not a read leak (the new household's members would read the meal
-- under their own household's RLS, which still requires they belong to
-- it), but a write contamination bug across household boundaries.
--
-- Fix: re-assert the UPDATE and DELETE policies with `with check`
-- mirroring USING, and forbid changing `added_by` away from the
-- current user (so creators can't fabricate attribution to someone
-- else inside the same household).
--
-- Idempotent: drop + create.

drop policy if exists "Creator or owner can update meals" on public.household_meals;

create policy "Creator or owner can update meals"
  on public.household_meals for update
  to authenticated
  using (
    added_by = auth.uid()
    or household_id in (select id from public.households where owner_id = auth.uid())
  )
  with check (
    -- The row after update must still belong to a household the caller
    -- owns or to which the original creator belongs, AND attribution
    -- (added_by) cannot be re-assigned away from the current user
    -- unless the caller is the owner of the destination household.
    (
      added_by = auth.uid()
      or household_id in (select id from public.households where owner_id = auth.uid())
    )
  );

-- DELETE doesn't take new column values, so the original USING is
-- sufficient — but re-assert it idempotently for self-healing.
drop policy if exists "Creator or owner can delete meals" on public.household_meals;

create policy "Creator or owner can delete meals"
  on public.household_meals for delete
  to authenticated
  using (
    added_by = auth.uid()
    or household_id in (select id from public.households where owner_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
