-- Some environments applied migrations before `dietary_restrictions` appeared in repo SQL;
-- PostgREST errors if clients select a missing column. Canonical prefs live in `dietary`;
-- this column remains optional JSON for legacy / display parity.
alter table public.profiles
  add column if not exists dietary_restrictions jsonb;
