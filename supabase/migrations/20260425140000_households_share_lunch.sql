-- F-16 — Household sharing scope narrowing (build 11).
--
-- TestFlight feedback `AJ1AeYJ--fF` (2026-04-19): "Need a way to say
-- I'm only sharing dinner or dinner and lunch for example not my whole
-- meal plan and not my macros because my husband probably has different
-- macros." Product-lead + legal-reviewer have signed off on the scope.
--
-- Binding decisions implemented here:
--   1. Dinners are shared by default. A household-level toggle extends
--      sharing to lunches. Breakfasts + snacks are never shared.
--   2. Macro targets + remaining-today numbers stop being shared with
--      other members (implemented in the client read path, not here).
--
-- This migration adds the owner-flippable column and — if missing — the
-- RLS policy that lets owners UPDATE their own household row so the new
-- toggle can actually write. Idempotent on both counts.

alter table public.households
  add column if not exists share_lunch boolean not null default false;

comment on column public.households.share_lunch is
  'Household-level toggle: when true, lunches are shared in addition to dinners. Default false so existing households narrow to dinner-only on upgrade. F-16 / AJ1AeYJ.';

-- Owner UPDATE policy. The original 20260420100000_household_planning
-- migration declared `"Household owner full access" FOR ALL` which
-- already covers UPDATE, but the SELECT membership policy and a later
-- RLS recursion-fix migration touched this surface — re-assert the
-- update policy idempotently so every prod environment ends up with
-- the same explicit grant regardless of historical drift.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'Owners can update own household'
      and tablename = 'households'
  ) then
    create policy "Owners can update own household"
      on public.households for update
      to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;
end$$;

notify pgrst, 'reload schema';
