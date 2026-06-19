# ENG-845 — search_path pg_temp consistency tail (ENG-557 F4)

- **Date:** 2026-06-19
- **Area:** Security · Defence-in-depth (Postgres SECURITY DEFINER hardening)
- **Status:** **Staged, awaiting apply.** Migration `20260615180000_eng845_search_path_pg_temp_hardening.sql` is staged; **Grace must run `supabase db push --linked`** (CLAUDE.md forbids Claude/MCP applying committed migrations). Confirmed live after push by Supabase advisor lints 0028/0029 clearing for these functions.
- **Severity:** P3 (defence-in-depth). The real `pg_temp` object-shadowing injection vector is **already closed** — every ref inside these functions is schema-qualified — so this is pure consistency hardening, not a live-exploit fix.
- **Closes:** ENG-557 **F4** — the explicitly-deferred tail of the 2026-06-02 SECURITY DEFINER RPC audit (`supabase/migrations/20260602120000_eng557_rpc_security_hardening.sql` header, lines 23–26).
- **Owner of apply step:** Grace.

## Summary

The ENG-557 audit (2026-06-02) closed F1 (`redeem_promo_code` → `search_path = public, pg_temp`) and F2 (`recompute_verified_food_canonical` EXECUTE revoke), and **explicitly deferred F4**: the remaining SECURITY DEFINER helpers that set `search_path = public` *without* `pg_temp`. This migration is that tail.

`search_path = public, pg_temp` is the Supabase-recommended pinned form (used by F1 in `20260602120000` and the ENG-556 perf-pin sweep `20260516150000`). Appending `pg_temp` ensures a temporary object can never resolve ahead of a schema-qualified one, even if a future edit accidentally drops a `public.` qualifier. **This is `ALTER … SET search_path` only — no REVOKE, no grant changes.**

## Functions covered (12)

Signatures confirmed by grepping the committed `CREATE`/`CREATE OR REPLACE` statements in `supabase/migrations/` (no live DB access; applying migrations is forbidden). `ALTER FUNCTION` needs the exact identity-argument list to disambiguate.

| Function | Signature | Kind | Latest-definition source |
|---|---|---|---|
| `auth_household_ids` | `()` | RLS helper | `20260423110000_household_rls_recursion_fix.sql` |
| `auth_user_save_count` | `()` | RLS helper | `20260520100000_saves_rls_recursion_fix.sql` |
| `auth_profile_user_tier` | `()` | RLS helper | `20260520100000_saves_rls_recursion_fix.sql` |
| `public_recipe_save_count` | `(uuid)` | public stat RPC | `20260503101000_schema_drift_repair.sql` |
| `public_creator_follower_count` | `(uuid)` | public stat RPC | `20260503101000_schema_drift_repair.sql` |
| `public_author_follower_count` | `(uuid)` | public stat RPC | `20260503101000_schema_drift_repair.sql` |
| `public_recipe_save_counts_batch` | `(uuid[])` | public stat RPC | `20260423140000_public_recipe_save_counts_batch.sql` |
| `my_recipe_save_stats` | `()` | author-scoped RPC | `20260503101000_schema_drift_repair.sql` |
| `my_recipe_plan_add_stats` | `()` | author-scoped RPC | `20260503101000_schema_drift_repair.sql` |
| `user_foods_guard_status_transition` | `()` | trigger fn | `20260512100000_user_foods_p0_hardening.sql` |
| `user_foods_reset_verification_on_macro_edit` | `()` | trigger fn | `20260512100000_user_foods_p0_hardening.sql` |
| `user_foods_after_status_change` | `()` | trigger fn | `20260512100000_user_foods_p0_hardening.sql` |

Each was verified to currently carry bare `search_path = public` and `security definer`, and to have **no prior `ALTER FUNCTION … SET search_path`** in the migrations tree (so this is the first pin). The `user_foods_*` trio already had EXECUTE revoked from `anon`/`authenticated` (`20260516180000`); this change is search_path only and leaves those revokes intact.

## Scope guardrails (held)

- **ALTER … SET search_path ONLY.** No REVOKE, no grant change. (Test asserts the migration contains no `revoke`/`grant`.)
- **Intended-public RPCs untouched.** `household_invite_*`, `household_join_by_invite_code`, `redeem_promo_code`, `recompute_verified_food_canonical` were assessed SAFE / handled by the audit — they are authenticated/anon-executable BY DESIGN with correct in-body authz. Touching them would break the invite + public-recipe + promo flows. (Test asserts none of them appear in executable SQL.)

## Why this form (not `search_path = ''`)

The established repo convention is `public, pg_temp` — F1 in `20260602120000` and the five functions in `20260516150000` all use it. `= ''` (empty search_path, forcing full qualification everywhere) is a stricter alternative but would be a *new* convention here and is unnecessary: every ref is already schema-qualified, so the marginal safety over `public, pg_temp` is nil while the readability cost (every identifier must be schema-qualified at call sites the function relies on) is real. Matching the existing form keeps the catalog uniform. Confidence: 8.

## Test coverage

- `tests/unit/eng845SearchPathHardeningMigration.test.ts` — static migration-shape contract (same pattern as `saveMealPlanRpcMigration` / `claimWebPushSubscriptionMigration`): pins each of the 12 `ALTER FUNCTION <name>(<args>) SET search_path = public, pg_temp` statements, asserts exactly 12 ALTERs (no extras), asserts no bare `search_path = public` (regression guard), asserts ALTER-only (no grant/revoke), and asserts the out-of-scope RPCs are untouched in executable SQL. Mutation-verified: dropping `pg_temp` on any function fails the suite.

**Live DB tests:** not runnable here (no `psql`/DB password; migration-apply forbidden). The live effect is confirmed post-push by the Supabase security advisors (lints **0028** `function_search_path_mutable` / **0029**) clearing for these functions, plus the `proconfig` query in the migration's verification footer.

## Cross-platform parity

N/A — this is a single Postgres surface with no app-code change on web or mobile. No client reads change; the pinned `search_path` is transparent to callers. No intentional divergence.

## References

- ENG-557 audit + F1/F2: `supabase/migrations/20260602120000_eng557_rpc_security_hardening.sql` (F4 deferral noted in its header).
- Prior `pg_temp` pin precedent: `supabase/migrations/20260516150000_perf_rls_initplan_wrap_auth_calls.sql` (Part 2, ENG-556).
- Trigger-fn EXECUTE revoke (the `user_foods_*` trio): `supabase/migrations/20260516180000_security_revoke_trigger_function_rpc_grants.sql`.
- Migration-apply rule: `.claude/CLAUDE.md` ("Never apply Supabase migrations via MCP `apply_migration`…").
