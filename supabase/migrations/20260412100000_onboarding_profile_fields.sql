-- Onboarding profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goal_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS plan_pace text DEFAULT 'steady',
  ADD COLUMN IF NOT EXISTS nutrition_strategy text DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS calorie_schedule text DEFAULT 'even',
  ADD COLUMN IF NOT EXISTS high_days jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS fasting_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fasting_window text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_fiber integer DEFAULT 25,
  ADD COLUMN IF NOT EXISTS dob date;

-- Allow decimal weight/height
ALTER TABLE public.profiles ALTER COLUMN weight_kg TYPE numeric USING weight_kg::numeric;
ALTER TABLE public.profiles ALTER COLUMN height_cm TYPE numeric USING height_cm::numeric;
