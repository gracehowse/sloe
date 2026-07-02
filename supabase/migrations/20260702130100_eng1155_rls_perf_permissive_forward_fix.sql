-- ENG-1155 FORWARD FIX — permissive RLS policy consolidation (Part 2 only).
--
-- WHY THIS EXISTS (migration-drift hazard):
--   `20260615180000_eng1155_rls_perf_referrals_and_permissive.sql` never ran on
--   prod. MCP `apply_migration` recorded `eng845_search_path_pg_temp_hardening`
--   at version 20260615180000, so `supabase db push` treats that timestamp as
--   applied and skips the ENG-1155 file forever.
--
--   Verified against the LIVE DB on 2026-07-02:
--     • Part 1 (referrals/referral_credits auth.uid() subselect wrap) — already
--       present on prod; omitted here to avoid redundant ALTER POLICY.
--     • Part 2 (household_members, households, recipe_ingredients,
--       verified_food_canonical multiple-permissive consolidation) — still on the
--       legacy policy names ("Members can read household members", etc.).
--
-- THE FIX:
--   New migration version so db push WILL run it. Idempotent DROP/CREATE only;
--   authorization surface unchanged (split broad FOR ALL into per-command policies).
--
-- Stage for `supabase db push --linked`; DO NOT apply via MCP apply_migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- household_members: one policy per command, preserving access
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
-- households: split owner FOR ALL, merge owner into SELECT
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
-- recipe_ingredients: keep public SELECT, split owner writes
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
-- verified_food_canonical: keep public SELECT, split admin writes
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
