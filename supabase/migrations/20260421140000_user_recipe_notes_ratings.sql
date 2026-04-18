-- Batch 3.8 — Personal recipe notes, personal rating, cook counter.
--
-- The public `recipes` table already stores community-facing fields
-- (title, macros, author, etc.). This migration adds a separate,
-- per-user side-table for the "my personal feelings about this recipe"
-- data — free-form notes ("less salt next time"), a private 1–5 star
-- rating so the user can filter *their* library by best, and a cook
-- counter that will drive future "recently cooked" / "top cooked" UI.
--
-- Design notes:
--   - One row per (user_id, recipe_id) — the UI treats "have I got notes
--     for this recipe?" as a boolean read + upsert, not an append log.
--   - `personal_rating` is nullable so "no rating" is distinct from
--     "rated 0". The Clear button in the UI maps to `personal_rating = null`.
--   - `notes` default `''` (empty string), capped at 10_000 chars so a
--     runaway paste cannot bloat the row.
--   - `cook_count` / `last_cooked_at` bookkeeping is wired through the
--     `incrementCookCount` helper — this migration only adds storage.
--   - Owner-only RLS; we never read another user's private notes.
--
-- Separate from any public `recipes.rating` (community average) — if
-- that column is added later, it's a different number with different
-- semantics and should not share a row with this table.

create table if not exists public.user_recipe_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  -- Free-form personal notes. Defaulted to '' rather than null so the
  -- UI always has a string to render — the autosave textarea never
  -- flips between null and "".
  notes text not null default '' check (char_length(notes) <= 10000),
  -- 1..5 stars, or null for "not rated". Clear-to-unrate is a first-
  -- class state, so this column is nullable on purpose.
  personal_rating smallint
    check (personal_rating is null or (personal_rating between 1 and 5)),
  -- Incremented by `incrementCookCount` when the user marks the recipe
  -- as cooked (future batch wires the "Mark as cooked" action).
  cook_count integer not null default 0 check (cook_count >= 0),
  last_cooked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One notes row per user per recipe — upsert semantics.
  constraint user_recipe_notes_unique unique (user_id, recipe_id)
);

-- Library sort: "show me my best-rated recipes first". Covers the common
-- query `where user_id = $1 order by personal_rating desc nulls last,
-- updated_at desc`.
create index if not exists user_recipe_notes_user_rating_updated_idx
  on public.user_recipe_notes (user_id, personal_rating desc nulls last, updated_at desc);

-- Row-level security — strict owner-only.
alter table public.user_recipe_notes enable row level security;

create policy "Users can read own recipe notes"
  on public.user_recipe_notes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own recipe notes"
  on public.user_recipe_notes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own recipe notes"
  on public.user_recipe_notes for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own recipe notes"
  on public.user_recipe_notes for delete
  to authenticated
  using (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
