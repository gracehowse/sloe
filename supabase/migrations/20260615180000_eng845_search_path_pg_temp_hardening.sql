-- ============================================================================
-- 20260615180000_eng845_search_path_pg_temp_hardening.sql
--
-- ENG-845 — [Security][P3] search_path pg_temp consistency tail (ENG-557 F4).
--
-- Defence-in-depth hardening from the ENG-557 SECURITY DEFINER RPC audit
-- (see header of 20260602120000_eng557_rpc_security_hardening.sql). The
-- remaining SECURITY DEFINER helpers below were declared with bare
-- `search_path = public` (no `pg_temp`). Pin every one to the
-- Supabase-recommended `public, pg_temp`, matching the form already used by
-- F1 (redeem_promo_code, 20260602120000) and the ENG-556 perf-pin sweep
-- (20260516150000).
--
-- Why this is pure hardening (not a live fix)
--   Every reference inside these functions is already schema-qualified
--   (`public.<table>`), so the real `pg_temp` object-shadowing injection
--   vector is already closed. Appending `pg_temp` removes the residual
--   inconsistency the advisor lints (0028 function_search_path_mutable /
--   0029) flag and guarantees a temp object can never be resolved ahead of
--   a schema-qualified one even if a future edit drops a qualifier. This is
--   ALTER ... SET search_path ONLY — it does NOT touch grants/EXECUTE.
--
-- Idempotency
--   `ALTER FUNCTION ... SET search_path` is naturally idempotent (re-running
--   re-sets the same value); safe to apply more than once. Wrapped in a
--   single transaction so the set is all-or-nothing.
--
-- Signatures
--   Confirmed by grepping the committed CREATE/CREATE OR REPLACE statements
--   in supabase/migrations/ (no live DB access; applying migrations is
--   forbidden per CLAUDE.md). Latest-definition source noted per function.
--
-- Scope guardrails (from the ticket)
--   * ALTER ... SET search_path ONLY — no REVOKE, no grant changes.
--   * Does NOT touch household_invite_* / other intended-public public_*
--     RPCs the audit assessed SAFE (authenticated/anon-executable BY DESIGN
--     with correct in-body authz). Only the 12 functions below.
--
-- Apply step (Grace runs this — Claude/MCP must NOT apply):
--   supabase db push --linked
--   then re-run the Supabase security advisor and confirm lints
--   0028/0029 are cleared for these functions.
-- ============================================================================

begin;

-- ── auth_* RLS helpers (SECURITY DEFINER, called from RLS policies) ──────────
-- auth_household_ids()          — 20260423110000_household_rls_recursion_fix.sql
-- auth_user_save_count()        — 20260520100000_saves_rls_recursion_fix.sql
-- auth_profile_user_tier()      — 20260520100000_saves_rls_recursion_fix.sql
alter function public.auth_household_ids()        set search_path = public, pg_temp;
alter function public.auth_user_save_count()      set search_path = public, pg_temp;
alter function public.auth_profile_user_tier()    set search_path = public, pg_temp;

-- ── public_* social/save stat RPCs (SECURITY DEFINER, anon+authenticated) ────
-- public_recipe_save_count(uuid)        — 20260503101000_schema_drift_repair.sql
-- public_creator_follower_count(uuid)   — 20260503101000_schema_drift_repair.sql
-- public_author_follower_count(uuid)    — 20260503101000_schema_drift_repair.sql
-- public_recipe_save_counts_batch(uuid[]) — 20260423140000_public_recipe_save_counts_batch.sql
alter function public.public_recipe_save_count(uuid)          set search_path = public, pg_temp;
alter function public.public_creator_follower_count(uuid)     set search_path = public, pg_temp;
alter function public.public_author_follower_count(uuid)      set search_path = public, pg_temp;
alter function public.public_recipe_save_counts_batch(uuid[]) set search_path = public, pg_temp;

-- ── my_recipe_* author-scoped stat RPCs (SECURITY DEFINER, authenticated) ────
-- my_recipe_save_stats()        — 20260503101000_schema_drift_repair.sql
-- my_recipe_plan_add_stats()    — 20260503101000_schema_drift_repair.sql
alter function public.my_recipe_save_stats()      set search_path = public, pg_temp;
alter function public.my_recipe_plan_add_stats()  set search_path = public, pg_temp;

-- ── user_foods_* trigger functions (SECURITY DEFINER, trigger-only) ──────────
-- All three: 20260512100000_user_foods_p0_hardening.sql
-- (EXECUTE already revoked from anon/authenticated by 20260516180000 — this
--  change is search_path only, leaving those revokes intact.)
alter function public.user_foods_guard_status_transition()          set search_path = public, pg_temp;
alter function public.user_foods_reset_verification_on_macro_edit() set search_path = public, pg_temp;
alter function public.user_foods_after_status_change()              set search_path = public, pg_temp;

commit;

-- ============================================================================
-- Verification (run after push):
--   SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
--          p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN (
--       'auth_household_ids','auth_user_save_count','auth_profile_user_tier',
--       'public_recipe_save_count','public_creator_follower_count',
--       'public_author_follower_count','public_recipe_save_counts_batch',
--       'my_recipe_save_stats','my_recipe_plan_add_stats',
--       'user_foods_guard_status_transition',
--       'user_foods_reset_verification_on_macro_edit',
--       'user_foods_after_status_change'
--     )
--   ORDER BY p.proname;
--   -- Expect every proconfig to contain: search_path=public, pg_temp
-- ============================================================================
