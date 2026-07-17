-- ENG-1398 (SEC-10) — narrow user_food_votes SELECT to own rows only.
--
-- `public.user_food_votes` has been fully readable by ANY authenticated user
-- since its creation (20260414200001_user_foods_verification.sql):
--
--   create policy "Authenticated users can read votes"
--     on public.user_food_votes for select
--     to authenticated using (true);
--
-- That exposes `voter_id` — who voted on what — to every authenticated user,
-- not just the voter. Nothing in the app needs this: aggregate tallies are
-- served from the denormalised `user_foods.upvotes` / `.downvotes` columns
-- (kept in sync by the `security definer` trigger
-- `user_food_votes_recompute_counts`, which bypasses RLS for its own
-- aggregation queries and is unaffected by this change). No API route or
-- client reads `user_food_votes` for anything other than a user's own vote
-- state / cascade-delete on account removal.
--
-- Fix: replace the blanket `using (true)` with an own-rows-only check,
-- matching the existing insert/update/delete policies on this same table.

drop policy if exists "Authenticated users can read votes" on public.user_food_votes;

create policy "Users can read own votes"
  on public.user_food_votes for select
  to authenticated using (voter_id = (select auth.uid()));

NOTIFY pgrst, 'reload schema';
