-- User-created custom foods (Batch 3.9) — "My homemade granola".
--
-- Unlike `user_favorite_foods` (single-item starred food from a known
-- source) and `user_saved_meals` (multi-item combo of already-logged
-- foods), a custom food is a brand-new food the user defines because
-- it is not in USDA or Open Food Facts. The canonical example is
-- homemade or local-bakery items without a label/barcode.
--
-- Macros are stored per `base_grams` (default 100g — industry norm).
-- The `servings` JSONB array captures the user's preferred portion
-- shortcuts, e.g. `[{"label":"1 bowl","grams":80},{"label":"1 tbsp","grams":12}]`.
-- The client resolves a chosen serving to grams, then scales macros
-- linearly via the shared `scaleMacrosForGrams` helper — no nutrition
-- values are minted here.
--
-- Dedupe: unique index on `(user_id, lower(name))` keeps the library
-- tidy; the client appends " (2)", " (3)" … on collision up to " (9)".
-- Listing uses `updated_at desc` so the most-recently-edited custom
-- foods surface first in search.
--
-- RLS: full CRUD for the owning user only.

create table if not exists public.user_custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brand text,
  -- Macros below are per `base_grams` of this food. Default 100 matches
  -- USDA / nutrition-label convention; users can change it (e.g. to 30
  -- for a cereal whose label shows "per 30g").
  base_grams numeric not null default 100 check (base_grams > 0),
  calories numeric not null default 0 check (calories >= 0),
  protein numeric not null default 0 check (protein >= 0),
  carbs numeric not null default 0 check (carbs >= 0),
  fat numeric not null default 0 check (fat >= 0),
  -- Fiber stays nullable because many homemade items genuinely don't
  -- have a known fiber value (and we refuse to invent one — project rule).
  fiber numeric,
  -- Array of `{label: string, grams: number}`. Bounded to 20 rows so a
  -- runaway client can't bloat a row. Empty array is valid — the user
  -- can always log in grams directly.
  servings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(servings) = 'array' and jsonb_array_length(servings) between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per user. Prevents "granola" and "Granola"
-- both existing in the same library; client appends " (2)" on collision.
create unique index if not exists user_custom_foods_user_name_idx
  on public.user_custom_foods (user_id, lower(name));

-- Listing the user's library: most-recently-touched first, tie-break
-- by created_at desc is implicit because `updated_at` defaults to now()
-- on insert.
create index if not exists user_custom_foods_user_updated_idx
  on public.user_custom_foods (user_id, updated_at desc);

-- RLS — the row belongs to the user.
alter table public.user_custom_foods enable row level security;

create policy "Users can read own custom foods"
  on public.user_custom_foods for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own custom foods"
  on public.user_custom_foods for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own custom foods"
  on public.user_custom_foods for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own custom foods"
  on public.user_custom_foods for delete
  to authenticated
  using (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
