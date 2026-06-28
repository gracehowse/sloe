-- ENG-1237 — body-fat % time series for Pro-gated composition trends.
--
-- Stage for `supabase db push --linked`; DO NOT apply via MCP apply_migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS body_fat_pct_by_day jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.body_fat_pct_by_day IS
  'Map of YYYY-MM-DD → body-fat percentage for composition trend charts (ENG-1237).';
