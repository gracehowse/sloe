-- A2 schema migration — target_calories provenance
-- Date: 2026-04-19 (file dated 2026-04-27 to keep the migration ordering monotonic
--                  with the latest existing migration, 20260427100000_null_publisher_image_urls.sql).
--
-- WHY:
--   The Maintenance Recalibrate suggestion (Progress Digest, Rule 2 of the 5-rule
--   cascade in `weeklyDigestSuggestion.ts`) needs to know **whether the user
--   touched their calorie target recently**. If a user hand-edited their target
--   in the last 14 days, the suggestion must be suppressed — re-suggesting a
--   change to a number the user just chose is presumptuous and breaks trust.
--
--   To do that without lying about provenance for older rows, we need two new
--   columns + a backfill that only attributes provenance where we can honestly
--   say "this came from onboarding."
--
-- DESIGN AUDIT: data-integrity (full audit, all 9 write sites mapped).
-- POLICY CALL:  nutrition-engine (added 5th enum value `reset_default` so the
--               two post-destructive-reset writes don't have to lie about being
--               "onboarding").
--
-- ENUM SEMANTICS (5 values):
--   onboarding          → set during initial onboarding flow (skip path or saveAndFinish)
--   user                → user manually edited macro/calorie targets in Profile/Settings
--   recompute           → activity-level recompute (BMR/TDEE pipeline re-run)
--   digest_recalibration → Progress Digest "Apply maintenance recalibration" CTA (NOT YET BUILT — future T7-dependent path via applyMaintenanceRecalibration.ts)
--   reset_default       → post-destructive-reset write (e.g. "Reset plan", "Erase all my data")
--                         where the target reverts to NUTRITION_DEFAULTS.calories
--
-- RULE 2 SUPPRESSION CONTRACT:
--   `target_calories_source = 'user'` AND `target_calories_set_at` within last
--   14 days → suppress Rule 2 (Maintenance Recalibration suggestion).
--   All other source values do NOT suppress.
--
-- STEP 2 (NOT IN THIS PR):
--   Both new columns will be made `NOT NULL` in a follow-up migration after
--   ≥1 week of clean writes (earliest ship 2026-05-04). Verification SQL to
--   run before Step 2 ships:
--
--     SELECT COUNT(*) FROM public.profiles
--       WHERE target_calories IS NOT NULL
--         AND (target_calories_set_at IS NULL OR target_calories_source IS NULL);
--     -- Must be 0 before Step 2.
--
-- LOCK SAFETY:
--   - ADD COLUMN with no default + nullable → metadata-only on PG12+, no table rewrite.
--   - ADD CONSTRAINT CHECK without NOT VALID → validates existing rows (all NULL,
--     so passes trivially since NULL satisfies the IN check vacuously).
--   - CREATE INDEX (no CONCURRENTLY) → fine on a small table; if profiles grows
--     above ~1M rows before this lands in prod, switch to CONCURRENTLY in a
--     separate migration that doesn't run in a transaction block.
--   - Backfill UPDATE only touches rows where target_calories IS NOT NULL AND
--     target_calories_source IS NULL → idempotent, re-runnable.
--
-- DOWN SQL (manual rollback if ever needed):
--   DROP INDEX IF EXISTS public.profiles_target_calories_user_set_idx;
--   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_target_calories_source_check;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS target_calories_source;
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS target_calories_set_at;

-- 1. New columns (nullable for now; Step 2 makes them NOT NULL)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_calories_set_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_calories_source text;

-- 2. Enum constraint (5 values; nullable column → NULL satisfies the check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_target_calories_source_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_target_calories_source_check
      CHECK (target_calories_source IN ('onboarding','user','recompute','digest_recalibration','reset_default'));
  END IF;
END $$;

-- 3. Partial index — only the user-set rows are queried by the Rule 2
--    suppression check (`source = 'user' AND set_at > now() - 14d`).
CREATE INDEX IF NOT EXISTS profiles_target_calories_user_set_idx
  ON public.profiles (id, target_calories_set_at)
  WHERE target_calories_source = 'user';

-- 4. Inline backfill — attribute existing target_calories rows to onboarding
--    (the only honest historical attribution: every previous write happened
--    inside the onboarding flow). Skip rows where target_calories IS NULL —
--    no value, no provenance to fabricate.
UPDATE public.profiles
  SET target_calories_source = 'onboarding',
      target_calories_set_at = COALESCE(created_at, NOW())
  WHERE target_calories IS NOT NULL
    AND target_calories_source IS NULL;
