-- Saves RLS — break infinite recursion on insert/select
--
-- Symptom (production, 2026-05):
--   `infinite recursion detected in policy for relation "saves"`
--   when syncing a saved recipe to the cloud (INSERT into `saves`).
--
-- Root cause:
--   `saves_insert_own` (20260426100000_saves_free_tier_cap.sql) counts rows
--   with `SELECT COUNT(*) FROM public.saves WHERE user_id = auth.uid()`.
--   That subquery is evaluated under RLS on `saves` while the INSERT policy
--   on `saves` is still being checked → Postgres detects a cycle.
--
-- Fix:
--   Move the tier lookup and save count into `security definer` helpers
--   (same pattern as `auth_household_ids()` in
--   20260423110000_household_rls_recursion_fix.sql). The function body
--   bypasses RLS, so the INSERT policy no longer re-enters itself.
--
-- Contract preserved:
--   Free tier: at most 10 saves per user (FREE_SAVE_LIMIT).
--   Base / Pro: unlimited saves.
--   Missing profile row → treated as free.

create or replace function public.auth_user_save_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint
  from public.saves
  where user_id = auth.uid();
$$;

create or replace function public.auth_profile_user_tier()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select user_tier from public.profiles where id = auth.uid()),
    'free'::text
  );
$$;

revoke all on function public.auth_user_save_count() from public;
revoke all on function public.auth_profile_user_tier() from public;
grant execute on function public.auth_user_save_count() to authenticated;
grant execute on function public.auth_profile_user_tier() to authenticated;

drop policy if exists "saves_insert_own" on public.saves;

create policy "saves_insert_own"
on public.saves
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    public.auth_profile_user_tier() <> 'free'::text
    or public.auth_user_save_count() < 10
  )
);

notify pgrst, 'reload schema';
