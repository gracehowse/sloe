-- ENG-870 FORWARD FIX — re-establish recipe-claim RLS guards that drifted off the live DB.
--
-- WHY THIS EXISTS (migration-drift hazard):
--   `20260702120000_eng870_recipe_claim.sql` is recorded as APPLIED in
--   supabase_migrations.schema_migrations, so `supabase db push` SKIPS it. Any
--   later edit to that file (e.g. PR #592, which added the claim guards to the
--   recipes_update_own USING clause) therefore CANNOT reach the live database —
--   db push never re-runs an already-applied version.
--
--   Verified against the LIVE DB on 2026-06-23 (read-only): the live
--   `recipes_update_own` / `recipes_insert_own` policies carry NEITHER the base
--   eng870 WITH CHECK claim guards NOR PR #592's USING guards — they match the
--   older publish-tier-gate policy (USING = author_id only; WITH CHECK =
--   author_id + published/tier). The entire eng870 claim-RLS hardening is absent
--   from prod, so a recipe owner can write claimed_by / claimed_at /
--   claim_verification / content_origin='claimed' directly from the client
--   (fabricate official-creator status) OR clear existing claim state (de-claim).
--   The only trigger on public.recipes is a follower-notify (not a guard).
--
-- THE FIX:
--   This is a NEW migration version, so db push WILL run it. It DROP/CREATEs both
--   policies to the intended end state = base eng870 guards + PR #592's USING
--   hardening (claim state is server-owned; clients can neither set nor clear it).
--   Idempotent (DROP IF EXISTS), forward-only, no data change.
--
-- Stage for `supabase db push --linked`; DO NOT apply via MCP apply_migration
-- (which rewrites schema_migrations.version to NOW() and re-introduces drift).
-- After push, re-verify the live pg_policy / pg_constraint / RLS state match this file.
--
-- SCOPE (verified read-only against live 2026-06-23 — the SAME drift hit all of it):
--   1. public.recipe_claims has RLS DISABLED + anon/authenticated hold full grants
--      (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) — the audit/takedown log is world-open
--      to unauthenticated clients. (P0 — adversarial-verify lens 3, ENG-1243.)
--   2. The recipes_claimed_requires_verified_claim CHECK constraint never reached
--      prod, so RLS is the sole claim guard. (P1.)
--   3. recipes_update_own / recipes_insert_own lack the claim guards. (the original P0.)
-- Live recipes = 20 rows, all content_origin='first_party', zero claimed — so the
-- CHECK adds with no existing-row violation, and no client code touches recipe_claims
-- yet (claim flow is post-launch), so the revoke breaks nothing.
--
-- NOT in scope (separate tickets — predate eng870 / different surface):
--   - recipes.is_verified is client-settable with no server-owned gate.
--   - anon can SELECT claim columns on published recipes (read exposure).

-- 1) Lock down the claim audit/request log — server-owned, default-deny for clients.
ALTER TABLE public.recipe_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recipe_claims FROM anon, authenticated;

-- 2) Re-add the all-or-nothing integrity guard for claimed recipes (defence in depth
--    beneath RLS, for the future service-role/SECURITY DEFINER claim-write path).
ALTER TABLE public.recipes
  DROP CONSTRAINT IF EXISTS recipes_claimed_requires_verified_claim;
ALTER TABLE public.recipes
  ADD CONSTRAINT recipes_claimed_requires_verified_claim CHECK (
    content_origin <> 'claimed'
    OR (
      published IS TRUE
      AND source_url IS NOT NULL
      AND claimed_by IS NOT NULL
      AND claimed_at IS NOT NULL
      AND claim_verification IS NOT NULL
      AND (claim_verification ? 'method') IS TRUE
      AND claim_verification->>'method' IN ('oauth_handle', 'bio_code', 'dns_meta')
      AND COALESCE(claim_verification->>'source_url', '') = source_url
      AND COALESCE((claim_verification->>'attestation')::boolean, false) IS TRUE
      AND length(COALESCE(claim_verification->>'verified_at', '')) > 0
    )
  );

-- 3) recipes_update_own — block client de-claiming (USING) AND self-claiming (WITH CHECK).
-- USING gate: an owner may only target rows whose claim state is already empty —
--   so a claimed/verified recipe cannot be edited (and therefore cannot be
--   de-claimed) from a browser/mobile client.
-- WITH CHECK gate: the resulting row must remain unclaimed — so a client cannot
--   self-assert official status — plus the existing publish/tier gate.
DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
CREATE POLICY "recipes_update_own" ON public.recipes FOR UPDATE
  USING (
    auth.uid() = author_id
    AND content_origin <> 'claimed'
    AND claimed_by IS NULL
    AND claimed_at IS NULL
    AND claim_verification IS NULL
  )
  WITH CHECK (
    auth.uid() = author_id
    AND content_origin <> 'claimed'
    AND claimed_by IS NULL
    AND claimed_at IS NULL
    AND claim_verification IS NULL
    AND (
      published = false
      OR (
        is_verified = true
        AND COALESCE(
          (SELECT user_tier FROM public.profiles WHERE id = auth.uid()),
          'free'
        ) IN ('base', 'pro')
      )
    )
  );

-- recipes_insert_own — a client cannot INSERT a row that is already claimed.
DROP POLICY IF EXISTS "recipes_insert_own" ON public.recipes;
CREATE POLICY "recipes_insert_own" ON public.recipes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND content_origin <> 'claimed'
    AND claimed_by IS NULL
    AND claimed_at IS NULL
    AND claim_verification IS NULL
    AND (
      published = false
      OR COALESCE(
        (SELECT user_tier FROM public.profiles WHERE id = auth.uid()),
        'free'
      ) IN ('base', 'pro')
    )
  );
