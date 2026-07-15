-- ENG-1420 — server-side plausibility gate on manual custom-food creation.
--
-- Manual custom-food creation previously wrote directly from the client to
-- `public.user_custom_foods` with ZERO plausibility check (neither client nor
-- server). A user could persist an impossible macro set — e.g. 50 kcal with
-- 40g protein + 40g carbs + 40g fat, which the Atwater 4/4/9 model implies is
-- ~700 kcal — violating the project rule "reject low-confidence / implausible
-- nutrition; never guess".
--
-- The write now goes through the server-enforced `POST /api/custom-foods`
-- route, which runs `scaledMacrosPlausible()` (the same Atwater check the
-- barcode-contribution `/api/user-foods` route uses) and returns HTTP 422
-- `implausible_macros` unless the request carries an explicit
-- `acknowledgeImplausible: true`.
--
-- This column records WHEN that override was used, so an intentional
-- "these numbers really are correct" save is distinguishable from an
-- unguarded gap:
--   * false (default) — the macros passed the gate, OR the row predates this
--     column (all existing rows backfill to false via the default).
--   * true            — the macros FAILED the gate and the user explicitly
--     confirmed them anyway.
--
-- Read path is unaffected: `rowToCustomFood` ignores this column, so custom
-- foods scale + log exactly as before. This is a provenance/audit flag, not a
-- nutrition value.

alter table public.user_custom_foods
  add column if not exists plausibility_overridden boolean not null default false;

comment on column public.user_custom_foods.plausibility_overridden is
  'ENG-1420: true only when the user explicitly bypassed a FAILING Atwater plausibility gate on create (acknowledgeImplausible). false = passed the gate or predates the column.';

NOTIFY pgrst, 'reload schema';
