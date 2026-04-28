-- ML-01 / X-03 fix (audit 2026-04-28) — distinguish onboarding-skip
-- from a fully-engaged onboarding completion in the
-- `profiles.target_calories_source` provenance column.
--
-- Before this migration the Skip button on legacy mobile onboarding
-- wrote `target_calories_source = 'onboarding'` for a user who never
-- engaged with the body-stat steps. That made every analytics /
-- engineering query that filtered "personalised vs default" treat
-- skipped users as if they had personalised. The customer-lens audit
-- flagged this as a P0 trust failure: the database lies about whether
-- the user set their targets.
--
-- Adding `'onboarding_skip'` to the CHECK constraint lets the legacy
-- skip path (apps/mobile/app/onboarding.tsx) write a distinct value
-- so audits can split skip vs full-completion. The legacy flow is
-- being retired per
-- docs/planning/2026-04-28-onboarding-v2-mobile-port-plan.md so this
-- is a stop-gap that lets us ship the audit fix without waiting for
-- the v2 mobile port to land.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_target_calories_source_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_target_calories_source_check
  CHECK (target_calories_source IN (
    'onboarding',
    'onboarding_skip',
    'user',
    'recompute',
    'digest_recalibration',
    'reset_default'
  ));
