-- H1 (privacy audit 2026-04-18): the existing UPDATE policy on
-- public.user_foods is missing `with check`, so a row owner can update
-- their own row and re-assign `submitted_by` to another user, silently
-- transferring authorship. Not a data leak (community-readable table)
-- but an integrity / attribution bug.
--
-- Fix:
--   - Re-assert the UPDATE policy with `with check (submitted_by = auth.uid())`
--     so the new row must still belong to the current user.
--   - Add an explicit DELETE policy so owners can remove their own
--     contributions (currently no DELETE policy exists, which means
--     deletes are silently denied — confusing for users who try to
--     retract a bad submission).
--
-- Idempotent: drop + create.

drop policy if exists "Users can update own user foods" on public.user_foods;

create policy "Users can update own user foods"
  on public.user_foods for update
  to authenticated
  using (submitted_by = auth.uid())
  with check (submitted_by = auth.uid());

drop policy if exists "Users can delete own user foods" on public.user_foods;

create policy "Users can delete own user foods"
  on public.user_foods for delete
  to authenticated
  using (submitted_by = auth.uid());

NOTIFY pgrst, 'reload schema';
