-- ENG-1250 / ENG-1251 — persisted community food-database contribution consent.
--
-- Stage for `supabase db push --linked`; DO NOT apply via MCP apply_migration.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_food_share_consent boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_food_share_consent_at timestamptz;

COMMENT ON COLUMN public.profiles.community_food_share_consent IS
  'User opted in to submit barcode corrections to the shared food DB (ENG-1250).';

COMMENT ON COLUMN public.profiles.community_food_share_consent_at IS
  'Timestamp of the latest opt-in; cleared on withdrawal.';
