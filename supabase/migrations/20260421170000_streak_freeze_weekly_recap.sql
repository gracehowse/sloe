-- Streak freeze + Weekly recap (Batch 4.11).
--
-- Adds retention-friendly profile columns so the logging "streak" survives
-- occasional zero-meal days (sick / travel), and tracks the user's
-- opt-in + last-seen state for the Sunday-evening Weekly Recap card.
--
-- Columns:
--   - `streak_freeze_budget_max` (smallint, default 3, 0..10) — the cap on
--     how many "freeze" credits a user can hold at once. `0` disables the
--     feature entirely for a user.
--   - `streak_freezes_earned_at` (jsonb array of `{ earnedAt: ISO }`) —
--     append-only ledger of credited freezes (one per 7-day streak
--     milestone; see `earnFreezeIfMilestone` in
--     `src/lib/nutrition/streakFreeze.ts`). Entries older than 90 days are
--     pruned client-side by `dropOldFreezesForMonth` to bound growth.
--   - `streak_freezes_used_history` (jsonb array of
--     `{ dateKey: YYYY-MM-DD, earnedAt: ISO }`) — one row per consumed
--     freeze. `dateKey` is the zero-meal date that was "saved" by the
--     freeze so the UI can render a factual "Freeze used (Tue)" line.
--   - `weekly_recap_push_enabled` (boolean, default true) — opt-out on
--     the local Sunday 18:00 push that nudges users toward the recap. We
--     default ON so users discover the recap; respecting
--     `week_start_day` the push fires Saturday instead for Monday-start
--     users. Stored here so both platforms read the same flag.
--   - `weekly_recap_last_seen_week_key` (text, nullable) — the ISO-week
--     key the user last dismissed/viewed (`YYYY-Www`, e.g. `2026-W15`).
--     `shouldShowRecap` uses this to gate the card so we never re-show
--     the same week twice.
--
-- Non-negotiables:
--   - No shame copy lives in the DB. Strings like "Freeze used (Tue)"
--     are in the UI layer only.
--   - Raw streak (`computeLoggingStreak`) is never overwritten — the
--     "protected" streak is a derived value in `computeProtectedStreak`
--     so the two can be surfaced side-by-side.
--
-- Types are NOT regenerated in this migration — `database.types.ts` is
-- updated separately (see `docs/data/schema.md`).

alter table public.profiles
  add column if not exists streak_freeze_budget_max smallint not null default 3
    check (streak_freeze_budget_max between 0 and 10);

alter table public.profiles
  add column if not exists streak_freezes_earned_at jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists streak_freezes_used_history jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists weekly_recap_push_enabled boolean not null default true;

alter table public.profiles
  add column if not exists weekly_recap_last_seen_week_key text null;

NOTIFY pgrst, 'reload schema';
