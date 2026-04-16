-- Fix: recipes_select_public was using (true), exposing unpublished drafts
-- to all authenticated users. Restrict to published recipes + author's own.
DROP POLICY IF EXISTS "recipes_select_public" ON recipes;

CREATE POLICY "recipes_select_published_or_own" ON recipes
  FOR SELECT
  USING (published = true OR auth.uid() = author_id);
