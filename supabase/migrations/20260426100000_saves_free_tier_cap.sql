-- Server-side enforcement of the Free-tier save cap
-- ===================================================
-- Background: web (`src/context/AppDataContext.tsx#L1519-L1521`) and
-- mobile (`apps/mobile/lib/recipes.ts#L127-L134`) both gate the 11th
-- save on the client. Before this migration, a user hitting Supabase
-- directly (or a bug that bypassed the guard on one platform) could
-- exceed the cap — a monetisation leak flagged by the 2026-04-19
-- sync-enforcer sweep.
--
-- Fix path: tighten `saves_insert_own` so the RLS check additionally
-- rejects INSERTs when the authed user is on the Free tier and already
-- has `FREE_SAVE_LIMIT` saves. The limit is kept in sync with the web
-- constant in `src/context/appData/constants.ts` (FREE_SAVE_LIMIT = 10)
-- and the mobile mirror in `apps/mobile/lib/recipes.ts`.
--
-- Error handling: when the policy rejects the insert, Supabase returns
-- a 42501 / "new row violates row-level security policy" error. The
-- client save paths translate this into the same toast copy the client
-- guard already shows ("Free plan is limited to N saved recipes.")
-- — see the follow-up client changes in the same PR.

-- Drop + recreate the INSERT policy so the WITH CHECK expression
-- includes the tier / count guard.
DROP POLICY IF EXISTS "saves_insert_own" ON public.saves;

CREATE POLICY "saves_insert_own"
ON public.saves FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    -- Non-free tiers (base, pro) insert freely; a missing profile row
    -- is treated as Free so new signups are covered from day one.
    COALESCE(
      (SELECT user_tier FROM public.profiles WHERE id = auth.uid()),
      'free'
    ) <> 'free'
    OR (
      SELECT COUNT(*) FROM public.saves WHERE user_id = auth.uid()
    ) < 10
  )
);
