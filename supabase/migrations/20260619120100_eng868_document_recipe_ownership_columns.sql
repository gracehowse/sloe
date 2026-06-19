-- ENG-868: document recipe ownership columns before claim & merge.
-- This is a schema-comment-only migration. Do not apply through Supabase MCP;
-- Grace should run `supabase db push --linked` so schema_migrations keeps the
-- file timestamp version.

COMMENT ON COLUMN public.recipes.author_id IS
  'Canonical recipe owner: FK to profiles.id for all current user-authored recipes (Plane A imports and Plane B first-party recipes). NULL only for platform-curated rows. Edit, publish, claim, and merge ownership gates must key off this column. See ENG-868.';

COMMENT ON COLUMN public.recipes.creator_id IS
  'Reserved for future verified-creator (Plane B) attribution via the creators table; NULL for all rows today — no write path exists. Canonical owner is author_id. See ENG-868.';
