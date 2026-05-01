-- recipe_cook_history — append-only log of per-cook sessions, one
-- row written when the user finishes Cook mode. Distinct from
-- `user_recipe_notes` (which holds the user's rolling notes / rating
-- / cook count for a recipe) — this table records what actually
-- happened on a given cook: how long it took, the scale they used,
-- their rating for that specific cook, and any free-text notes
-- ("added more garlic, cooked 5 min less").
--
-- Competitor parity (2026-04-30, "Paprika"): the per-cook surface in
-- Paprika lets users write "added more garlic" against each cook.
-- Suppr's existing `user_recipe_notes` collapses to a single row per
-- (user, recipe) and would lose that history. This table is the per-
-- session log; the rolling state stays in `user_recipe_notes`.
--
-- ─── Shape ────────────────────────────────────────────────────────
-- Append-only — `cooked_at`, `duration_seconds`, `scale_factor`,
-- `rating`, `note` are immutable once written. Edits happen by
-- writing a new row (rare; users edit the rolling notes instead).
--
-- ─── Values ───────────────────────────────────────────────────────
-- `duration_seconds` is nullable so a future "log a cook I already
-- finished" surface can write history without a captured timer.
-- `scale_factor` is `numeric(4,2)` so the supported preset set
-- (0.5 / 1.0 / 1.5 / 2.0 / 4.0) fits cleanly. `rating` is `smallint`
-- with a CHECK 1..5; null = "user didn't rate this cook" (rating is
-- always optional, no inferred zero). `note` is `text` capped at 500
-- chars — long-form rolling notes belong in `user_recipe_notes`,
-- this column is for the per-cook delta only.
--
-- ─── RLS ──────────────────────────────────────────────────────────
-- Owner SELECT + INSERT only. UPDATE + DELETE allowed for owner so
-- the user can correct a typo on the most recent entry; the service
-- role retains full access for any future repair.

create table if not exists public.recipe_cook_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  cooked_at timestamptz not null default now(),
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  -- 0.5 .. 4 today (matches the COOK_SCALE_PRESETS in the JS helper)
  -- but the column allows the wider range so a future preset doesn't
  -- need a CHECK migration.
  scale_factor numeric(4, 2)
    check (scale_factor is null or (scale_factor > 0 and scale_factor <= 99)),
  rating smallint
    check (rating is null or (rating between 1 and 5)),
  note text
    check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

-- Hot path: "Last time you cooked this" lookup. The cook screen reads
-- the latest 3 entries for `(user_id, recipe_id)` ordered by
-- `cooked_at desc`, so this index covers the read with no sort step.
create index if not exists recipe_cook_history_user_recipe_cooked_idx
  on public.recipe_cook_history (user_id, recipe_id, cooked_at desc);

alter table public.recipe_cook_history enable row level security;

create policy "recipe_cook_history_owner_select"
  on public.recipe_cook_history
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "recipe_cook_history_owner_insert"
  on public.recipe_cook_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "recipe_cook_history_owner_update"
  on public.recipe_cook_history
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "recipe_cook_history_owner_delete"
  on public.recipe_cook_history
  for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.recipe_cook_history is
  'Append-only per-cook log: duration, scale, rating, free-text note. Drives the Cook screen "Last time" surface. Distinct from user_recipe_notes (rolling state).';
comment on column public.recipe_cook_history.cooked_at is
  'Wall-clock moment the user finished the cook session. Drives the "Last time: 12 min, 4 stars, ''cooked 5 min less''" preview.';
comment on column public.recipe_cook_history.duration_seconds is
  'Total cook-mode session length in seconds. NULL when the row was written without a captured timer (e.g. retroactive log).';
comment on column public.recipe_cook_history.scale_factor is
  'Scale factor the user picked for this cook. Mirrors COOK_SCALE_PRESETS in src/lib/nutrition/recipeScale.ts (0.5..4 today).';
comment on column public.recipe_cook_history.rating is
  'User rating for THIS cook (1..5). Distinct from user_recipe_notes.personal_rating (rolling). NULL = not rated.';
comment on column public.recipe_cook_history.note is
  'Per-cook free-text note ("added more garlic, cooked 5 min less"). Capped at 500 chars; long-form rolling notes belong in user_recipe_notes.';

NOTIFY pgrst, 'reload schema';
