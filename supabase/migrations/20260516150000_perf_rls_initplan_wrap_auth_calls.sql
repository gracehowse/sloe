-- ============================================================================
-- 20260516150000_perf_rls_initplan_wrap_auth_calls.sql
--
-- ENG-553 + ENG-556 — Phase 0 scaling prep for the 2026-07-01 viral push.
--
-- Two distinct fixes bundled because both are pure DDL with zero behavioural
-- change and benefit from a single migration push:
--
-- 1. RLS init-plan sweep (ENG-553):
--    Wrap every `auth.uid()` / `auth.jwt()` call inside RLS policies in a
--    scalar subquery — `(SELECT auth.uid())` — so the Postgres planner
--    evaluates the auth call ONCE per query instead of ONCE PER ROW.
--    Source: Supabase performance advisor 2026-05-16 — 103 warnings.
--    Affects: 99 policies across 32 tables.
--
-- 2. search_path lockdown (ENG-556):
--    Pin `search_path = public, pg_temp` on 5 functions flagged with mutable
--    search_path. Defence-in-depth against search-path injection.
--    Source: Supabase security advisor 2026-05-16 — 5 warnings.
--
-- Semantic equivalence:
--   - `(SELECT auth.uid()) = user_id` evaluates the SELECT once, caches it,
--     compares against user_id row-by-row. Identical authorisation outcome to
--     `auth.uid() = user_id`.
--   - All `WITH CHECK` clauses transformed identically.
--
-- Rollback: revert this migration. The old policies will return; no data
-- changes occur. (`ALTER POLICY` can revert with the original expressions.)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Part 1 — RLS init-plan sweep (99 policies)
-- Grouped alphabetically by table for readability.
-- ---------------------------------------------------------------------------

-- admin_users
ALTER POLICY "Users can read their own admin_users row" ON public.admin_users
  USING (user_id = (SELECT auth.uid()));

-- app_notifications
ALTER POLICY "app_notifications_delete_own" ON public.app_notifications
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "app_notifications_insert_own" ON public.app_notifications
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "app_notifications_select_own" ON public.app_notifications
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "app_notifications_update_own" ON public.app_notifications
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- author_follows
ALTER POLICY "author_follows_delete_own" ON public.author_follows
  USING ((SELECT auth.uid()) = follower_id);
ALTER POLICY "author_follows_insert_own" ON public.author_follows
  WITH CHECK ((SELECT auth.uid()) = follower_id);
ALTER POLICY "author_follows_select_own" ON public.author_follows
  USING ((SELECT auth.uid()) = follower_id);

-- barcode_mappings
ALTER POLICY "barcode_mappings_update_own" ON public.barcode_mappings
  USING ((SELECT auth.uid()) = created_by)
  WITH CHECK ((SELECT auth.uid()) = created_by);
ALTER POLICY "barcode_mappings_write_own" ON public.barcode_mappings
  WITH CHECK ((SELECT auth.uid()) = created_by);

-- creator_publish_notifications
ALTER POLICY "creator_publish_notifications_select_own" ON public.creator_publish_notifications
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "creator_publish_notifications_update_own" ON public.creator_publish_notifications
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- daily_targets
ALTER POLICY "Users can insert own daily targets" ON public.daily_targets
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own daily targets" ON public.daily_targets
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own daily targets" ON public.daily_targets
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- deleted_health_samples
ALTER POLICY "deleted_health_samples_delete_own" ON public.deleted_health_samples
  USING (user_id = (SELECT auth.uid()));
ALTER POLICY "deleted_health_samples_insert_own" ON public.deleted_health_samples
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "deleted_health_samples_select_own" ON public.deleted_health_samples
  USING (user_id = (SELECT auth.uid()));

-- follows
ALTER POLICY "follows_delete_own" ON public.follows
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "follows_insert_own" ON public.follows
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "follows_select_own" ON public.follows
  USING ((SELECT auth.uid()) = user_id);

-- food_reports
ALTER POLICY "food_reports_insert_own" ON public.food_reports
  WITH CHECK ((SELECT auth.uid()) = reporter_id);
ALTER POLICY "food_reports_select_own" ON public.food_reports
  USING ((SELECT auth.uid()) = reporter_id);

-- goal_history
ALTER POLICY "goal_history_insert_own" ON public.goal_history
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "goal_history_select_own" ON public.goal_history
  USING ((SELECT auth.uid()) = user_id);

-- health_snapshots
ALTER POLICY "health_snapshots_owner_insert" ON public.health_snapshots
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "health_snapshots_owner_select" ON public.health_snapshots
  USING ((SELECT auth.uid()) = user_id);

-- household_invites
ALTER POLICY "invitee reads invites for their email" ON public.household_invites
  USING (lower(invitee_email) = lower(COALESCE(((SELECT auth.jwt()) ->> 'email'::text), ''::text)));
