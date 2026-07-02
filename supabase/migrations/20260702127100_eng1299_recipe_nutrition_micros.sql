-- 20260702127100_eng1299_recipe_nutrition_micros.sql
--
-- ENG-1299 — recipe-import micros end-to-end.
--
-- The verify pipeline (`verifyIngredients`) now carries the full
-- micronutrient panel (saturated/mono/poly/trans fat, cholesterol,
-- potassium, calcium, iron, vitamins, …) from OFF and Premier FatSecret
-- sources, in the same canonical camelCase keys the food-log path stores
-- on `nutrition_entries.nutrition_micros`. Recipes previously had nowhere
-- to keep that panel (only columnar fiber_g / sugar_g / sodium_mg /
-- caffeine_mg / alcohol_g), so logged recipe meals rendered a sparse
-- micros panel while barcode/search food logs rendered the full one.
--
-- Two jsonb snapshots, mirroring the saved-meals pattern
-- (20260614120100_eng1106_saved_meal_items_nutrition_micros.sql):
--   recipes.nutrition_micros            — PER-SERVING aggregate panel
--   recipe_ingredients.nutrition_micros — ABSOLUTE panel at that row's
--                                         scaled gram weight (kept so
--                                         re-saves re-roll the aggregate
--                                         without re-hitting providers —
--                                         same rationale as caffeine_mg,
--                                         20260510100100)
--
-- Empty object = "no source published micros" (absent ≠ zero; values are
-- never synthesised). Keys are PARTIAL by design — a key sums only the
-- ingredient rows whose source published it, exactly like the existing
-- fiber/sugar/sodium columns.
--
-- LOCK SAFETY: ADD COLUMN with NOT NULL DEFAULT on Postgres 11+ is a
-- catalogue-only change (no table rewrite); both tables are small at this
-- scale (recipes ~hundreds, recipe_ingredients ~thousands).
--
-- Apply with: supabase db push --linked
-- DO NOT apply via MCP apply_migration (project rule, CLAUDE.md).
--
-- DOWN SQL:
--   alter table public.recipes drop column if exists nutrition_micros;
--   alter table public.recipe_ingredients drop column if exists nutrition_micros;
--   -- then re-run 20260702120400 §2 to restore the previous RPC body.

alter table public.recipes
  add column if not exists nutrition_micros jsonb not null default '{}'::jsonb;

alter table public.recipe_ingredients
  add column if not exists nutrition_micros jsonb not null default '{}'::jsonb;

comment on column public.recipes.nutrition_micros is
  'ENG-1299: per-serving micronutrient panel aggregated from verified ingredient rows (same camelCase keys as nutrition_entries.nutrition_micros). Empty object when no ingredient source published micros. Partial by design.';

comment on column public.recipe_ingredients.nutrition_micros is
  'ENG-1299: micronutrient panel for this ingredient at its scaled gram weight (same keys as nutrition_entries.nutrition_micros). Empty object when the matched source published none.';

-- Extend the atomic verify RPC (current body: 20260702120400 §2, ENG-1244)
-- so verify saves can persist the panels in the same transaction.
-- `coalesce(..., existing)` keeps older clients (payloads without the key)
-- from wiping stored micros.
create or replace function public.save_verified_ingredients(
  p_recipe_id          uuid,
  p_recipe_update      jsonb,
  p_ingredient_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_ing     jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'save_verified_ingredients: not authenticated'
      using errcode = '42501';
  end if;

  update recipes set
    calories         = (p_recipe_update->>'calories')::numeric,
    protein          = (p_recipe_update->>'protein')::numeric,
    carbs            = (p_recipe_update->>'carbs')::numeric,
    fat              = (p_recipe_update->>'fat')::numeric,
    fiber_g          = (p_recipe_update->>'fiber_g')::numeric,
    sugar_g          = (p_recipe_update->>'sugar_g')::numeric,
    sodium_mg        = (p_recipe_update->>'sodium_mg')::numeric,
    caffeine_mg      = (p_recipe_update->>'caffeine_mg')::numeric,
    alcohol_g        = (p_recipe_update->>'alcohol_g')::numeric,
    nutrition_micros = coalesce(p_recipe_update->'nutrition_micros', nutrition_micros),
    allergens        = p_recipe_update->'allergens'
  where id = p_recipe_id;

  for v_ing in select * from jsonb_array_elements(p_ingredient_updates)
  loop
    update recipe_ingredients set
      name             = v_ing->>'name',
      amount           = (v_ing->>'amount')::numeric,
      unit             = v_ing->>'unit',
      calories         = (v_ing->>'calories')::integer,
      protein          = (v_ing->>'protein')::integer,
      carbs            = (v_ing->>'carbs')::integer,
      fat              = (v_ing->>'fat')::integer,
      fiber_g          = (v_ing->>'fiber_g')::numeric,
      sugar_g          = (v_ing->>'sugar_g')::numeric,
      sodium_mg        = (v_ing->>'sodium_mg')::numeric,
      caffeine_mg      = (v_ing->>'caffeine_mg')::numeric,
      alcohol_g        = (v_ing->>'alcohol_g')::numeric,
      nutrition_micros = coalesce(v_ing->'nutrition_micros', nutrition_micros),
      is_verified      = (v_ing->>'is_verified')::boolean,
      source           = v_ing->>'source',
      confidence       = (v_ing->>'confidence')::numeric,
      override_macros  = v_ing->'override_macros',
      added_by_user    = coalesce((v_ing->>'added_by_user')::boolean, false)
    where id = (v_ing->>'id')::uuid;
  end loop;
end;
$$;

grant execute on function public.save_verified_ingredients(uuid, jsonb, jsonb)
  to authenticated;

comment on function public.save_verified_ingredients is
  'ENG-673 + ENG-1108 + ENG-1244 + ENG-1299: atomic recipe verify write — totals, allergens, nutrition_micros panels, and ingredient rows in one transaction. Trust bit stays server-owned.';

-- ENG-1244 replaced the anon role's broad recipes SELECT with an explicit safe-column
-- projection; extend it with the new nutrition column (same class as
-- fiber_g / sugar_g / sodium_mg, which are already granted).
grant select (nutrition_micros) on public.recipes to anon;
