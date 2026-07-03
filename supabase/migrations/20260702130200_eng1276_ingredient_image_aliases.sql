-- ingredient_image_aliases — matched-food → canonical-tile alias storage
-- (ENG-1276, the designed fast-follow to the 2026-06-08 image system).
--
-- Part of the Sloe image system (2026-06-08,
-- docs/decisions/2026-06-08-recipe-ingredient-image-system.md).
--
-- WHY. `ingredient_images` is keyed by `canonicalImageKey(name)` — a TEXT
-- spine. Two differently-spelled names that matched the SAME food
-- (e.g. "120g baby spinach" and "spinach leaves, washed", both matched to
-- FatSecret food 4001) can still derive different text keys and so miss the
-- shared tile. `matchedAliasKey({name, matchedSource, matchedFoodId,
-- confidence})` (src/lib/recipe/canonicalImageKey.ts) returns
-- `"source:food_id"` (lowercased) ONLY when confidence ≥ 0.85 and both parts
-- present. This table records `alias_key → name_key` so the read path can
-- fall back to the tile a trusted match already resolved to. The text key
-- stays the PRIMARY path; the alias is a fallback only. We NEVER key off a
-- weak/absent match (CLAUDE.md: reject low-confidence collapses).
--
-- One row per distinct matched food identity. Multiple ingredient names can
-- resolve to the same `alias_key`; `name_key` points at the canonical tile
-- that food's image lives under. The table is GLOBAL and not user-owned:
-- every authenticated user reads the same alias. Writes are service-role
-- only (the runtime resolve/generate path runs with the service key) —
-- clients never insert here. Upserts are idempotent on `alias_key`.
--
-- Apply path: tracked file -> `supabase db push --linked` (authorised
-- per memory feedback_supabase_db_push_authorised). NEVER apply via
-- Supabase MCP apply_migration — that rewrites schema_migrations.version
-- to NOW() and drifts from the file timestamp.
--
-- DOWN SQL:
--   drop table if exists public.ingredient_image_aliases;
--   alter table public.recipe_ingredients drop column if exists matched_alias_key;

create table if not exists public.ingredient_image_aliases (
  -- matchedAliasKey(...) — "source:food_id" (lowercased). The trusted
  -- matched-food identity, primary key so a single food never gets two
  -- competing alias rows.
  alias_key text primary key,
  -- The canonical tile key (canonicalImageKey(name)) this food resolves to.
  -- Points at the `ingredient_images.name_key` whose image should be reused.
  name_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lookups fan out from a set of alias_keys (primary key covers those), but
-- the reverse direction (which aliases point at a given tile) needs an index
-- so a future tile re-key / cleanup has a home.
create index if not exists ingredient_image_aliases_name_key_idx
  on public.ingredient_image_aliases (name_key);

alter table public.ingredient_image_aliases enable row level security;

-- Public read: every authenticated (and anon) user reads the same global
-- alias. Matches the ingredient_images public-lookup pattern.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingredient_image_aliases'
      and policyname = 'ingredient_image_aliases_select_public'
  ) then
    create policy "ingredient_image_aliases_select_public"
    on public.ingredient_image_aliases for select
    using (true);
  end if;
end $$;

-- No INSERT / UPDATE / DELETE policy is created, so with RLS enabled the
-- table is default-deny for writes to anon + authenticated roles. The
-- service role bypasses RLS, which is exactly the write path we want
-- (the runtime resolve/generate path). Clients can never write.

-- keep updated_at fresh on writes (service-role only, but correct anyway)
create or replace function public.ingredient_image_aliases_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ingredient_image_aliases_touch_updated_at on public.ingredient_image_aliases;
create trigger ingredient_image_aliases_touch_updated_at
  before update on public.ingredient_image_aliases
  for each row
  execute function public.ingredient_image_aliases_touch_updated_at();

comment on table public.ingredient_image_aliases is
  'ENG-1276: matched-food -> canonical-tile alias for the Sloe image system. alias_key = matchedAliasKey(...) ("source:food_id", confidence >= 0.85; src/lib/recipe/canonicalImageKey.ts); name_key = the ingredient_images tile that food resolves to. Public read, service-role write. Additive fallback to the canonicalImageKey text key — never the primary path. See docs/decisions/2026-06-08-recipe-ingredient-image-system.md.';

-- recipe_ingredients.matched_alias_key — persist the matchedAliasKey(...) for
-- a row at write time so the read path can resolve its tile via the alias
-- table without recomputing (and so a trusted match's identity is durable).
alter table public.recipe_ingredients
  add column if not exists matched_alias_key text;

comment on column public.recipe_ingredients.matched_alias_key is
  'ENG-1276: matchedAliasKey({name, matchedSource: source, matchedFoodId: fatsecret_food_id, confidence}) = "source:food_id" (lowercased) when confidence >= 0.85 and both parts present; null otherwise. Feeds the ingredient_image_aliases fallback (canonicalImageKey text key stays primary). src/lib/recipe/canonicalImageKey.ts.';
