-- T12 — full-sweep 2026-04-24 Phase 2 condition.
--
-- Close DI-P0-01 (diversity-inclusion audit, 2026-04-19 — safety-critical):
-- Suppr surfaces no allergen information on recipes today, so a user with
-- a shellfish / nut / sesame allergy has no safety net on imported or
-- community recipes.
--
-- Policy (docs/decisions/2026-04-24-phase2-architecture-choices.md §T12):
--   - Ship v0 before any cohort expansion beyond the solo tester.
--   - 14 EU FIC + FDA regulated allergens modelled as canonical slugs.
--   - Populated by `inferAllergensFromIngredients` on recipe verify +
--     import (0.70 confidence threshold; errs toward surfacing).
--   - UI "Contains: …" callout is NEVER paywalled.
--
-- This migration adds the column and a GIN index for filter queries.
-- Defaults to `'{}'` so pre-existing recipes read as "no allergens
-- tagged" — UIs must render "Not tagged — verify ingredients" alongside
-- the Contains line when the array is empty (per the policy), because
-- an empty array is NOT a guarantee of safety.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

alter table public.recipes
  add column if not exists allergens text[] not null default '{}';

-- GIN index for filter-by-allergen queries (used by Discover filters +
-- "avoid my allergens" safety rails in future work). Ordinal btree
-- index wouldn't help on array containment operators (`@>` / `&&`).
create index if not exists recipes_allergens_gin_idx
  on public.recipes using gin (allergens);

comment on column public.recipes.allergens is
  'T12 (2026-04-24): slugs of regulated allergens detected on this recipe. Source of truth is src/constants/regulatedAllergens.ts (EU FIC + FDA). Populated by src/lib/nutrition/inferAllergens.ts at ≥0.70 match confidence. Empty array means NOT TAGGED, not SAFE — the UI must surface that caveat. Closes DI-P0-01.';
