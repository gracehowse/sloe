-- ENG-714 — separate identity language from sex-at-birth/BMR input.
-- Nullable and no default so skipping the optional onboarding field preserves
-- the existing profile shape. Do not use this column for metabolic math.
alter table public.profiles
  add column if not exists pronouns text;

comment on column public.profiles.pronouns is
  'Optional user-provided pronouns or gender identity text for personalisation; separate from profiles.sex metabolic input.';
