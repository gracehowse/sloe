-- ENG-1108 — extend save_verified_ingredients so web auto-verify can persist
-- verified_at / verified_confidence / verified_source in the same atomic RPC
-- (parity with mobile verify screen; removes the follow-up recipes.update).

create or replace function public.save_verified_ingredients(
  p_recipe_id          uuid,
  p_recipe_update      jsonb,
  p_ingredient_updates jsonb
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

  update recipes set
    calories            = (p_recipe_update->>'calories')::integer,
    protein             = (p_recipe_update->>'protein')::integer,
    carbs               = (p_recipe_update->>'carbs')::integer,
    fat                 = (p_recipe_update->>'fat')::integer,
    fiber_g             = (p_recipe_update->>'fiber_g')::numeric,
    sugar_g             = (p_recipe_update->>'sugar_g')::numeric,
    sodium_mg           = (p_recipe_update->>'sodium_mg')::integer,
    caffeine_mg         = coalesce((p_recipe_update->>'caffeine_mg')::numeric, 0),
    alcohol_g           = coalesce((p_recipe_update->>'alcohol_g')::numeric, 0),
    is_verified         = (p_recipe_update->>'is_verified')::boolean,
    allergens           = p_recipe_update->'allergens',
    verified_at         = case
      when p_recipe_update ? 'verified_at'
        then (p_recipe_update->>'verified_at')::timestamptz
      else verified_at
    end,
    verified_confidence = case
      when p_recipe_update ? 'verified_confidence'
        then (p_recipe_update->>'verified_confidence')::numeric
      else verified_confidence
    end,
    verified_source     = case
      when p_recipe_update ? 'verified_source'
        then p_recipe_update->>'verified_source'
      else verified_source
    end
  where id = p_recipe_id;

  for v_ing in select * from jsonb_array_elements(p_ingredient_updates)
  loop
    update recipe_ingredients set
      name            = v_ing->>'name',
      amount          = (v_ing->>'amount')::numeric,
      unit            = v_ing->>'unit',
      calories        = (v_ing->>'calories')::integer,
      protein         = (v_ing->>'protein')::integer,
      carbs           = (v_ing->>'carbs')::integer,
      fat             = (v_ing->>'fat')::integer,
      fiber_g         = (v_ing->>'fiber_g')::numeric,
      sugar_g         = (v_ing->>'sugar_g')::numeric,
      sodium_mg       = (v_ing->>'sodium_mg')::integer,
      caffeine_mg     = coalesce((v_ing->>'caffeine_mg')::numeric, 0),
      alcohol_g       = coalesce((v_ing->>'alcohol_g')::numeric, 0),
      is_verified     = (v_ing->>'is_verified')::boolean,
      source          = v_ing->>'source',
      confidence      = (v_ing->>'confidence')::numeric,
      override_macros = v_ing->'override_macros',
      added_by_user   = coalesce((v_ing->>'added_by_user')::boolean, false)
    where id = (v_ing->>'id')::uuid;
  end loop;
end;
$$;

comment on function public.save_verified_ingredients is
  'ENG-673 + ENG-1108: atomic recipe verify write — totals, allergens, optional verified_at/confidence/source metadata, and ingredient rows in one transaction.';
