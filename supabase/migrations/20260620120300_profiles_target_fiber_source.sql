-- ENG-847: dedicated provenance for manually-set fibre targets.
-- Mirrors profiles.target_calories_source so recomputes can preserve
-- user-set fibre without overloading calorie provenance.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_fiber_source text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_target_fiber_source_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_target_fiber_source_check
  CHECK (
    target_fiber_source IS NULL
    OR target_fiber_source IN ('onboarding', 'recompute', 'user')
  );

COMMENT ON COLUMN public.profiles.target_fiber_source IS
  'Provenance for target_fiber_g: onboarding, recompute, or user. User-set fibre is preserved across target recomputes.';

-- Historical manual macro saves used target_calories_source = user as the only
-- available provenance bit. Preserve that intent for existing rows.
UPDATE public.profiles
SET target_fiber_source = 'user'
WHERE target_fiber_source IS NULL
  AND target_calories_source = 'user'
  AND target_fiber_g IS NOT NULL
  AND target_fiber_g > 0;
