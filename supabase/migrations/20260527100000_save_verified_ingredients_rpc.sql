-- ENG-673: atomic save for recipe verify screen.
--
-- Replaces the two-step non-atomic write in saveVerifiedIngredients()
-- (apps/mobile/lib/verifyRecipe.ts) that first updated `recipes` totals then
-- looped through `recipe_ingredients` individually.  A network error mid-loop
-- left the DB in a split state: recipe-level macros updated, some ingredient
-- rows stale.  PL/pgSQL executes both writes inside the function's implicit
-- statement transaction so either all rows land or none do.
--
-- SECURITY INVOKER keeps RLS on both tables active — auth.uid() checks on
-- recipes and recipe_ingredients still apply.  Mirrors the save_meal_plan
-- pattern from 20260503100400_save_meal_plan_rpc.sql.

create or replace function public.save_verified_ingredients(
  p_recipe_id          uuid,
  p_recipe_update      jsonb,
  p_ingredient_updates jsonb   -- array of {id, ...fields}
)
returns void
language plpgsql
security invoker
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

  -- 1. Update recipe totals + verification state.
  update recipes set
    calories     = (p_recipe_update->>'calories')::integer,
    protein      = (p_recipe_update->>'protein')::integer,
    carbs        = (p_recipe_update->>'carbs')::integer,
    fat          = (p_recipe_update->>'fat')::integer,
    fiber_g      = (p_recipe_update->>'fiber_g')::numeric,
    sugar_g      = (p_recipe_update->>'sugar_g')::numeric,
    sodium_mg    = (p_recipe_update->>'sodium_mg')::integer,
    caffeine_mg  = (p_recipe_update->>'caffeine_mg')::numeric,
    alcohol_g    = (p_recipe_update->>'alcohol_g')::numeric,
    is_verified  = (p_recipe_update->>'is_verified')::boolean,
    allergens    = p_recipe_update->'allergens'
  where id = p_recipe_id;

  -- 2. Update each dirty ingredient row.
  for v_ing in select * from jsonb_array_elements(p_ingredient_updates)
  loop
    update recipe_ingredients set
      name          = v_ing->>'name',
      amount        = (v_ing->>'amount')::numeric,
      unit          = v_ing->>'unit',
      calories      = (v_ing->>'calories')::integer,
      protein       = (v_ing->>'protein')::integer,
      carbs         = (v_ing->>'carbs')::integer,
      fat           = (v_ing->>'fat')::integer,
      fiber_g       = (v_ing->>'fiber_g')::numeric,
      sugar_g       = (v_ing->>'sugar_g')::numeric,
      sodium_mg     = (v_ing->>'sodium_mg')::integer,
      caffeine_mg   = (v_ing->>'caffeine_mg')::numeric,
      alcohol_g     = (v_ing->>'alcohol_g')::numeric,
      is_verified   = (v_ing->>'is_verified')::boolean,
      source        = v_ing->>'source',
      confidence    = (v_ing->>'confidence')::numeric,
      override_macros = v_ing->'override_macros',
      added_by_user = coalesce((v_ing->>'added_by_user')::boolean, false)
    where id = (v_ing->>'id')::uuid;
  end loop;
end;
$$;

grant execute on function public.save_verified_ingredients(uuid, jsonb, jsonb)
  to authenticated;
