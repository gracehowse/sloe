-- ============================================================================
-- 20260516170000_perf_consolidate_permissive_policies.sql
--
-- ENG-554 — Phase 0 scaling prep for the 2026-07-01 viral push.
--
-- Consolidate overlapping permissive RLS policies. The Supabase performance
-- advisor flagged 20 `multiple_permissive_policies` warnings; structurally,
-- these reduce to TWO real overlap cases (the advisor inflates the count
-- per affected role exposure):
--
--   1. household_invites SELECT for `authenticated`:
--        "invitee reads invites for their email" OR "owner reads household invites"
--   2. recipes SELECT for `public`:
--        "recipes_select_published_or_own" OR "recipes_select_via_save"
--
-- Why this matters
--   Postgres evaluates EVERY permissive policy in turn and OR's the results.
--   Consolidating into a single OR'd USING expression reduces planner work
--   and removes the warning. No authorisation change — a user who could
--   read a row before still can.
--
-- Approach
--   DROP both old policies + CREATE one merged policy per case. We can't
--   ALTER POLICY into a single one (would need to keep both), so DROP+CREATE.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- household_invites: invitee match OR household owner
-- ---------------------------------------------------------------------------

DROP POLICY "invitee reads invites for their email" ON public.household_invites;
DROP POLICY "owner reads household invites" ON public.household_invites;

CREATE POLICY "household_invites_select_invitee_or_owner" ON public.household_invites
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    -- invitee match
    lower(invitee_email) = lower(COALESCE(((SELECT auth.jwt()) ->> 'email'::text), ''::text))
    OR
    -- household owner
    household_id IN (
      SELECT households.id
        FROM households
       WHERE (households.owner_id = (SELECT auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- recipes: published OR own OR saved
-- ---------------------------------------------------------------------------

DROP POLICY "recipes_select_published_or_own" ON public.recipes;
DROP POLICY "recipes_select_via_save" ON public.recipes;

CREATE POLICY "recipes_select_published_own_or_saved" ON public.recipes
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    -- published anywhere
    (published = true)
    OR
    -- own draft / unpublished
    ((SELECT auth.uid()) = author_id)
    OR
    -- saved by current user
    EXISTS (
      SELECT 1
        FROM saves s
       WHERE ((s.recipe_id = recipes.id) AND (s.user_id = (SELECT auth.uid())))
    )
  );

COMMIT;

-- ============================================================================
-- Verification (run manually after push):
--   SELECT tablename, role, cmd, count(*)
--   FROM pg_policies, unnest(roles) role
--   WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
--   GROUP BY tablename, role, cmd
--   HAVING count(*) > 1;
--   -- Expect: 0 rows
-- ============================================================================
