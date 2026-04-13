-- Adaptive TDEE columns for storing computed expenditure
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adaptive_tdee int,
  ADD COLUMN IF NOT EXISTS adaptive_tdee_confidence text,
  ADD COLUMN IF NOT EXISTS adaptive_tdee_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.adaptive_tdee IS 'Computed adaptive TDEE in kcal from energy balance algorithm';
COMMENT ON COLUMN public.profiles.adaptive_tdee_confidence IS 'low | medium | high based on data completeness';
COMMENT ON COLUMN public.profiles.adaptive_tdee_updated_at IS 'When the adaptive TDEE was last recalculated';

NOTIFY pgrst, 'reload schema';
