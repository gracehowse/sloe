-- ENG-1052 — schema/security hardening batch.
--
-- Apply path: stage this file and have Grace run `supabase db push --linked`.
-- Do NOT apply through MCP apply_migration or the Supabase Dashboard "Save as
-- migration" flow; those can rewrite schema_migrations.version away from the
-- file timestamp and create migration drift.
--
-- Before applying to live, re-run the source audit from the implementation
-- brief so VALIDATE cannot fail unexpectedly:
--   select distinct source
--   from public.nutrition_entries
--   where source is not null
--   order by source;
--
-- The requested "calories smallint -> int" sub-item is intentionally not DDL:
-- the live reconciliation found no calorie-bearing smallint columns. Calories
-- are already integer/numeric depending on table, so there is nothing safe or
-- correct to widen in this batch.
--
-- HIBP leaked-password protection is also intentionally not DDL. Enable it in
-- Supabase Dashboard/Auth config after this migration is pushed; the security
-- advisor WARN clears only after that founder-gated dashboard action.

begin;

alter table public.nutrition_entries
  validate constraint nutrition_entries_source_canonical;

-- Re-apply the latest ENG-1244 trust-lockdown version of the RPC, preserving
-- SECURITY INVOKER and the trust-column omission while adding an explicit
-- recipe-author guard for defense in depth if recipe UPDATE RLS regresses.
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

  if not exists (
    select 1
    from recipes
    where id = p_recipe_id
      and author_id = v_user_id
  ) then
    raise exception 'save_verified_ingredients: not recipe author'
      using errcode = '42501';
  end if;

  update recipes set
    calories     = (p_recipe_update->>'calories')::numeric,
    protein      = (p_recipe_update->>'protein')::numeric,
    carbs        = (p_recipe_update->>'carbs')::numeric,
    fat          = (p_recipe_update->>'fat')::numeric,
    fiber_g      = (p_recipe_update->>'fiber_g')::numeric,
    sugar_g      = (p_recipe_update->>'sugar_g')::numeric,
    sodium_mg    = (p_recipe_update->>'sodium_mg')::numeric,
    caffeine_mg  = (p_recipe_update->>'caffeine_mg')::numeric,
    alcohol_g    = (p_recipe_update->>'alcohol_g')::numeric,
    allergens    = p_recipe_update->'allergens'
  where id = p_recipe_id;

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
      sodium_mg     = (v_ing->>'sodium_mg')::numeric,
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

comment on function public.save_verified_ingredients is
  'ENG-1052: atomic recipe verification save RPC; SECURITY INVOKER with pinned search_path and explicit recipe author guard. Keeps ENG-1244 recipe trust columns server-owned.';

grant execute on function public.save_verified_ingredients(uuid, jsonb, jsonb)
  to authenticated;

notify pgrst, 'reload schema';

commit;
