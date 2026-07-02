-- ============================================================================
-- 20260702126100_eng1307_rpc_execute_lockdown.sql
--
-- ENG-1307 — SECURITY DEFINER RPC review (Supabase advisor lints 0028/0029,
-- sweep 2026-07-01). Verified against the live DB read-only on 2026-07-02.
--
-- ROOT CAUSE (class of bug, not 19 separate bugs)
--   Supabase's bootstrap sets ALTER DEFAULT PRIVILEGES so every function
--   created in `public` receives explicit EXECUTE grants to anon,
--   authenticated and service_role at CREATE time — on top of Postgres's own
--   implicit PUBLIC EXECUTE default. Our migrations consistently wrote
--   `revoke all ... from public; grant ... to authenticated;`, which removes
--   the PUBLIC entry but NOT the explicit `anon=X` entry the default
--   privileges injected. Confirmed live: pg_proc.proacl carries
--   `anon=X/postgres` on every flagged function, including ones whose
--   migrations "revoked from public" (e.g. auth_household_ids,
--   redeem_referral_code). Every REVOKE below names anon explicitly, and the
--   default privileges are flipped at the end so the class of bug cannot
--   recur for future functions.
--
-- CLASSIFICATION (19 advisor-flagged fns + 1 mutable-search_path trigger fn)
--
--   A. Intentionally public (anon + authenticated BY DESIGN — keep grants,
--      document with COMMENT so the advisor finding has a recorded answer):
--        public_recipe_save_count(uuid)          — public recipe page, pre-auth
--        public_recipe_save_counts_batch(uuid[]) — Discover save counts, pre-auth
--        public_author_follower_count(uuid)      — public recipe page, pre-auth
--        public_creator_follower_count(uuid)     — public recipe page, pre-auth
--        top_creators_by_saves(integer)          — landing/discover rail, pre-auth
--      All five return aggregate counts only — no row-level or per-user data
--      crosses the definer boundary. Callers confirmed pre-auth:
--      src/app/components/RecipeDetail.tsx,
--      src/lib/recipes/fetchPublicRecipeSaveCounts.ts,
--      src/lib/discover/topCreators.ts.
--
--   B. Authed-only client RPCs (REVOKE anon; keep authenticated). Every one
--      re-verified to carry an in-body `auth.uid() is null` guard, so anon
--      execution was already inert — this removes the surface anyway:
--        redeem_promo_code(text)                    — usePromoCode / AppDataContext (authed)
--        redeem_referral_code(text)                 — post-signup redemption (authed)
--        get_or_create_referral_code()              — invite dialog/sheet (authed)
--        household_invite_send(uuid, text)          — householdClient.ts (authed)
--        household_invite_accept(uuid)              — householdClient.ts (authed)
--        household_invite_decline(uuid)             — householdClient.ts (authed)
--        household_invite_cancel(uuid)              — householdClient.ts (authed)
--        household_join_by_invite_code(text, text)  — householdClient.ts (authed)
--        claim_web_push_subscription(text,text,text,text) — webNotifications.ts (authed)
--        my_recipe_save_stats()                     — creator-stats RPC, granted
--        my_recipe_plan_add_stats()                   to authenticated by design
--                                                     (no current client caller;
--                                                     auth.uid()-scoped output)
--      No app code calls ANY of these pre-auth (rpc() call-site census
--      2026-07-02: the only pre-auth rpc callers are the class-A functions).
--
--   C. Internal RLS helpers (REVOKE anon; authenticated MUST keep EXECUTE):
--        auth_household_ids()
--        auth_profile_user_tier()
--        auth_user_save_count()
--      These are called from inside RLS policy expressions, which Postgres
--      evaluates as the QUERYING role — revoking authenticated would turn
--      every household/saves query into "permission denied for function".
--      Live policy census 2026-07-02: all referencing policies
--      (household_meals, household_members, households, shopping_items,
--      saves) are scoped `to authenticated`, so anon never evaluates them —
--      anon REVOKE is safe. Direct anon RPC leaked nothing anyway
--      (auth.uid() is null ⇒ empty/default), but the surface goes away.
--
--   D. Trigger-only function (advisor 0011 function_search_path_mutable):
--        ingredient_images_touch_updated_at()
--      Plain (non-definer) trigger fn with NO search_path pin and a live
--      PUBLIC+anon+authenticated EXECUTE grant. Body touches only NEW +
--      now(), so pin search_path = '' and revoke the RPC surface entirely
--      (trigger firing does not check the invoker's EXECUTE — precedent:
--      20260516180000_security_revoke_trigger_function_rpc_grants.sql).
--
-- Also pins the stragglers the ENG-845 sweep scoped out:
--   household_invite_* keep `extensions` (declared with it) + gain pg_temp;
--   top_creators_by_saves gains pg_temp.
--
-- Apply step (Grace runs this — Claude/MCP must NOT apply):
--   supabase db push --linked
--   then re-run the security advisor: lints 0028/0029 should clear for all
--   class B/C/D functions; class A remains flagged BY DESIGN (see COMMENTs).
-- ============================================================================

begin;

