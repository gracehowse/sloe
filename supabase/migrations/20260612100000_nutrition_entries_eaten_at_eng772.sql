-- ENG-772 — editable consumption time (nullable, no default, no backfill).
alter table public.nutrition_entries
  add column if not exists eaten_at timestamptz;

comment on column public.nutrition_entries.eaten_at is
  'When the user ate this entry (local consumption instant). Chronology uses coalesce(eaten_at, created_at).';
