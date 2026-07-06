-- ENG-1415/1417 (2026-07-06 nutrition-trust persistence pass) — restore a
-- legitimate write path for recipes.is_verified / verified_confidence /
-- verified_source, which ENG-1244 (2026-07-02) inadvertently removed
-- entirely.
--
-- THE REGRESSION (confirmed against the live function def + the app code):
-- ENG-1244's recipes_trust_column_lockdown migration correctly closed a
-- corpus-poisoning hole (a client could assert recipes.is_verified = true
-- directly, independent of what the ingredients actually showed) by
-- (a) adding a BEFORE INSERT/UPDATE trigger rejecting any anon/authenticated
-- write to is_verified/verified_source/verified_at/verified_confidence, and
-- (b) stripping save_verified_ingredients' ability to set those columns from
-- caller-supplied JSON. Nothing replaced (b) with a legitimate path.
--
-- Confirmed via apps/mobile/lib/verifyRecipe.ts:saveVerifiedIngredients() —
-- it still computes `allRowsVerified` (the VR-01, 2026-04-28 fix's intended
-- gate: "only mark a recipe verified when every ingredient clears the
-- review threshold") but the variable is now dead code: it's computed and
-- never used, because the RPC no longer accepts a recipe-level is_verified
-- field at all. Net effect since ENG-1244 shipped (2026-07-02): NO recipe,
-- on either platform, through any path (including the fully-working,
-- user-completed verify flow — not just the RecipeUpload save-before-verify
-- race ENG-1415/1417 were filed for), can ever have recipes.is_verified
-- flip back to true. Every recipe permanently reads as unverified regardless
-- of how thoroughly a user verified it. This is the reason ENG-1417's
-- render-qualifier work would have been meaningless without this fix first —
-- keyed off a flag that can structurally never be true again.
--
-- THE FIX: save_verified_ingredients now computes is_verified /
-- verified_confidence / verified_source SERVER-SIDE from the SAME
-- p_ingredient_updates array it already writes to recipe_ingredients —
-- never from a separate client-supplied recipe-level flag. This preserves
-- ENG-1244's actual security intent (a client still cannot assert "this
-- recipe is verified" independent of the ingredient rows) while restoring a
-- working write path:
--   is_verified         = every ingredient row's own is_verified is true,
--                         AND there is at least one ingredient row
--                         (worst-case-wins — same aggregation policy as the
--                         TrustChip logic in recipeTrust.ts:
--                         aggregateRecipeTrust — any unverified row fails
--                         the whole recipe).
--   verified_confidence = the MINIMUM per-ingredient confidence (the
--                         weakest link, not an average that could hide one
--                         bad match), only set when is_verified is true.
--   verified_source     = the fixed marker 'recipe_ingredients_aggregate'
--                         when is_verified is true, else null. (No existing
--                         code reads this column today — grepped the full
--                         web + mobile trees — so this is a fresh, documented
--                         convention, not a behavior change for any reader.)
--
-- THE TRIGGER PROBLEM: recipes_trust_column_lockdown_trg fires on this same
-- UPDATE and checks `auth.role()`, which reflects the REQUEST's JWT role
-- claim ('anon' | 'authenticated' | 'service_role') — this does NOT change
-- based on whether the executing function is SECURITY INVOKER or DEFINER,
-- so a normal user's own authenticated RPC call always sees
-- auth.role() = 'authenticated'. A role check alone therefore can't
-- distinguish "the RPC computed this honestly by aggregating verified
-- ingredient rows" from "the client tried to set it directly" — both look
-- identical to the trigger by role alone.
--
-- THE FIX FOR THAT: save_verified_ingredients sets a transaction-local
-- escape-hatch GUC (`app.recipes_trust_write_allowed`) immediately before
-- the trust-column write, and the trigger checks for it as an additional
-- bypass condition. This is NOT reachable by a client directly: PostgREST
-- only exposes functions explicitly granted in the `public` schema as
-- callable RPCs, and `set_config` lives in `pg_catalog` — there is no
-- `rpc/set_config` endpoint a client could call to set this flag itself.
-- Only a plpgsql function body can call it. `is_local = true` means it
-- resets automatically at transaction end regardless of outcome — it can
-- never leak into a later statement or connection (pgbouncer-safe).
--
-- Direct client UPDATEs to recipes.is_verified remain fully blocked exactly
-- as ENG-1244 intended — this migration adds a narrow, auditable exception
-- for one specific, already-reviewed code path, not a general loophole.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP
-- rewrites schema_migrations.version to wall-clock NOW(), drifting from the
-- future-dated filename prefix used for monotonic ordering).

set search_path = public;

create or replace function public.recipes_trust_column_lockdown()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(nullif(auth.role(), ''), current_user);
begin
  -- ENG-1415/1417: narrow escape hatch for save_verified_ingredients, which
  -- computes these columns server-side from verified ingredient rows rather
  -- than trusting a client-supplied value. Transaction-local; not reachable
  -- via the client API (see migration header for the full reasoning).
  if current_setting('app.recipes_trust_write_allowed', true) = 'true' then
    return new;
  end if;

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

comment on function public.recipes_trust_column_lockdown is
  'ENG-1244: rejects anon/authenticated writes to recipes.is_verified and recipe verification metadata, EXCEPT when app.recipes_trust_write_allowed is set (ENG-1415/1417 — save_verified_ingredients computing the aggregate server-side). Server-owned writers (service_role) remain allowed.';

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

comment on function public.save_verified_ingredients is
  'ENG-673/ENG-1108/ENG-1299/ENG-1415/1417: atomic recipe verify write. Computes recipes.is_verified/verified_confidence/verified_source server-side (worst-case-wins over the ingredient rows in the same call) rather than trusting a client-supplied recipe-level flag — restores the write path ENG-1244 removed without reopening the corpus-poisoning hole it closed.';

notify pgrst, 'reload schema';
