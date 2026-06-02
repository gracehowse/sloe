-- ENG-557 — SECURITY DEFINER RPC hardening
-- Source: security-reviewer audit 2026-06-02 (verified against live + Supabase
-- advisor lints 0028/0029).
--
-- F2 (P1): public.recompute_verified_food_canonical(text) is SECURITY DEFINER
--   and performs privileged writes to verified_food_canonical (the trusted
--   barcode-lookup table) with NO in-body authorization check — it trusts
--   being called only from the user_foods_after_status_change trigger. But it
--   inherited the default PUBLIC EXECUTE grant, so `anon` + `authenticated`
--   could call it directly via /rest/v1/rpc (verified live 2026-06-02:
--   has_function_privilege = true for both). The prior revoke sweep
--   (20260516180000) scoped it out. Revoke EXECUTE: the trigger runs the
--   function as its own (postgres) definer, which retains EXECUTE, so the
--   trigger path is unaffected — only the exposed RPC is removed. Confirmed
--   trigger-only: no app code calls it via rpc(), only the trigger's PERFORM.
--
-- F1 (P2): public.redeem_promo_code(text) is SECURITY DEFINER and writes
--   profiles.user_tier (the entitlement column the tier-lockdown trigger
--   protects). Its search_path was `public` (no pg_temp), leaving a
--   pg_temp object-shadowing gap. Pin to `public, pg_temp`. EXECUTE stays —
--   it's an intended authenticated RPC (promo redemption).
--
-- Not in scope: F3 (save_verified_ingredients) — no such function exists in
--   pg_proc, not a live surface. F4 (pg_temp consistency tail on the auth_* /
--   public_* / my_recipe_* / user_foods_* helpers) — P3 defence-in-depth,
--   tracked as a follow-up; not bundled here to keep this change tight.

-- F2 (P1)
revoke execute on function public.recompute_verified_food_canonical(text)
  from public, anon, authenticated;

-- F1 (P2)
alter function public.redeem_promo_code(text)
  set search_path = public, pg_temp;