ALTER POLICY "owner reads household invites" ON public.household_invites
  USING (household_id IN (
    SELECT households.id
      FROM households
     WHERE (households.owner_id = (SELECT auth.uid()))
  ));

-- household_meals
ALTER POLICY "Creator or owner can delete meals" ON public.household_meals
  USING (
    (added_by = (SELECT auth.uid()))
    OR (household_id IN (
      SELECT households.id
        FROM households
       WHERE (households.owner_id = (SELECT auth.uid()))
    ))
  );
ALTER POLICY "Creator or owner can update meals" ON public.household_meals
  USING (
    (added_by = (SELECT auth.uid()))
    OR (household_id IN (
      SELECT households.id
        FROM households
       WHERE (households.owner_id = (SELECT auth.uid()))
    ))
  )
  WITH CHECK (
    (added_by = (SELECT auth.uid()))
    AND (household_id IN (SELECT auth_household_ids() AS auth_household_ids))
  );
ALTER POLICY "Members can add household meals" ON public.household_meals
  WITH CHECK (
    (household_id IN (SELECT auth_household_ids() AS auth_household_ids))
    AND (added_by = (SELECT auth.uid()))
  );

-- household_members
ALTER POLICY "Members can read household members" ON public.household_members
  USING (
    (user_id = (SELECT auth.uid()))
    OR (household_id IN (SELECT auth_household_ids() AS auth_household_ids))
  );
ALTER POLICY "Members can update own share_targets" ON public.household_members
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "Owner can manage members" ON public.household_members
  USING (household_id IN (
    SELECT households.id
      FROM households
     WHERE (households.owner_id = (SELECT auth.uid()))
  ))
  WITH CHECK (household_id IN (
    SELECT households.id
      FROM households
     WHERE (households.owner_id = (SELECT auth.uid()))
  ));
ALTER POLICY "Users can join households" ON public.household_members
  WITH CHECK (user_id = (SELECT auth.uid()));
ALTER POLICY "Users can leave households" ON public.household_members
  USING (user_id = (SELECT auth.uid()));

-- households
ALTER POLICY "Household members can read" ON public.households
  USING (
    (owner_id = (SELECT auth.uid()))
    OR (id IN (SELECT auth_household_ids() AS auth_household_ids))
  );
ALTER POLICY "Household owner full access" ON public.households
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
ALTER POLICY "Owners can update own household" ON public.households
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

-- meal_plan_days
ALTER POLICY "Own plan days" ON public.meal_plan_days
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- meal_plan_meals
ALTER POLICY "Own plan meals" ON public.meal_plan_meals
  USING (EXISTS (
    SELECT 1
      FROM meal_plan_days d
     WHERE ((d.id = meal_plan_meals.plan_day_id) AND (d.user_id = (SELECT auth.uid())))
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM meal_plan_days d
     WHERE ((d.id = meal_plan_meals.plan_day_id) AND (d.user_id = (SELECT auth.uid())))
  ));

-- nutrition_entries
ALTER POLICY "Own nutrition entries" ON public.nutrition_entries
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- profiles
ALTER POLICY "profiles_delete_own" ON public.profiles
  USING ((SELECT auth.uid()) = id);
ALTER POLICY "profiles_insert_own" ON public.profiles
  WITH CHECK ((SELECT auth.uid()) = id);
ALTER POLICY "profiles_select_own" ON public.profiles
  USING ((SELECT auth.uid()) = id);
ALTER POLICY "profiles_update_own" ON public.profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- promo_codes
ALTER POLICY "promo_codes_select_own_redemptions" ON public.promo_codes
  USING (EXISTS (
    SELECT 1
      FROM promo_redemptions r
     WHERE ((r.promo_code_id = promo_codes.id) AND (r.user_id = (SELECT auth.uid())))
  ));

-- promo_redemptions
ALTER POLICY "promo_redemptions_select_own" ON public.promo_redemptions
  USING ((SELECT auth.uid()) = user_id);

-- recipe_cook_history
ALTER POLICY "recipe_cook_history_owner_delete" ON public.recipe_cook_history
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "recipe_cook_history_owner_insert" ON public.recipe_cook_history
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "recipe_cook_history_owner_select" ON public.recipe_cook_history
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "recipe_cook_history_owner_update" ON public.recipe_cook_history
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- recipe_ingredients
ALTER POLICY "recipe_ingredients_write_own_recipe" ON public.recipe_ingredients
  USING (EXISTS (
    SELECT 1
      FROM recipes r
     WHERE ((r.id = recipe_ingredients.recipe_id) AND (r.author_id = (SELECT auth.uid())))
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM recipes r
     WHERE ((r.id = recipe_ingredients.recipe_id) AND (r.author_id = (SELECT auth.uid())))
  ));

