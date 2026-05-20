-- ENG-566: flip prefer_activity_adjusted_calories default from false to true
-- for new users. MFP / Lose It / Cal AI all default to activity-adjusted goals.
-- Existing users keep their current value (no UPDATE on existing rows).
alter table public.profiles
  alter column prefer_activity_adjusted_calories set default true;
