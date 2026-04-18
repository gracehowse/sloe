-- Batch 2.7 — per-ingredient manual overrides + user-added rows.
--
-- An imported recipe sometimes has an ingredient whose USDA/OFF match is
-- wrong, or the user knows the real macros from a packaging label and
-- wants those to replace the matched figures. `override_macros` stores a
-- jsonb `{ calories, protein, carbs, fat, fiber? }` that takes precedence
-- over the snapshot columns when computing recipe totals. We keep the
-- match metadata on the row so we don't lose provenance just because the
-- user corrected the numbers.
--
-- `added_by_user` distinguishes rows the user added post-import from
-- importer-parsed rows. Useful for analytics ("users add N ingredients
-- per imported recipe") and for showing a subtle "+ added" chip on the
-- row. Defaults to false so every existing row stays classified as
-- importer-parsed without a backfill.

alter table public.recipe_ingredients
  add column if not exists override_macros jsonb,
  add column if not exists added_by_user boolean not null default false;

-- No RLS change — existing `recipe_ingredients_write_own_recipe` policy
-- already gates inserts/updates/deletes to the recipe owner, which is
-- the only role that can legitimately set these columns.
