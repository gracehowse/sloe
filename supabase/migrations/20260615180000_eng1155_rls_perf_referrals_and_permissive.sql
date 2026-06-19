-- ============================================================================
-- 20260615180000_eng1155_rls_perf_referrals_and_permissive.sql
--
-- ENG-1155 — RLS performance cleanup before the 2026-07-01 viral push.
--
-- 1. Wrap the out-of-band referrals/referral_credits SELECT policies' auth.uid()
--    calls in scalar subselects so Postgres evaluates the auth helper once per
--    statement instead of once per row.
--
-- 2. Remove the live performance-advisor multiple-permissive-policy overlaps on
--    household_members, households, recipe_ingredients, and
--    verified_food_canonical without changing the authorization surface. Broad
--    FOR ALL policies are split into per-command policies, and narrower member
--    grants are folded into the relevant per-command policy instead of dropped.
--
-- Rollout: commit this migration file and have Grace run
--   supabase db push --linked
-- Do not apply via MCP apply_migration; that rewrites schema_migrations.version
-- away from the tracked filename timestamp.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part 1 — referrals / referral_credits auth init-plan wrapping
-- ---------------------------------------------------------------------------

ALTER POLICY "referrals_select_own" ON public.referrals
  USING ((SELECT auth.uid()) = referrer_id);

ALTER POLICY "referral_credits_select_own" ON public.referral_credits
  USING (((SELECT auth.uid()) = referrer_id) OR ((SELECT auth.uid()) = referee_id));

-- ---------------------------------------------------------------------------
-- Part 2a — household_members: one policy per command, preserving access
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members can read household members" ON public.household_members;
DROP POLICY IF EXISTS "Owner can manage members" ON public.household_members;
DROP POLICY IF EXISTS "Users can join households" ON public.household_members;
DROP POLICY IF EXISTS "Users can leave households" ON public.household_members;
DROP POLICY IF EXISTS "Members can update own share_targets" ON public.household_members;
DROP POLICY IF EXISTS "household_members_select_member_or_owner" ON public.household_members;
DROP POLICY IF EXISTS "household_members_insert_self_or_owner" ON public.household_members;
DROP POLICY IF EXISTS "household_members_update_self_or_owner" ON public.household_members;
DROP POLICY IF EXISTS "household_members_delete_self_or_owner" ON public.household_members;

CREATE POLICY "household_members_select_member_or_owner" ON public.household_members
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR household_id IN (SELECT public.auth_household_ids())
    OR household_id IN (
      SELECT households.id
        FROM public.households
       WHERE households.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "household_members_insert_self_or_owner" ON public.household_members
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR household_id IN (
      SELECT households.id
        FROM public.households
       WHERE households.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "household_members_update_self_or_owner" ON public.household_members
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR household_id IN (
      SELECT households.id
        FROM public.households
       WHERE households.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR household_id IN (
      SELECT households.id
        FROM public.households
       WHERE households.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "household_members_delete_self_or_owner" ON public.household_members
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR household_id IN (
      SELECT households.id
        FROM public.households
       WHERE households.owner_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Part 2b — households: split owner FOR ALL, merge owner into SELECT
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Household members can read" ON public.households;
DROP POLICY IF EXISTS "Household owner full access" ON public.households;
DROP POLICY IF EXISTS "Owners can update own household" ON public.households;
DROP POLICY IF EXISTS "households_select_member_or_owner" ON public.households;
DROP POLICY IF EXISTS "households_insert_owner" ON public.households;
DROP POLICY IF EXISTS "households_update_owner" ON public.households;
DROP POLICY IF EXISTS "households_delete_owner" ON public.households;

CREATE POLICY "households_select_member_or_owner" ON public.households
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR id IN (SELECT public.auth_household_ids())
  );

CREATE POLICY "households_insert_owner" ON public.households
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "households_update_owner" ON public.households
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "households_delete_owner" ON public.households
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- Part 2c — recipe_ingredients: keep public SELECT, split owner writes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "recipe_ingredients_write_own_recipe" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_insert_own_recipe" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_update_own_recipe" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_delete_own_recipe" ON public.recipe_ingredients;

CREATE POLICY "recipe_ingredients_insert_own_recipe" ON public.recipe_ingredients
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.recipes r
     WHERE r.id = recipe_ingredients.recipe_id
       AND r.author_id = (SELECT auth.uid())
  ));

CREATE POLICY "recipe_ingredients_update_own_recipe" ON public.recipe_ingredients
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.recipes r
     WHERE r.id = recipe_ingredients.recipe_id
       AND r.author_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.recipes r
     WHERE r.id = recipe_ingredients.recipe_id
       AND r.author_id = (SELECT auth.uid())
  ));

CREATE POLICY "recipe_ingredients_delete_own_recipe" ON public.recipe_ingredients
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.recipes r
     WHERE r.id = recipe_ingredients.recipe_id
       AND r.author_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Part 2d — verified_food_canonical: keep public SELECT, split admin writes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can upsert canonical verified foods" ON public.verified_food_canonical;
DROP POLICY IF EXISTS "verified_food_canonical_insert_admin" ON public.verified_food_canonical;
DROP POLICY IF EXISTS "verified_food_canonical_update_admin" ON public.verified_food_canonical;
DROP POLICY IF EXISTS "verified_food_canonical_delete_admin" ON public.verified_food_canonical;

CREATE POLICY "verified_food_canonical_insert_admin" ON public.verified_food_canonical
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.admin_users
     WHERE admin_users.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "verified_food_canonical_update_admin" ON public.verified_food_canonical
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.admin_users
     WHERE admin_users.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.admin_users
     WHERE admin_users.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "verified_food_canonical_delete_admin" ON public.verified_food_canonical
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.admin_users
     WHERE admin_users.user_id = (SELECT auth.uid())
  ));

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification (run manually after Grace pushes):
--
-- 1. Referrals init-plan warnings should be gone:
--    SELECT schemaname, tablename, policyname, qual
--      FROM pg_policies
--     WHERE schemaname = 'public'
--       AND tablename IN ('referrals', 'referral_credits');
--    -- Expect `( SELECT auth.uid() AS uid)` forms, not bare `auth.uid()`.
--
-- 2. Multiple permissive policy overlaps should be gone for these tables:
--    SELECT tablename, role, cmd, count(*)
--      FROM pg_policies, unnest(roles) role
--     WHERE schemaname = 'public'
--       AND permissive = 'PERMISSIVE'
--       AND tablename IN (
--         'household_members',
--         'households',
--         'recipe_ingredients',
--         'verified_food_canonical'
--       )
--     GROUP BY tablename, role, cmd
--    HAVING count(*) > 1;
--    -- Expect: 0 rows
-- ============================================================================
