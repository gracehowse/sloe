-- ENG-123 — collapse legacy Base tier holders to Free before paid GA.
-- Safe to run multiple times (idempotent). Review row count before prod.
--
-- Usage (service role / SQL editor):
--   SELECT count(*) FROM profiles WHERE user_tier = 'base';
--   \i supabase/scripts/migrate_base_tier_to_free.sql

UPDATE profiles
SET user_tier = 'free'
WHERE user_tier = 'base';
