-- User-saved meal combos (Batch 2.6) — "My usual breakfast" as a reusable
-- combination of logged items. NOT recipes (no ingredients/instructions) and
-- NOT single favourites (see `user_favorite_foods`). A saved meal is a user's
-- grouping of already-logged foods that can be re-logged as a group in one tap.
--
-- Two-table design:
--   public.user_saved_meals        — parent row (name, default slot, counters)
--   public.user_saved_meal_items   — child rows (one per food, ordered by position)
--
-- Listing uses `last_logged_at desc nulls last, created_at desc` so the combos
-- the user re-logs most recently bubble to the top without hand-sorting.
-- `log_count` is incremented when the user taps "log" on a saved meal — used
-- by analytics and future "most-used combos" UI. No UPDATE policy on items
-- in this batch (item editing is deferred — users rename/delete parent, or
-- delete + re-create to change items); parent allows UPDATE for rename and
-- counter bumps.

create table if not exists public.user_saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  -- Optional slot hint: when the user taps the combo, the UI suggests
  -- logging into this slot. Nullable so "My Friday treat" can stay
  -- slot-agnostic.
  default_meal_slot text check (
    default_meal_slot is null
    or default_meal_slot in ('Breakfast', 'Lunch', 'Dinner', 'Snacks')
  ),
  created_at timestamptz not null default now(),
  last_logged_at timestamptz,
  log_count integer not null default 0 check (log_count >= 0)
);

create table if not exists public.user_saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.user_saved_meals(id) on delete cascade,
  -- Position preserves the order the user defined when saving. Duplicate
  -- positions within the same combo are tolerated (unique constraint is
  -- deliberately absent) because re-ordering is out of scope for this
  -- batch; we read ordered by (position, id) to get a deterministic
  -- ordering regardless.
  position integer not null default 0,
  recipe_title text not null,
  calories numeric not null default 0 check (calories >= 0),
  protein numeric not null default 0 check (protein >= 0),
  carbs numeric not null default 0 check (carbs >= 0),
  fat numeric not null default 0 check (fat >= 0),
  fiber numeric,
  water_ml numeric,
  -- Count-to-weight / serving multiplier. `> 0` — callers must clamp at
  -- insert time. Nothing here mints nutrition values; scaling is applied
  -- to the snapshot macros by the shared helper when logging.
  portion_multiplier numeric not null default 1 check (portion_multiplier > 0),
  -- Provenance label matching `nutrition_entries.source`.
  source text,
  source_id text
);

-- Listing the user's combos: newest-re-logged first, then newest-created.
create index if not exists user_saved_meals_user_sort_idx
  on public.user_saved_meals (user_id, last_logged_at desc nulls last, created_at desc);

-- Ordered child-item reads for a given combo.
create index if not exists user_saved_meal_items_meal_position_idx
  on public.user_saved_meal_items (saved_meal_id, position);

-- Row-level security.
alter table public.user_saved_meals enable row level security;
alter table public.user_saved_meal_items enable row level security;

-- Parent table policies — full CRUD for the owning user.
create policy "Users can read own saved meals"
  on public.user_saved_meals for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own saved meals"
  on public.user_saved_meals for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own saved meals"
  on public.user_saved_meals for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own saved meals"
  on public.user_saved_meals for delete
  to authenticated
  using (auth.uid() = user_id);

-- Items are locked down via the parent row's ownership — the `exists` test
-- ensures an item can only be touched when the caller owns its saved_meal.
create policy "Users can read items of own saved meals"
  on public.user_saved_meal_items for select
  to authenticated
  using (
    exists (
      select 1 from public.user_saved_meals m
      where m.id = user_saved_meal_items.saved_meal_id
        and m.user_id = auth.uid()
    )
  );

create policy "Users can insert items into own saved meals"
  on public.user_saved_meal_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_saved_meals m
      where m.id = user_saved_meal_items.saved_meal_id
        and m.user_id = auth.uid()
    )
  );

create policy "Users can update items of own saved meals"
  on public.user_saved_meal_items for update
  to authenticated
  using (
    exists (
      select 1 from public.user_saved_meals m
      where m.id = user_saved_meal_items.saved_meal_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_saved_meals m
      where m.id = user_saved_meal_items.saved_meal_id
        and m.user_id = auth.uid()
    )
  );

create policy "Users can delete items of own saved meals"
  on public.user_saved_meal_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_saved_meals m
      where m.id = user_saved_meal_items.saved_meal_id
        and m.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
