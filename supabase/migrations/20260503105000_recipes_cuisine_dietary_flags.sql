-- 20260503105000_recipes_cuisine_dietary_flags.sql
--
-- B5 Phase 2b (2026-04-27) — additional filter dimensions for Discover.
--
-- Adds two columns + indexes so the Discover filter sheet can apply
-- cuisine + dietary-preset filters in one server-side IN/contains query
-- per dimension. Cook-time filtering already runs against the existing
-- `cook_time_min` column (already indexed via the inferred btree on
-- the column).
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP `apply_migration` (project rule).
--
-- Backfill notes:
--   - `cuisine` is NULL for existing rows. A one-off backfill script
--     reads `recipes.title` + `recipes.tags` against
--     `src/lib/recipes/normalizeCuisine.ts` and writes the matched
--     value. Rows the heuristic can't classify stay NULL — the
--     filter sheet treats NULL as "doesn't match any selected cuisine".
--   - `dietary_flags` is `'[]'::jsonb` for existing rows. The same
--     backfill derives flags from `recipes.tags` (high-protein,
--     vegan, vegetarian, gluten-free, etc.).
--
-- Spec: docs/specs/2026-04-27-b5-discover-phase2.md

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS cuisine        text,
  ADD COLUMN IF NOT EXISTS dietary_flags  jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.recipes.cuisine IS
  'Normalised cuisine category (italian, asian, mediterranean, mexican, indian, american, middle-eastern, other). NULL = not yet classified. B5 Phase 2b (2026-04-27).';

COMMENT ON COLUMN public.recipes.dietary_flags IS
  'JSONB array of dietary preset tags (vegan, vegetarian, gluten-free, dairy-free, high-protein, keto, paleo, low-fodmap). Empty array = no presets matched. B5 Phase 2b (2026-04-27).';

-- Btree on cuisine for IN(...) filter performance.
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON public.recipes (cuisine)
  WHERE cuisine IS NOT NULL;

-- GIN on dietary_flags so `dietary_flags @> '["high-protein"]'` is fast.
CREATE INDEX IF NOT EXISTS idx_recipes_dietary_flags ON public.recipes
  USING GIN (dietary_flags);

-- cook_time_min btree (in case it isn't already indexed).
CREATE INDEX IF NOT EXISTS idx_recipes_cook_time_min ON public.recipes (cook_time_min)
  WHERE cook_time_min IS NOT NULL;
