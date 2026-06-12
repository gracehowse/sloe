-- Audit 2026-06-12 (docs/ux/reviews/2026-06-12-launch-readiness-audit.md §13) —
-- plausibility bound on eaten_at. The UI clamps time edits to the anchor day,
-- but the column previously accepted any timestamptz from any future write
-- path (CSV import, AI logging). Fixed bounds (not now()-relative) so the
-- constraint stays immutable-safe for dump/restore.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nutrition_entries_eaten_at_sane'
      and conrelid = 'public.nutrition_entries'::regclass
  ) then
    alter table public.nutrition_entries
      add constraint nutrition_entries_eaten_at_sane
      check (
        eaten_at is null
        or (eaten_at >= timestamptz '2000-01-01 00:00:00+00'
            and eaten_at < timestamptz '2100-01-01 00:00:00+00')
      )
      not valid;

    alter table public.nutrition_entries
      validate constraint nutrition_entries_eaten_at_sane;
  end if;
end $$;
