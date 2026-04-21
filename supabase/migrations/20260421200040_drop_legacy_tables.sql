-- H11: Drop legacy JSONB tables left behind by the 2026-04-13 relational split.
--
-- 20260413100000_relational_user_data.sql renamed the old single-row JSONB
-- tables to *_legacy to give us a 30-day rollback window. That window has
-- now elapsed (well over 30 days since 2026-04-13), the relational tables
-- have been the source of truth in production throughout, and no code path
-- references the _legacy tables. Safe to drop.
--
-- IF EXISTS guards make this idempotent — if a preview DB never had them
-- (e.g. seeded fresh after the rename migration), the drops no-op cleanly.

drop table if exists public.meal_plans_legacy;
drop table if exists public.nutrition_journals_legacy;
drop table if exists public.shopping_lists_legacy;

NOTIFY pgrst, 'reload schema';
