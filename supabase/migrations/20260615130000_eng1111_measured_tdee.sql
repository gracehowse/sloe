-- ENG-1111 — measured TDEE from HealthKit daily burn (server-written only).
alter table profiles add column if not exists measured_tdee numeric;
alter table profiles add column if not exists measured_tdee_confidence text;
alter table profiles add column if not exists measured_tdee_updated_at timestamptz;

comment on column profiles.measured_tdee is
  'Median daily resting+active burn (HealthKit) when wear-completeness gate passes (ENG-1111).';
comment on column profiles.measured_tdee_confidence is
  'medium | high — mirrors adaptive_tdee_confidence shape.';
comment on column profiles.measured_tdee_updated_at is
  'Last server-side recompute via refreshAdaptiveTdeeForUser.';
