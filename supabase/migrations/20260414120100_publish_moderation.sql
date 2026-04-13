-- Fix is_verified default: new user-created recipes should NOT be verified until pipeline runs.
ALTER TABLE public.recipes ALTER COLUMN is_verified SET DEFAULT false;

-- Tighten SELECT policy: anonymous/public users only see published recipes.
-- Authors can always see their own (published or draft).
DROP POLICY IF EXISTS "recipes_select_public" ON public.recipes;
DROP POLICY IF EXISTS "recipes_select_published_or_own" ON public.recipes;
CREATE POLICY "recipes_select_published_or_own" ON public.recipes FOR SELECT
  USING (published = true OR auth.uid() = author_id);

-- Restrict UPDATE: authors can update their own recipes BUT cannot directly set published=true.
-- Publishing goes through a controlled path (future: Edge Function or admin review).
-- For now, allow publish only if the recipe has been verified first.
DROP POLICY IF EXISTS "recipes_update_own" ON public.recipes;
CREATE POLICY "recipes_update_own" ON public.recipes FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (
    auth.uid() = author_id
    AND (published = false OR is_verified = true)
  );
