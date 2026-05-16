-- ============================================================================
-- 20260516160000_perf_fk_indexes.sql
--
-- ENG-555 — Phase 0 scaling prep for the 2026-07-01 viral push.
--
-- Add child-side indexes for 19 foreign-key constraints flagged by the
-- Supabase performance advisor (`unindexed_foreign_keys`).
--
-- Why this matters
--   Postgres does NOT auto-index the child side of a FK. Every parent-side
--   delete and every JOIN that filters by the FK column forces a seq scan
--   on the child table. Invisible at N=1; expensive at viral scale.
--
-- Naming convention
--   `<table>_<column>_idx` — matches the existing convention from
--   20260516100000_saves_user_id_index.sql.
--
-- Why not CONCURRENTLY
--   `supabase db push` wraps the migration in an implicit transaction; the
--   CLI rejects CONCURRENTLY inside a transaction block. The tables here
--   are small enough at current scale that a brief write-lock during seq-
--   scan build is acceptable. Same tradeoff as
--   20260516100000_saves_user_id_index.sql.
-- ============================================================================

-- admin_users.granted_by → auth.users
create index if not exists admin_users_granted_by_idx
  on public.admin_users (granted_by);

-- app_notifications.recipe_id → recipes
create index if not exists app_notifications_recipe_id_idx
  on public.app_notifications (recipe_id);

-- barcode_mappings.created_by → profiles
create index if not exists barcode_mappings_created_by_idx
  on public.barcode_mappings (created_by);

-- creator_publish_notifications.recipe_id → recipes
create index if not exists creator_publish_notifications_recipe_id_idx
  on public.creator_publish_notifications (recipe_id);

-- follows.creator_id → creators
create index if not exists follows_creator_id_idx
  on public.follows (creator_id);

-- food_reports.reporter_id → profiles
create index if not exists food_reports_reporter_id_idx
  on public.food_reports (reporter_id);

-- household_invites.inviter_user_id → auth.users
create index if not exists household_invites_inviter_user_id_idx
  on public.household_invites (inviter_user_id);

-- household_meals.added_by → auth.users
create index if not exists household_meals_added_by_idx
  on public.household_meals (added_by);

-- household_meals.recipe_id → recipes
create index if not exists household_meals_recipe_id_idx
  on public.household_meals (recipe_id);

-- profiles.household_id → households
create index if not exists profiles_household_id_idx
  on public.profiles (household_id);

-- promo_redemptions.promo_code_id → promo_codes
create index if not exists promo_redemptions_promo_code_id_idx
  on public.promo_redemptions (promo_code_id);

-- recipe_cook_history.recipe_id → recipes
create index if not exists recipe_cook_history_recipe_id_idx
  on public.recipe_cook_history (recipe_id);

-- recipe_ingredients.ingredient_id → ingredients
create index if not exists recipe_ingredients_ingredient_id_idx
  on public.recipe_ingredients (ingredient_id);

-- shopping_items.checked_by → auth.users
create index if not exists shopping_items_checked_by_idx
  on public.shopping_items (checked_by);

-- user_food_flags.flagger_id → auth.users
create index if not exists user_food_flags_flagger_id_idx
  on public.user_food_flags (flagger_id);

-- user_food_votes.voter_id → auth.users
create index if not exists user_food_votes_voter_id_idx
  on public.user_food_votes (voter_id);

-- user_foods.submitted_by → auth.users
create index if not exists user_foods_submitted_by_idx
  on public.user_foods (submitted_by);

-- user_foods.verified_by → auth.users
create index if not exists user_foods_verified_by_idx
  on public.user_foods (verified_by);

-- user_recipe_notes.recipe_id → recipes
create index if not exists user_recipe_notes_recipe_id_idx
  on public.user_recipe_notes (recipe_id);

-- ============================================================================
-- Verification (run manually after push):
--   See `unindexed_foreign_keys` count from `get_advisors(type=performance)`.
--   Should drop from 19 → 0.
-- ============================================================================
