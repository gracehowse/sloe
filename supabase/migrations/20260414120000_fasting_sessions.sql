-- Add fasting_sessions JSONB column to profiles for storing fasting history
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fasting_sessions jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.fasting_sessions IS 'Array of {start: ISO, end: ISO|null} fasting session objects, pruned to 90 days';

NOTIFY pgrst, 'reload schema';