-- recipe_plan_add_events
ALTER POLICY "recipe_plan_add_events_insert_own" ON public.recipe_plan_add_events
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "recipe_plan_add_events_select_own" ON public.recipe_plan_add_events
  USING ((SELECT auth.uid()) = user_id);

-- recipes
ALTER POLICY "recipes_delete_own" ON public.recipes
  USING ((SELECT auth.uid()) = author_id);
ALTER POLICY "recipes_insert_own" ON public.recipes
  WITH CHECK (
    ((SELECT auth.uid()) = author_id)
    AND (
      (published = false)
      OR (COALESCE((
        SELECT profiles.user_tier
          FROM profiles
         WHERE (profiles.id = (SELECT auth.uid()))
      ), 'free'::text) = ANY (ARRAY['base'::text, 'pro'::text]))
    )
  );
ALTER POLICY "recipes_select_published_or_own" ON public.recipes
  USING ((published = true) OR ((SELECT auth.uid()) = author_id));
ALTER POLICY "recipes_select_via_save" ON public.recipes
  USING (EXISTS (
    SELECT 1
      FROM saves s
     WHERE ((s.recipe_id = recipes.id) AND (s.user_id = (SELECT auth.uid())))
  ));
ALTER POLICY "recipes_update_own" ON public.recipes
  USING ((SELECT auth.uid()) = author_id)
  WITH CHECK (
    ((SELECT auth.uid()) = author_id)
    AND (
      (published = false)
      OR (
        (is_verified = true)
        AND (COALESCE((
          SELECT profiles.user_tier
            FROM profiles
           WHERE (profiles.id = (SELECT auth.uid()))
        ), 'free'::text) = ANY (ARRAY['base'::text, 'pro'::text]))
      )
    )
  );

-- saves
ALTER POLICY "saves_delete_own" ON public.saves
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "saves_insert_own" ON public.saves
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (
      (COALESCE((
        SELECT profiles.user_tier
          FROM profiles
         WHERE (profiles.id = (SELECT auth.uid()))
      ), 'free'::text) <> 'free'::text)
      OR ((
        SELECT count(*) AS count
          FROM saves saves_1
         WHERE (saves_1.user_id = (SELECT auth.uid()))
      ) < 10)
    )
  );
ALTER POLICY "saves_select_own" ON public.saves
  USING ((SELECT auth.uid()) = user_id);

-- shopping_items
ALTER POLICY "household_shopping_delete" ON public.shopping_items
  USING (
    ((household_id IS NULL) AND (user_id = (SELECT auth.uid())))
    OR ((household_id IS NOT NULL) AND (household_id IN (SELECT auth_household_ids() AS auth_household_ids)))
  );
ALTER POLICY "household_shopping_insert" ON public.shopping_items
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    AND ((household_id IS NULL) OR (household_id IN (SELECT auth_household_ids() AS auth_household_ids)))
  );
ALTER POLICY "household_shopping_select" ON public.shopping_items
  USING (
    ((household_id IS NULL) AND (user_id = (SELECT auth.uid())))
    OR ((household_id IS NOT NULL) AND (household_id IN (SELECT auth_household_ids() AS auth_household_ids)))
  );
ALTER POLICY "household_shopping_update" ON public.shopping_items
  USING (
    ((household_id IS NULL) AND (user_id = (SELECT auth.uid())))
    OR ((household_id IS NOT NULL) AND (household_id IN (SELECT auth_household_ids() AS auth_household_ids)))
  )
  WITH CHECK (
    ((household_id IS NULL) AND (user_id = (SELECT auth.uid())))
    OR ((household_id IS NOT NULL) AND (household_id IN (SELECT auth_household_ids() AS auth_household_ids)))
  );

-- user_custom_foods
ALTER POLICY "Users can delete own custom foods" ON public.user_custom_foods
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own custom foods" ON public.user_custom_foods
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own custom foods" ON public.user_custom_foods
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own custom foods" ON public.user_custom_foods
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- user_favorite_foods
ALTER POLICY "Users can delete own favorite foods" ON public.user_favorite_foods
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own favorite foods" ON public.user_favorite_foods
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own favorite foods" ON public.user_favorite_foods
  USING ((SELECT auth.uid()) = user_id);

-- user_food_flags
ALTER POLICY "Users can delete their own flags" ON public.user_food_flags
  USING (flagger_id = (SELECT auth.uid()));
ALTER POLICY "Users can insert their own flags" ON public.user_food_flags
  WITH CHECK (flagger_id = (SELECT auth.uid()));
ALTER POLICY "Users can read their own flags" ON public.user_food_flags
  USING (flagger_id = (SELECT auth.uid()));

