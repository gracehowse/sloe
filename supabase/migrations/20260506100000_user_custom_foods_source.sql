-- User-sentiment audit (round 4, 2026-04-30) — photo-log corrections
-- persist into the user's personal food bank so the next photo log of
-- the same item uses their corrected macros. Cal AI's failure pattern
-- ("Fix this only updates the title, not the macros") is the surface
-- competitive miss; MacroFactor's emerging lead is exactly this loop.
--
-- Why a new column instead of a new table:
--  - The shape of a "photo-corrected food" is identical to a custom
--    food (name, brand, baseGrams, macros, optional servings).
--  - Splitting into a parallel `photo_corrections` table would force a
--    join on every food-search lookup and re-introduce the dedupe
--    problem we already solved with `(user_id, lower(name))`.
--  - The single `user_custom_foods` table already RLS-scopes per-user
--    and dedupes by name; reusing it keeps the "personal food bank"
--    model coherent.
--
-- The `source` column distinguishes how the row landed in the bank:
--   - `manual`            (default for legacy rows + Create Custom Food UI)
--   - `photo_correction`  (auto-upserted from a confirmed photo-log review)
--   - `voice_correction`  (reserved for the same loop on voice — same
--                          failure pattern, same fix; not wired yet)
--
-- Default `manual` so existing rows + the Create Custom Food UI keep
-- their semantics. Idempotent via `add column if not exists`.

alter table public.user_custom_foods
  add column if not exists source text not null default 'manual';

-- Constrain the value set so a typo client-side can't poison the
-- column. Wrapped in a do-block so re-applying the migration after a
-- partial apply is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_custom_foods_source_check'
  ) then
    alter table public.user_custom_foods
      add constraint user_custom_foods_source_check
      check (source in ('manual', 'photo_correction', 'voice_correction'));
  end if;
end $$;

-- Index so future "list my photo corrections" surfaces (and any
-- analytics-side counts) don't full-scan the table. Cheap to maintain
-- — most users will have a small bank.
create index if not exists user_custom_foods_user_source_idx
  on public.user_custom_foods (user_id, source);

NOTIFY pgrst, 'reload schema';
