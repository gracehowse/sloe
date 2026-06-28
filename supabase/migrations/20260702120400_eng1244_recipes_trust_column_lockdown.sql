-- ENG-1244 — recipes trust-column lockdown + anon claim-evidence read strip.
--
-- WHY:
--   `recipes.is_verified` is a trust/ranking signal. Before this migration,
--   normal recipe owners could set it from the browser/mobile client because
--   `recipes_update_own` gates publishing on `is_verified = true` but did not
--   prevent the owner from flipping the bit first.
--
--   Published recipes also exposed claim evidence (`claimed_by`, `claimed_at`,
--   `claim_verification`) to `anon` through the broad table SELECT grant. RLS
--   controls rows, not columns, so the read-side fix must be column grants.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration). Re-verify
-- live privileges after push with `npm run verify:eng1244-live-rls`.

-- 1) Client roles cannot write recipe-level trust columns. Service-role,
-- migration, and future SECURITY DEFINER/server-owned paths remain able to set
-- them because this guard only applies to anon/authenticated callers.
create or replace function public.recipes_trust_column_lockdown()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(nullif(auth.role(), ''), current_user);
begin
  if v_role not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_verified, false) is distinct from false then
      raise exception 'recipes.is_verified is server-owned and cannot be set from the client (ENG-1244).'
        using errcode = '42501';
    end if;
    if new.verified_source is not null
      or new.verified_at is not null
      or new.verified_confidence is not null then
      raise exception 'recipes verification metadata is server-owned and cannot be set from the client (ENG-1244).'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified then
    raise exception 'recipes.is_verified is server-owned and cannot be changed from the client (ENG-1244).'
      using errcode = '42501';
  end if;

  if new.verified_source is distinct from old.verified_source
    or new.verified_at is distinct from old.verified_at
    or new.verified_confidence is distinct from old.verified_confidence then
    raise exception 'recipes verification metadata is server-owned and cannot be changed from the client (ENG-1244).'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists recipes_trust_column_lockdown_trg on public.recipes;
create trigger recipes_trust_column_lockdown_trg
before insert or update on public.recipes
for each row
execute function public.recipes_trust_column_lockdown();

comment on function public.recipes_trust_column_lockdown is
  'ENG-1244: rejects anon/authenticated writes to recipes.is_verified and recipe verification metadata. Server-owned writers remain allowed.';

-- 2) The existing atomic verify RPC may still update aggregate macros/allergens,
-- but it no longer writes the recipe-level trust bit from caller-supplied JSON.
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

grant execute on function public.save_verified_ingredients(uuid, jsonb, jsonb)
  to authenticated;

-- 3) RLS cannot hide columns. Replace anon's broad SELECT with an explicit
-- safe-column projection that omits claim evidence.
revoke select on table public.recipes from anon;
grant select (
  id,
  created_at,
  creator_id,
  title,
  image_url,
  servings,
  is_verified,
  creator_calories,
  calories,
  protein,
  carbs,
  fat,
  author_id,
  description,
  instructions,
  prep_time_min,
  cook_time_min,
  dietary,
  published,
  source_url,
  source_name,
  fiber_g,
  sugar_g,
  sodium_mg,
  meal_type,
  caption_nutrition_claim,
  allergens,
  verified_source,
  verified_at,
  verified_confidence,
  cuisine,
  dietary_flags,
  caffeine_mg,
  alcohol_g,
  image_source,
  image_model,
  image_generated_at,
  content_origin
) on public.recipes to anon;

-- Authenticated users keep the existing table-level SELECT because own/saved
-- recipe editing and future claim-management surfaces may need full row state.