-- user_food_votes
ALTER POLICY "Users can delete own votes" ON public.user_food_votes
  USING (voter_id = (SELECT auth.uid()));
ALTER POLICY "Users can insert own votes" ON public.user_food_votes
  WITH CHECK (voter_id = (SELECT auth.uid()));
ALTER POLICY "Users can update own votes" ON public.user_food_votes
  USING (voter_id = (SELECT auth.uid()));

-- user_foods
ALTER POLICY "Authenticated users can read verified or own user foods" ON public.user_foods
  USING ((verification_status = 'verified'::text) OR (submitted_by = (SELECT auth.uid())));
ALTER POLICY "Users can delete own user foods" ON public.user_foods
  USING (submitted_by = (SELECT auth.uid()));
ALTER POLICY "Users can insert user foods" ON public.user_foods
  WITH CHECK (submitted_by = (SELECT auth.uid()));
ALTER POLICY "Users can update own user foods" ON public.user_foods
  USING (submitted_by = (SELECT auth.uid()))
  WITH CHECK (submitted_by = (SELECT auth.uid()));

-- user_plan_templates
ALTER POLICY "Own plan templates" ON public.user_plan_templates
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- user_recipe_notes
ALTER POLICY "Users can delete own recipe notes" ON public.user_recipe_notes
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own recipe notes" ON public.user_recipe_notes
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own recipe notes" ON public.user_recipe_notes
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own recipe notes" ON public.user_recipe_notes
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- user_saved_meal_items
ALTER POLICY "Users can delete items of own saved meals" ON public.user_saved_meal_items
  USING (EXISTS (
    SELECT 1
      FROM user_saved_meals m
     WHERE ((m.id = user_saved_meal_items.saved_meal_id) AND (m.user_id = (SELECT auth.uid())))
  ));
ALTER POLICY "Users can insert items into own saved meals" ON public.user_saved_meal_items
  WITH CHECK (EXISTS (
    SELECT 1
      FROM user_saved_meals m
     WHERE ((m.id = user_saved_meal_items.saved_meal_id) AND (m.user_id = (SELECT auth.uid())))
  ));
ALTER POLICY "Users can read items of own saved meals" ON public.user_saved_meal_items
  USING (EXISTS (
    SELECT 1
      FROM user_saved_meals m
     WHERE ((m.id = user_saved_meal_items.saved_meal_id) AND (m.user_id = (SELECT auth.uid())))
  ));
ALTER POLICY "Users can update items of own saved meals" ON public.user_saved_meal_items
  USING (EXISTS (
    SELECT 1
      FROM user_saved_meals m
     WHERE ((m.id = user_saved_meal_items.saved_meal_id) AND (m.user_id = (SELECT auth.uid())))
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM user_saved_meals m
     WHERE ((m.id = user_saved_meal_items.saved_meal_id) AND (m.user_id = (SELECT auth.uid())))
  ));

-- user_saved_meals
ALTER POLICY "Users can delete own saved meals" ON public.user_saved_meals
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can insert own saved meals" ON public.user_saved_meals
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can read own saved meals" ON public.user_saved_meals
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users can update own saved meals" ON public.user_saved_meals
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- verified_food_canonical
ALTER POLICY "Admins can upsert canonical verified foods" ON public.verified_food_canonical
  USING (EXISTS (
    SELECT 1
      FROM admin_users
     WHERE (admin_users.user_id = (SELECT auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1
      FROM admin_users
     WHERE (admin_users.user_id = (SELECT auth.uid()))
  ));

-- web_push_subscriptions
ALTER POLICY "web_push_subscriptions_owner_delete" ON public.web_push_subscriptions
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "web_push_subscriptions_owner_insert" ON public.web_push_subscriptions
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "web_push_subscriptions_owner_select" ON public.web_push_subscriptions
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "web_push_subscriptions_owner_update" ON public.web_push_subscriptions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Part 2 — Pin search_path on 5 mutable-path functions (ENG-556)
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.set_user_plan_templates_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.profiles_tier_column_lockdown() SET search_path = public, pg_temp;
ALTER FUNCTION public.household_meals_immutable_attribution() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.save_meal_plan(text, date, jsonb) SET search_path = public, pg_temp;

COMMIT;

-- ============================================================================
-- Verification (run manually after push):
--   SELECT count(*) FROM pg_policies
--    WHERE schemaname = 'public'
--      AND (
--        qual ~ '(?<!\(SELECT )auth\.(uid|jwt|role)\(\)'
--        OR with_check ~ '(?<!\(SELECT )auth\.(uid|jwt|role)\(\)'
--      );
--   -- Expect: 0
--
-- Then re-run the Supabase performance advisor; auth_rls_initplan count → 0.
-- ============================================================================
