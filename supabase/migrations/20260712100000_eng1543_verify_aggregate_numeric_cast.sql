-- ENG-1543 (2026-07-12 nutrition-trust safety pass) — re-fix the ingredient-
-- level macro casts in save_verified_ingredients that silently break every
-- web-created recipe's verify writeback.
--
-- THE BUG (confirmed against the ENG-1415 function def + the column types):
-- 20260706120000_eng1415_recipe_verified_aggregate_writeback.sql restored the
-- verify write path, but its per-ingredient UPDATE casts the FOUR macro values
-- ::integer:
--     calories = (v_ing->>'calories')::integer,
--     protein  = (v_ing->>'protein')::integer,
--     carbs    = (v_ing->>'carbs')::integer,
--     fat      = (v_ing->>'fat')::integer,
-- but recipe_ingredients.{calories,protein,carbs,fat} are NUMERIC(10,2) — they
-- were widened from integer by 20260508100000_recipes_macros_numeric.sql
-- (F-72) precisely because the product exposes 1-decimal macro precision. A
-- non-integer ingredient macro (e.g. fat 2.3 g) therefore throws
--   invalid input syntax for type integer: "2.3"
-- inside the RPC. Because the whole call is one function/transaction, that
-- error aborts the entire save_verified_ingredients write — so NO web-created
-- recipe whose ingredients carry decimal macros (the common case) can ever
-- reach verified state. The recipe-LEVEL macro casts in the same function
-- (calories/protein/carbs/fat on `recipes`, L185-188 of the ENG-1415 file)
-- were already correctly ::numeric; only the four ingredient-level casts were
-- wrong. This re-fixes ENG-1415 by matching them.
--
-- THE FIX: CREATE OR REPLACE save_verified_ingredients with the four
-- ingredient-level casts changed ::integer -> ::numeric. Nothing else changes:
-- the server-side is_verified/verified_confidence/verified_source aggregation,
-- the app.recipes_trust_write_allowed escape hatch, and every other cast are
-- byte-for-byte the ENG-1415 body. The trigger function
-- recipes_trust_column_lockdown is unchanged and is NOT redefined here.
--
-- This is a function-body change only — no column shape changes — so the
-- generated Supabase types are unaffected (db:types:check stays green).
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP rewrites
-- schema_migrations.version to wall-clock NOW(), drifting from the future-dated
-- filename prefix used for monotonic ordering; CLAUDE.md project rule).

set search_path = public;

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
  v_user_id            uuid;
  v_ing                 jsonb;
  v_ing_count           int := 0;
  v_all_verified        boolean := true;
  v_min_confidence      numeric := null;
  v_this_confidence     numeric;
  v_this_verified       boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'save_verified_ingredients: not authenticated'
      using errcode = '42501';
  end if;

  -- ENG-1415/1417 — aggregate the recipe-level trust signal from the SAME
  -- ingredient rows this call is about to persist. Worst-case-wins: any
  -- ingredient not verified fails the whole recipe. An empty ingredient
  -- array never counts as verified.
  for v_ing in select * from jsonb_array_elements(p_ingredient_updates)
  loop
    v_ing_count := v_ing_count + 1;
    v_this_verified := coalesce((v_ing->>'is_verified')::boolean, false);
    v_this_confidence := (v_ing->>'confidence')::numeric;
    if not v_this_verified then
      v_all_verified := false;
    end if;
    if v_this_confidence is not null and (v_min_confidence is null or v_this_confidence < v_min_confidence) then
      v_min_confidence := v_this_confidence;
    end if;
  end loop;

  if v_ing_count = 0 then
    v_all_verified := false;
  end if;

  perform set_config('app.recipes_trust_write_allowed', 'true', true);

  update recipes set
    calories             = (p_recipe_update->>'calories')::numeric,
    protein              = (p_recipe_update->>'protein')::numeric,
    carbs                = (p_recipe_update->>'carbs')::numeric,
    fat                  = (p_recipe_update->>'fat')::numeric,
    fiber_g              = (p_recipe_update->>'fiber_g')::numeric,
    sugar_g              = (p_recipe_update->>'sugar_g')::numeric,
    sodium_mg            = (p_recipe_update->>'sodium_mg')::numeric,
    caffeine_mg          = (p_recipe_update->>'caffeine_mg')::numeric,
    alcohol_g            = (p_recipe_update->>'alcohol_g')::numeric,
    nutrition_micros     = coalesce(p_recipe_update->'nutrition_micros', nutrition_micros),
    allergens            = p_recipe_update->'allergens',
    is_verified          = v_all_verified,
    verified_confidence  = case when v_all_verified then v_min_confidence else null end,
    verified_source      = case when v_all_verified then 'recipe_ingredients_aggregate' else null end,
    verified_at          = case when v_all_verified then now() else null end
  where id = p_recipe_id;

  for v_ing in select * from jsonb_array_elements(p_ingredient_updates)
  loop
    update recipe_ingredients set
      name             = v_ing->>'name',
      amount           = (v_ing->>'amount')::numeric,
      unit             = v_ing->>'unit',
      -- ENG-1543: these four were ::integer in ENG-1415 but the columns are
      -- NUMERIC(10,2) (20260508100000) — a decimal macro threw and aborted the
      -- whole verify write. Match the recipe-level ::numeric casts above.
      calories         = (v_ing->>'calories')::numeric,
      protein          = (v_ing->>'protein')::numeric,
      carbs            = (v_ing->>'carbs')::numeric,
      fat              = (v_ing->>'fat')::numeric,
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

comment on function public.save_verified_ingredients is
  'ENG-673/ENG-1108/ENG-1299/ENG-1415/1417/ENG-1543: atomic recipe verify write. Computes recipes.is_verified/verified_confidence/verified_source server-side (worst-case-wins over the ingredient rows in the same call) rather than trusting a client-supplied recipe-level flag. ENG-1543 (2026-07-12) fixed the four ingredient-level macro casts from ::integer to ::numeric — the columns are NUMERIC(10,2), so a decimal macro was throwing and aborting the whole verify writeback.';

notify pgrst, 'reload schema';
