-- ENG-1637 — save_verified_ingredients: `allergens = p_recipe_update->'allergens'`
-- assigns a jsonb value directly to `recipes.allergens text[]`. Postgres has no
-- assignment cast from jsonb to text[], so this UPDATE throws 42804
-- unconditionally on every call whose payload includes an `allergens` key —
-- every real caller does (web RecipeUpload.tsx/RecipeDetail.tsx, mobile
-- verifyRecipe.ts always send `[]` or an inferred array). Because there's no
-- exception handler around the statement, the error aborts the whole
-- function/transaction: the "Verify ingredients" flow has been silently
-- failing on both platforms since this line first shipped 2026-05-27,
-- undetected until `supabase db lint --linked` first ran with valid
-- credentials (ENG-1628/ENG-1354). Same root-cause class as ENG-1543 (a cast
-- bug in this same function, fixed 2026-07-12) — that fix only touched the
-- four ingredient-level macro casts; this `allergens` line was untouched.
--
-- THE FIX: extract the jsonb array into text[] via jsonb_array_elements_text
-- + array_agg, guarded by a presence/type check so the three real payload
-- shapes behave correctly:
--   - key absent from p_recipe_update           -> keep the existing value
--     (matches the coalesce-to-existing pattern nutrition_micros already
--     uses one line above; omitting the key means "leave as-is").
--   - key present, a jsonb array (incl. `[]`)    -> set to that array,
--     explicitly clearing to `{}` for an empty array rather than falling
--     through to "keep existing". A naive
--       coalesce(array_agg(...) over jsonb_array_elements_text(...), allergens)
--     (the shape suggested when this bug was found) is wrong here:
--     array_agg over zero rows (the `[]` case, e.g. a recipe re-verified
--     with all allergens cleared) returns SQL NULL, which coalesce would
--     silently resolve to the STALE old value instead of the caller's
--     actual "no allergens" — allergen data is safety-relevant, so silently
--     preserving stale data instead of applying a real update is the wrong
--     failure mode. The case/jsonb_typeof guard below distinguishes
--     "omitted" from "present and empty" so both resolve correctly.
--   - key present, not an array (malformed/unexpected shape) -> keep the
--     existing value rather than throwing (same fail-safe posture as the
--     "absent" branch; no caller sends this shape today).
--
-- Nothing else in the function changes: the server-side
-- is_verified/verified_confidence/verified_source aggregation, the
-- app.recipes_trust_write_allowed escape hatch, and every other cast are
-- byte-for-byte the ENG-1543 body.
--
-- Secondary, separate finding from the same lint run (get_or_create_referral_code
-- missing a trailing RETURN — a plpgsql_check false positive on an infinite
-- loop with no static exit) is fixed in its own migration, not bundled here.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP
-- rewrites schema_migrations.version to wall-clock NOW(), drifting from the
-- future-dated filename prefix used for monotonic ordering; CLAUDE.md rule).

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
    -- ENG-1637: jsonb -> text[] has no assignment cast. Extract explicitly;
    -- distinguish "key absent" (keep existing) from "key present, possibly
    -- empty array" (apply the caller's value, including clearing to `{}`).
    allergens            = case
      when not (p_recipe_update ? 'allergens') then allergens
      when jsonb_typeof(p_recipe_update->'allergens') = 'array' then
        coalesce(
          (select array_agg(value) from jsonb_array_elements_text(p_recipe_update->'allergens')),
          '{}'::text[]
        )
      else allergens
    end,
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
  'ENG-673/ENG-1108/ENG-1299/ENG-1415/1417/ENG-1543/ENG-1637: atomic recipe verify write. Computes recipes.is_verified/verified_confidence/verified_source server-side (worst-case-wins over the ingredient rows in the same call) rather than trusting a client-supplied recipe-level flag. ENG-1543 (2026-07-12) fixed the four ingredient-level macro casts from ::integer to ::numeric. ENG-1637 (2026-07-21) fixed the recipe-level allergens cast: jsonb has no assignment cast to text[], so every call was throwing 42804 and aborting the whole write since 2026-05-27.';

notify pgrst, 'reload schema';
