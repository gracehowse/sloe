-- ingredient_images — global, deterministic, on-brand ingredient tile
-- images keyed by a normalised ingredient name.
--
-- Part of the Sloe image system (2026-06-08,
-- docs/decisions/2026-06-08-recipe-ingredient-image-system.md).
--
-- One row per distinct canonical ingredient (e.g. "garlic", "chicken
-- breast"), NOT per recipe row — the same image is reused everywhere
-- that ingredient appears (recipe-detail ingredient tiles, shopping
-- rows, verify rows). `name_key` is `normalizeIngredientNameKey(name)`
-- from src/lib/planning/ingredientNameKey.ts so the lookup matches how
-- ingredients are grouped elsewhere.
--
-- Images are generated off-line by scripts/backfill-images.ts via the
-- fal.ai FLUX-2-pro pipeline (Template B — single ingredient on pure
-- white). The table is GLOBAL and not user-owned: every authenticated
-- user reads the same tile. Writes are service-role only (the backfill
-- script + the runtime hero/ingredient generator run with the service
-- key) — clients never insert here. `status` lets the backfill mark a
-- row `pending` (claimed, not yet generated), `ready` (image_url set),
-- or `failed` (generation errored, e.g. fal out of balance) so a re-run
-- is idempotent.
--
-- Apply path: tracked file -> `supabase db push --linked` (authorised
-- per memory feedback_supabase_db_push_authorised). NEVER apply via
-- Supabase MCP apply_migration — that rewrites schema_migrations.version
-- to NOW() and drifts from the file timestamp.

create table if not exists public.ingredient_images (
  id uuid primary key default gen_random_uuid(),
  -- normalizeIngredientNameKey(name) — the grouping key. Unique so a
  -- single ingredient never gets two competing tiles.
  name_key text not null unique,
  -- The human label the image was generated for (e.g. "Garlic"). Kept
  -- for debugging / regeneration; the app never displays this (it uses
  -- cleanIngredientDisplayName on the recipe row's own name).
  display_name text,
  -- Public Storage URL of the generated webp. Null while pending/failed.
  image_url text,
  -- 'pending' | 'ready' | 'failed' — drives idempotent backfill re-runs.
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lookup is always by name_key; the unique constraint already creates a
-- btree, but keep an explicit index so the intent is obvious and a
-- future composite (e.g. status filter) has a home.
create index if not exists ingredient_images_name_key_idx
  on public.ingredient_images (name_key);

create index if not exists ingredient_images_status_idx
  on public.ingredient_images (status);

alter table public.ingredient_images enable row level security;

-- Public read: every authenticated (and anon) user reads the same
-- global tile. Matches the foods / food_sources public-lookup pattern.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingredient_images'
      and policyname = 'ingredient_images_select_public'
  ) then
    create policy "ingredient_images_select_public"
    on public.ingredient_images for select
    using (true);
  end if;
end $$;

-- No INSERT / UPDATE / DELETE policy is created, so with RLS enabled the
-- table is default-deny for writes to anon + authenticated roles. The
-- service role bypasses RLS, which is exactly the write path we want
-- (backfill script + server-side generator). Clients can never write.

-- keep updated_at fresh on writes (service-role only, but correct anyway)
create or replace function public.ingredient_images_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ingredient_images_touch_updated_at on public.ingredient_images;
create trigger ingredient_images_touch_updated_at
  before update on public.ingredient_images
  for each row
  execute function public.ingredient_images_touch_updated_at();

comment on table public.ingredient_images is
  'Global on-brand ingredient tile images keyed by normalizeIngredientNameKey(name). Public read, service-role write. Populated by scripts/backfill-images.ts (fal.ai FLUX-2-pro, Template B). See docs/decisions/2026-06-08-recipe-ingredient-image-system.md.';
