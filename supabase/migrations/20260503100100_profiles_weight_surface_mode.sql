-- T13 — full-sweep 2026-04-24 Phase 2 condition.
--
-- Close DI-P0-03 (diversity-inclusion audit, 2026-04-19): the Digest +
-- Progress surfaces currently render weight as a first-class stat with
-- no opt-out — an ED / dysphoria risk for users who would rather see
-- trends without absolute numbers, or none of it at all.
--
-- Policy (docs/decisions/2026-04-24-phase2-architecture-choices.md §T13):
--   - 'show'        — current behaviour. Weight tile + chart + absolute kg.
--   - 'hide'        — Digest replaces Weight tile with logging consistency;
--                     Progress collapses weight section behind a "Show
--                     weight data" button; streak + projection not shown.
--   - 'trends_only' — arrow direction + "slightly up / down / stable" copy;
--                     no absolute kg anywhere.
--
-- Default is 'show' so existing users see no change until they opt in
-- from Settings. The column is NOT NULL with a sensible default, safe
-- on large tables (metadata-only in Postgres for DEFAULT addition).
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

set search_path = public;

alter table public.profiles
  add column if not exists weight_surface_mode text not null default 'show';

-- CHECK constraint in a DO block so re-runs are idempotent (constraint
-- name is deterministic; `if not exists` pattern).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_weight_surface_mode_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_weight_surface_mode_check
      check (weight_surface_mode in ('show', 'hide', 'trends_only'));
  end if;
end $$;

comment on column public.profiles.weight_surface_mode is
  'T13 (2026-04-24): controls weight visibility on Digest + Progress + weight chart. Defaults to "show" (legacy behaviour). Users opt into "hide" / "trends_only" under Settings to close DI-P0-03 (ED / dysphoria risk on unmuted weight).';
