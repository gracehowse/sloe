-- Server-side enforcement of the "publish recipe" tier gate
-- ==========================================================
-- Background: `src/app/components/RecipeUpload.tsx` derives
-- `isCreator = tier === "base" || tier === "pro"` on the client, but
-- `saveRecipe(true)` writes `published: true` straight to Supabase with
-- no server check. A Free user could bypass the UI (or a future bug
-- could ship without the client guard) and publish recipes publicly.
-- Flagged by the 2026-04-19 sync-enforcer sweep.
--
-- Fix path: tighten the existing `recipes_update_own` + `recipes_insert`
-- policies so `published = true` is only accepted when the authed
-- user's tier is `base` or `pro`. Non-creators can still create draft
-- recipes; only the flip-to-published step is gated.
--
-- Mobile has no publish flow today (tracked in
-- `docs/product/landing-maintenance.md`), so this purely closes the web
-- web-tier loophole. Once mobile ships a publish surface the RLS policy
-- already covers it.

-- UPDATE: keep authors-only rule, keep is_verified gate on publish,
-- AND require base/pro tier to set published=true. Drafts (published
-- stays false) continue to work for everyone.
DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
CREATE POLICY "recipes_update_own" ON public.recipes FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (
    auth.uid() = author_id
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

-- INSERT: ensure that users cannot bypass UPDATE by inserting a
-- published row directly. A published recipe must come from a creator
-- tier; non-creators can still insert drafts.
DROP POLICY IF EXISTS "recipes_insert_own" ON public.recipes;
CREATE POLICY "recipes_insert_own" ON public.recipes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      published = false
      OR COALESCE(
        (SELECT user_tier FROM public.profiles WHERE id = auth.uid()),
        'free'
      ) IN ('base', 'pro')
    )
  );
