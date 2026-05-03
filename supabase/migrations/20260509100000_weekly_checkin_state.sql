-- 20260509100000_weekly_checkin_state.sql
--
-- Weekly TDEE check-in ritual state — supports the new MacroFactor-style
-- weekly modal that surfaces the adaptive-TDEE delta and lets the user
-- accept a new target or keep the current one
-- (PR claude/weekly-checkin-ritual-v2, 2026-05-02 — rebuild of #26).
--
-- WHY:
--   The Suppr math pipeline (`adaptiveTdee.ts` + `refreshAdaptiveTdee.ts`)
--   updates the user's TDEE silently after each weigh-in. MacroFactor's
--   hook is the *moment*: a weekly modal that confirms "your real burn
--   changed, here's your new target". This migration adds the two
--   columns the gating logic needs (`shouldShowWeeklyCheckin` in
--   `src/lib/nutrition/weeklyCheckin.ts`):
--     - `last_weekly_checkin_shown_at`: timestamp of the last time the
--       modal rendered (any decision). Drives the 6-day cooldown.
--     - `last_weekly_checkin_decision`: which CTA the user tapped, so
--       we can later attribute "accepted" decisions to a downstream
--       target update event without re-deriving from analytics.
--
-- DESIGN NOTES:
--   - Both columns nullable. NULL = "user has never seen the modal" /
--     "no decision on file". The gate treats null `shown_at` as
--     "no cooldown active", so the modal can fire on first eligible
--     visit.
--   - `last_weekly_checkin_decision` is enum-constrained to three
--     values (`accepted`, `kept_current`, `dismissed`) plus null.
--     `dismissed` is reserved for future swipe/backdrop dismiss UX —
--     today the modal only emits `accepted` or `kept_current`.
--   - No backfill. Existing rows stay null; the gate's null-safe
--     handling makes that the correct default.
--
-- LOCK SAFETY:
--   - ADD COLUMN with no default + nullable → metadata-only on PG12+.
--   - ADD CONSTRAINT CHECK without NOT VALID → all existing rows are
--     null, satisfying the IN check vacuously.
--
-- DOWN SQL (manual rollback if ever needed):
--   ALTER TABLE public.profiles
--     DROP CONSTRAINT IF EXISTS profiles_last_weekly_checkin_decision_check;
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS last_weekly_checkin_decision;
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS last_weekly_checkin_shown_at;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_weekly_checkin_shown_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_weekly_checkin_decision text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_last_weekly_checkin_decision_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_last_weekly_checkin_decision_check
      CHECK (last_weekly_checkin_decision IN ('accepted','kept_current','dismissed'));
  END IF;
END $$;