-- ── B. Authed-only client RPCs — remove the anon (and stale PUBLIC) surface ──
revoke execute on function public.redeem_promo_code(text)                                  from public, anon;
revoke execute on function public.redeem_referral_code(text)                               from public, anon;
revoke execute on function public.get_or_create_referral_code()                            from public, anon;
revoke execute on function public.household_invite_send(uuid, text)                        from public, anon;
revoke execute on function public.household_invite_accept(uuid)                            from public, anon;
revoke execute on function public.household_invite_decline(uuid)                           from public, anon;
revoke execute on function public.household_invite_cancel(uuid)                            from public, anon;
revoke execute on function public.household_join_by_invite_code(text, text)                from public, anon;
revoke execute on function public.claim_web_push_subscription(text, text, text, text)      from public, anon;
revoke execute on function public.my_recipe_save_stats()                                   from public, anon;
revoke execute on function public.my_recipe_plan_add_stats()                                from public, anon;

-- ── C. Internal RLS helpers — anon only; authenticated retained for policy
--       evaluation (see header, class C) ──────────────────────────────────────
revoke execute on function public.auth_household_ids()      from public, anon;
revoke execute on function public.auth_profile_user_tier()  from public, anon;
revoke execute on function public.auth_user_save_count()    from public, anon;

-- ── D. Trigger-only fn — no RPC surface at all + pinned search_path ──────────
revoke execute on function public.ingredient_images_touch_updated_at() from public, anon, authenticated;
alter function public.ingredient_images_touch_updated_at() set search_path = '';

-- ── search_path pins the ENG-845 sweep scoped out ────────────────────────────
alter function public.household_invite_send(uuid, text)         set search_path = public, extensions, pg_temp;
alter function public.household_invite_accept(uuid)             set search_path = public, extensions, pg_temp;
alter function public.household_invite_decline(uuid)            set search_path = public, extensions, pg_temp;
alter function public.household_invite_cancel(uuid)             set search_path = public, extensions, pg_temp;
alter function public.top_creators_by_saves(integer)            set search_path = public, pg_temp;

-- ── A. Deliberately-public aggregates — document the decision in-catalog ─────
comment on function public.public_recipe_save_count(uuid) is
  'ENG-1307: intentionally anon-executable. Aggregate save count for public recipe pages (pre-auth). No row-level or per-user data crosses the SECURITY DEFINER boundary. Advisor lint 0028 accepted by design.';
comment on function public.public_recipe_save_counts_batch(uuid[]) is
  'ENG-1307: intentionally anon-executable. Batched aggregate save counts for Discover (pre-auth). No row-level or per-user data crosses the SECURITY DEFINER boundary. Advisor lint 0028 accepted by design.';
comment on function public.public_author_follower_count(uuid) is
  'ENG-1307: intentionally anon-executable. Aggregate follower count for public recipe pages (pre-auth). No row-level or per-user data crosses the SECURITY DEFINER boundary. Advisor lint 0028 accepted by design.';
comment on function public.public_creator_follower_count(uuid) is
  'ENG-1307: intentionally anon-executable. Aggregate follower count for public recipe pages (pre-auth). No row-level or per-user data crosses the SECURITY DEFINER boundary. Advisor lint 0028 accepted by design.';
comment on function public.top_creators_by_saves(integer) is
  'ENG-1307: intentionally anon-executable. Aggregated creator rail for landing/Discover (pre-auth). Exposes only publish-worthy creator aggregates. Advisor lint 0028 accepted by design.';

-- ── Class fix: stop granting EXECUTE to anon/authenticated at CREATE time ────
-- Every intended client RPC in this repo already carries an explicit
-- `grant execute ... to authenticated` (or `to anon, authenticated`), so
-- flipping the default is fail-closed: a future migration that forgets its
-- grant breaks visibly with "permission denied", instead of silently
-- exposing a new SECURITY DEFINER function to anon.
--
-- Live pg_default_acl (verified 2026-07-02): TWO schema-scoped entries inject
-- the grants — one FOR ROLE postgres, one FOR ROLE supabase_admin. `db push`
-- connects as postgres, which cannot alter supabase_admin's entry (not a
-- member) and doesn't need to: every function in our migration lineage (and
-- Dashboard SQL editor) is created BY postgres, so the postgres entry is the
-- one that decides. FOR ROLE is explicit so this holds regardless of which
-- superuser-adjacent role runs the push. The supabase_admin entry only
-- affects Supabase-managed internals — intentionally left alone, not a gap.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- ============================================================================
-- Verification (run after push):
--   SELECT p.proname,
--          has_function_privilege('anon', p.oid, 'execute')          AS anon_exec,
--          has_function_privilege('authenticated', p.oid, 'execute') AS authed_exec,
--          p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname IN (
--     'redeem_promo_code','redeem_referral_code','get_or_create_referral_code',
--     'household_invite_send','household_invite_accept','household_invite_decline',
--     'household_invite_cancel','household_join_by_invite_code',
--     'claim_web_push_subscription','my_recipe_save_stats','my_recipe_plan_add_stats',
--     'auth_household_ids','auth_profile_user_tier','auth_user_save_count',
--     'ingredient_images_touch_updated_at',
--     'public_recipe_save_count','public_recipe_save_counts_batch',
--     'public_author_follower_count','public_creator_follower_count',
--     'top_creators_by_saves')
--   ORDER BY p.proname;
--   -- Expect: class B/C ⇒ anon_exec = false, authed_exec = true.
--   --         class D ⇒ false / false, proconfig = {search_path=""}.
--   --         class A ⇒ true / true (by design).
--   -- Then smoke: authed household/saves queries still work (class C kept
--   -- authenticated), and the public recipe page still shows counts anon.
-- ============================================================================
