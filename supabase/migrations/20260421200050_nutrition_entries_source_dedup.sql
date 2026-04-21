-- H12: Add source_id column + partial unique index to de-duplicate non-HealthKit nutrition imports.
--
-- nutrition_entries.source was added in 20260416140000_nutrition_entries_source.sql.
-- source_id does not yet exist — added here so the dedup index can reference it.

alter table public.nutrition_entries
  add column if not exists source_id text;

comment on column public.nutrition_entries.source_id is 'Opaque identifier from the upstream source (e.g. recipe UUID, barcode scan ID, CSV row key). Used with source for deduplication.';

-- H12: Partial unique index to de-duplicate non-HealthKit nutrition imports.
--
-- HealthKit imports are already de-duped via
-- `idx_ne_user_health_sample_id` (user_id, health_sample_id) WHERE
-- health_sample_id IS NOT NULL (see 20260416190000_nutrition_entries_health_sample_id.sql).
--
-- Other provenance surfaces (recipe logs, saved-meal re-logs, CSV import,
-- third-party integrations) populate (source, source_id) instead. Without
-- a dedup guard, a retried webhook or double-tap on "Log" can create
-- duplicate entries. This partial unique index enforces at-most-once per
-- (user_id, source, source_id) for the non-HealthKit path, while leaving
-- manual/ad-hoc entries (source_id IS NULL) unconstrained.

create unique index if not exists nutrition_entries_source_dedup
  on public.nutrition_entries (user_id, source, source_id)
  where health_sample_id is null and source_id is not null;

NOTIFY pgrst, 'reload schema';
