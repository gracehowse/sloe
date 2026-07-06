-- ENG-1397 (2026-07-05 deep audit, live-DB security & RLS, findings
-- SEC-03/DI-02) — barcode_mappings is directly client-writable, bypassing
-- the rate-limited, service-role /api/barcode-mapping route entirely.
--
-- THE BUG (confirmed against the live DB):
--   - `barcode_mappings_write_own` (INSERT) and `barcode_mappings_update_own`
--     (UPDATE) let any authenticated user write a row directly via
--     PostgREST as long as `created_by = auth.uid()` — no rate limit
--     (`/api/barcode-mapping` is rate-limited; this path is not), no
--     plausibility check, and the client fully controls `is_verified`
--     (default false, but nothing stops a client passing `is_verified: true`
--     in the INSERT payload).
--   - `information_schema.role_table_grants` additionally shows `anon` and
--     `authenticated` holding raw DELETE/TRIGGER/TRUNCATE table grants on
--     this table. RLS policies never gate TRUNCATE (a documented Postgres
--     limitation — TRUNCATE checks only the table-level privilege, not row
--     policies), so a broad TRUNCATE grant is a real defense-in-depth gap
--     even though PostgREST's REST/RPC surface never exposes a TRUNCATE verb
--     today. Same class of gap as SEC-08 (deny-all billing tables) — revoked
--     here for the same reason: service-role bypasses RLS and keeps working
--     regardless of what anon/authenticated hold.
--
-- THE FIX: the app's OWN write path (app/api/barcode-mapping/route.ts) uses
-- `SUPABASE_SERVICE_ROLE_KEY` exclusively — confirmed no client-side code
-- anywhere in src/ or apps/mobile/ references this table directly (only the
-- generated database.types.ts files do). Service-role bypasses RLS
-- entirely, so this table needs ZERO client grants to keep working: drop
-- both write policies and revoke every non-SELECT privilege from
-- anon/authenticated. `barcode` is already the PRIMARY KEY (inherently
-- unique) and `source` already has a CHECK constraint restricting it to
-- ('OpenFoodFacts', 'Community') — both already correct, no action needed.
--
-- FORWARD-ONLY SAFE: revokes grants and drops two policies only; the public
-- SELECT policy (barcode lookups need to stay publicly readable) and every
-- column/constraint/trigger are untouched.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration — MCP
-- rewrites schema_migrations.version to wall-clock NOW(), drifting from the
-- future-dated filename prefix used for monotonic ordering).

set search_path = public;

drop policy if exists "barcode_mappings_write_own" on public.barcode_mappings;
drop policy if exists "barcode_mappings_update_own" on public.barcode_mappings;

revoke insert, update, delete, truncate, trigger
  on public.barcode_mappings
  from anon, authenticated;

notify pgrst, 'reload schema';
