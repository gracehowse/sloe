-- 20260504100100_milestone_state.sql
--
-- 30-day logging milestone state — supports the new Lifesum/MacroFactor-
-- style "30 days of logging" trust moment surfaced once on Today when
-- the user hits 30 distinct logged days.
--
-- WHY:
--   Lifesum + MacroFactor light up at 30 / 90 days; Suppr was silent.
--   `shouldShowMilestone30Day` in `src/lib/nutrition/milestone30Day.ts`
--   needs a once-and-done flag so the surface fires exactly once per
--   user. The column stores the timestamp of the first show so analytics
--   can later attribute the moment to a date if we want a 30/60/90 cohort
--   slice — `last_milestone_30_decision` would be redundant because
--   there is only one decision (dismiss).
--
-- DESIGN NOTES:
--   - `milestone_30_shown_at` is nullable — null means "never shown"
--     and the gate is open. Once written, the gate refuses to re-fire.
--   - No backfill. Existing rows stay null; only users who *cross* the
--     30-day threshold from this point forward see the moment.
--
-- LOCK SAFETY:
--   - ADD COLUMN with no default + nullable → metadata-only on PG12+.
--
-- DOWN SQL:
--   ALTER TABLE public.profiles
--     DROP COLUMN IF EXISTS milestone_30_shown_at;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS milestone_30_shown_at timestamptz;
