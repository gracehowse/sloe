-- ============================================================================
-- 20260516180000_security_revoke_trigger_function_rpc_grants.sql
--
-- ENG-557 (partial) — security hardening, Phase 0 prep.
--
-- Revoke `EXECUTE` from `anon`, `authenticated`, and `PUBLIC` on SECURITY
-- DEFINER functions that exist ONLY as trigger functions — they should never
-- have been callable via `/rest/v1/rpc/<name>`.
--
-- Why this is safe
--   Postgres trigger functions are invoked by the DML statement, NOT by the
--   user. The triggering user does NOT need `EXECUTE` on the function for
--   the trigger to fire — `EXECUTE` is checked only when the function is
--   called explicitly (via SQL or PostgREST RPC). REVOKE EXECUTE removes
--   the RPC surface without touching trigger firing.
--
-- Audit before push
--   `grep -rE 'rpc\("(<each_name>)"\)' src apps scripts` — zero hits across
--   the codebase for all 7 functions. None are intended for RPC use.
--
-- Functions covered (7)
--   handle_new_user                            (trigger on auth.users)
--   notify_followers_on_recipe_publish         (trigger on recipes)
--   user_food_flags_after_change               (trigger on user_food_flags)
--   user_food_votes_recompute_counts           (trigger on user_food_votes)
--   user_foods_after_status_change             (trigger on user_foods)
--   user_foods_guard_status_transition         (trigger on user_foods)
--   user_foods_reset_verification_on_macro_edit (trigger on user_foods)
--
-- Out of scope
--   The 15 user-facing RPCs (claim_web_push_subscription, household_invite_*,
--   household_join_by_invite_code, my_recipe_*, public_*,
--   recompute_verified_food_canonical, redeem_promo_code, auth_household_ids)
--   keep their grants. Body-level authorisation review for each is tracked
--   as a follow-up to ENG-557.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_followers_on_recipe_publish()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_food_flags_after_change()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_food_votes_recompute_counts()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_foods_after_status_change()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_foods_guard_status_transition()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_foods_reset_verification_on_macro_edit() FROM PUBLIC, anon, authenticated;

COMMIT;

-- ============================================================================
-- Verification (run after push):
--   SELECT proname,
--          has_function_privilege('anon', oid, 'EXECUTE')           AS anon_can_execute,
--          has_function_privilege('authenticated', oid, 'EXECUTE')  AS auth_can_execute
--   FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE n.nspname = 'public'
--     AND p.proname IN (...above 7...)
--   ORDER BY proname;
--   -- Expect: all rows show false / false.
-- ============================================================================
