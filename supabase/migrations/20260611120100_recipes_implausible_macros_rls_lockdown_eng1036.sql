-- ENG-1036 / launch-readiness audit P1-1 — lock down the public-readable
-- SECURITY DEFINER recipe view.
--
-- THE BUG (confirmed live, conf 9): `public.recipes_implausible_macros` is a
-- diagnostic view (flags recipes whose macro-derived kcal disagrees with the
-- stated per-serving kcal) created via Dashboard DDL — it exists in the live
-- DB and in the generated database.types.ts but in NO tracked migration. It is
-- defined SECURITY DEFINER (Supabase advisor lint 0010 = ERROR), so it reads
-- `recipes` with the VIEW OWNER's privileges, bypassing the
-- `recipes_select_published_or_own` RLS policy. `information_schema` grants show
-- SELECT for both `anon` and `authenticated`, and PostgREST exposes it at
-- `/rest/v1/recipes_implausible_macros`. Verified live for this fix: a request
-- with the publishable/anon key returns HTTP 200 (0 rows today only because no
-- recipe currently trips the implausibility predicate). The moment one
-- import-parsed draft has implausible macros — routine — that PRIVATE,
-- UNPUBLISHED draft (id, title, author_id, macros) becomes world-readable to
-- anyone holding the bundled anon key.
--
-- No app code SELECTs this view (grep across src/, app/, apps/mobile/ for
-- `recipes_implausible_macros` returns only the generated database.types.ts) —
-- it is maintenance-only. So we keep the view for diagnostics but (1) make it
-- honour the querying user's RLS via `security_invoker = true` (Postgres 15+),
-- and (2) revoke the public SELECT grants so only privileged roles can read it.
-- Either alone closes the hole; we do both (defence in depth + clears the 0010
-- ERROR lint).
--
-- `ALTER VIEW ... SET (security_invoker = true)` flips the execution context
-- WITHOUT needing to redefine the view's SELECT (whose exact text lives only in
-- the live catalog, not in-repo) — so this is a minimal, robust, forward-only
-- change that cannot drift from an unknown view body.
--
-- FORWARD-ONLY SAFE: no data touched. Guarded so it no-ops cleanly if the view
-- is ever dropped.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).
-- After apply: re-run the Supabase security advisor and confirm lint 0010
-- (security_definer_view) is cleared for this relation.

set search_path = public;

do $$
begin
  if exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'recipes_implausible_macros'
       and c.relkind = 'v'
  ) then
    -- 1. RLS now applies as the querying role (closes the SECURITY DEFINER
    --    bypass). A non-owner without rows visible under recipes RLS sees none.
    execute 'alter view public.recipes_implausible_macros set (security_invoker = true)';

    -- 2. Remove the public read grants. Maintenance reads run as the service
    --    role / table owner, which retain access; PostgREST no longer exposes
    --    the relation to anon / authenticated.
    execute 'revoke select on public.recipes_implausible_macros from anon';
    execute 'revoke select on public.recipes_implausible_macros from authenticated';

    comment on view public.recipes_implausible_macros is
      'Diagnostic-only: recipes whose macro-derived kcal disagrees with stated kcal. ENG-1036 (audit P1-1, 2026-06-11): security_invoker=true so RLS applies; SELECT revoked from anon + authenticated (was a SECURITY DEFINER public-readable RLS bypass — advisor lint 0010). Not read by any app code.';
  else
    raise notice 'recipes_implausible_macros view not found — skipping ENG-1036 lockdown (already dropped or never created).';
  end if;
end
$$;
