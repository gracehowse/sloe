-- User-favourite foods — "star this meal for one-tap re-log".
--
-- Powers the web + mobile Quick Add panel (Favourites / Frequent / Recent
-- tabs) and the "Eat again" one-tap card on the Today view.
--
-- One row per (user, food). The unique index on
-- (user_id, lower(recipe_title), round(calories)) prevents the same food
-- from being saved twice with slightly different casing or calorie
-- rounding (e.g. "Oatmeal 350 kcal" vs "oatmeal 350.4 kcal").
-- Users unstar and re-star to change any value; there is intentionally
-- no UPDATE policy, so mutations cannot drift the canonical row.

create table if not exists public.user_favorite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_title text not null,
  calories numeric not null default 0 check (calories >= 0),
  protein numeric not null default 0 check (protein >= 0),
  carbs numeric not null default 0 check (carbs >= 0),
  fat numeric not null default 0 check (fat >= 0),
  fiber numeric,
  -- Provenance label mirroring `nutrition_entries.source`
  -- ('usda' | 'off' | 'fatsecret' | 'custom' | 'recipe' | …).
  source text,
  -- Optional upstream id (USDA fdcId, OFF barcode, recipe uuid) for
  -- deduping when the user stars the "same" food coming from different
  -- rows of history. Nullable because manual logs may have no id.
  source_id text,
  created_at timestamptz not null default now()
);

-- Prevent duplicate favourites that only differ by casing or rounding.
-- `round(calories::numeric)` canonicalises 350.4 and 349.6 both into 350.
create unique index if not exists user_favorite_foods_user_title_cal_idx
  on public.user_favorite_foods (user_id, lower(recipe_title), round(calories::numeric));

-- Listing the panel is always "newest first for this user".
create index if not exists user_favorite_foods_user_created_idx
  on public.user_favorite_foods (user_id, created_at desc);

-- RLS — the row belongs to the user. No UPDATE policy on purpose.
alter table public.user_favorite_foods enable row level security;

create policy "Users can read own favorite foods"
  on public.user_favorite_foods for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own favorite foods"
  on public.user_favorite_foods for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own favorite foods"
  on public.user_favorite_foods for delete
  to authenticated
  using (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
