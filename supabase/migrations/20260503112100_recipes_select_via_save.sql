-- 20260503112100_recipes_select_via_save.sql
--
-- GW-01 RLS gap remediation (audit 2026-04-28).
--
-- recipes_select_published_or_own (20260419100000) blocks reads of
-- recipes that were unpublished after a user saved them, breaking
-- the F-7 contract that "saves stay visible until the user
-- unsaves". Add a second additive policy that lets a user read any
-- recipe they have a row in saves for. The policy does not leak
-- unpublished drafts globally — only the saver gets the widened
-- read.
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP `apply_migration` (project rule, CLAUDE.md).

CREATE POLICY "recipes_select_via_save" ON recipes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM saves s
      WHERE s.recipe_id = recipes.id
        AND s.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "recipes_select_via_save" ON recipes IS
  'GW-01 fix (2026-04-28): a saved recipe stays readable to the saver even after the author unpublishes. Additive to recipes_select_published_or_own.';
