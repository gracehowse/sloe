-- Security audit H4 (2026-04-21): household macro-target consent.
--
-- The GET /api/household response returned every member's
-- target_calories / protein / carbs / fat unconditionally, which leaks
-- a member's personal diet plan to everyone else in the household
-- without explicit consent. Add a per-member opt-in flag that governs
-- whether targets are exposed on the shared read path.
--
-- Default: false. Existing members must explicitly toggle share_targets
-- on before their targets show up on household views. This is more
-- conservative than default-on because a diet target is meaningfully
-- personal (goal/weight-loss context leaks downstream).

alter table public.household_members
  add column if not exists share_targets boolean not null default false;

-- RLS: members can update their own row to toggle share_targets.
-- The existing "Owner can manage members" policy already covers the
-- owner editing any row; this adds the self-update path so a non-owner
-- member can opt in / opt out without asking the owner. Scoped to the
-- caller's own membership row via with check.
drop policy if exists "Members can update own share_targets" on public.household_members;
create policy "Members can update own share_targets"
  on public.household_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
