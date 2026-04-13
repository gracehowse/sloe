-- Resolve dual fiber columns on profiles.
-- Migration 20260412100000 originally added `target_fiber`; schema.sql and app code
-- use `target_fiber_g`. If both exist, copy data from the legacy column then drop it.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'target_fiber'
  ) THEN
    -- Backfill: where target_fiber_g is NULL but target_fiber has a value
    UPDATE public.profiles
    SET target_fiber_g = target_fiber
    WHERE target_fiber_g IS NULL AND target_fiber IS NOT NULL;

    ALTER TABLE public.profiles DROP COLUMN target_fiber;
  END IF;
END $$;
