-- 20260503112000_unpoison_seed_author_ids.sql
--
-- GW-03 / GW-04 remediation (audit 2026-04-28).
--
-- scripts/seed-discover-recipes.ts wrote SEED_AUTHOR_ID
-- (e9f85055-876b-4bde-9267-476567b16884 — Grace's TestFlight account)
-- as the author_id for 20 URL-seeded Discover rows on 2026-04-21
-- 19:57 UTC. The Library predicate `authorId === userId` then
-- classified those rows as "Imported" (each has source_url) on her
-- account, which is GW-04. The seeder used a real UUID because the
-- Discover query rejected author_id IS NULL — but author_follows is
-- now in prod and the original tombstoning blocker is resolved, so
-- the seeded rows can safely carry NULL.
--
-- This migration:
--   1. Sets author_id = NULL on every recipe whose source_url
--      matches the seed list. Identification by URL (not by
--      author_id) is intentional — it is the same canonical key
--      scripts/delete-seeded-recipes.ts uses, and it cannot
--      accidentally touch a user's genuinely-imported Instagram
--      recipe.
--   2. Logs the affected count + ids in the migration output so,
--      if reversal is ever needed, the set is recoverable from
--      Postgres logs.
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP `apply_migration` (project rule, CLAUDE.md).
--
-- Pre-flight: the client has already shipped the Discover query
-- change that drops `.not("author_id", "is", null)`. Migration
-- ordering: client → migration. The mobile build must be rebuilt
-- (TestFlight) and web auto-deployed (Vercel) before this runs.
--
-- Reversibility: the affected source URLs are listed below. To
-- restore (highly unlikely), run:
--   UPDATE recipes
--     SET author_id = 'e9f85055-876b-4bde-9267-476567b16884'
--     WHERE source_url IN (<list>);

DO $$
DECLARE
  affected_count int;
BEGIN
  WITH seed_urls AS (
    SELECT url FROM (VALUES
      ('https://cookieandkate.com/best-lentil-soup-recipe/'),
      ('https://cookieandkate.com/mediterranean-quinoa-salad/'),
      ('https://downshiftology.com/recipes/mediterranean-chickpea-salad/'),
      ('https://downshiftology.com/recipes/green-shakshuka/'),
      ('https://downshiftology.com/recipes/best-shakshuka-recipe/'),
      ('https://downshiftology.com/recipes/smoked-salmon-avocado-salad/'),
      ('https://downshiftology.com/recipes/salmon-avocado-salad/'),
      ('https://downshiftology.com/recipes/flaky-salmon-salad/'),
      ('https://downshiftology.com/recipes/green-goddess-hummus/'),
      ('https://www.halfbakedharvest.com/sheet-pan-chicken-fajitas/'),
      ('https://minimalistbaker.com/spicy-red-lentil-curry/'),
      ('https://minimalistbaker.com/sweet-potato-chickpea-buddha-bowl/'),
      ('https://minimalistbaker.com/quinoa-chickpea-buddha-bowl/'),
      ('https://minimalistbaker.com/1-pot-lentil-green-curry/'),
      ('https://minimalistbaker.com/1-pot-golden-curry-lentil-soup/'),
      ('https://pinchofyum.com/easy-red-lentil-dhal'),
      ('https://pinchofyum.com/spicy-peanut-soba-noodle-salad'),
      ('https://pinchofyum.com/one-pot-creamy-spinach-lentils'),
      ('https://pinchofyum.com/the-best-detox-crockpot-lentil-soup'),
      ('https://pinchofyum.com/smoky-red-lentil-soup-with-spinach')
    ) AS u(url)
  ),
  -- Match by source_url AND author_id (defence-in-depth: never
  -- touch a row that doesn't currently belong to the seeder).
  targets AS (
    SELECT r.id
    FROM recipes r
    WHERE r.author_id = 'e9f85055-876b-4bde-9267-476567b16884'::uuid
      AND r.source_url IN (SELECT url FROM seed_urls)
  )
  UPDATE recipes
    SET author_id = NULL
    WHERE id IN (SELECT id FROM targets);

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Unpoisoned % seeder author_id rows', affected_count;

  -- Sanity guard: if the count exceeds what the manifest implies
  -- (≤20), bail. We'd rather the migration fail than over-write.
  IF affected_count > 20 THEN
    RAISE EXCEPTION 'Refusing to update >20 rows (got %) — manifest mismatch', affected_count;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Documentation update — record the new contract.
COMMENT ON COLUMN public.recipes.author_id IS
  'NULL for platform-curated rows (onboarding seeds + URL-seeded Discover). Required for user-authored creates/imports. The Discover query MUST NOT filter author_id IS NOT NULL — see GW-03/GW-04 audit 2026-04-28 (docs/decisions/2026-04-28-gw-library-predicate-fix.md).';
