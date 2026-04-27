# Decision log: profiles lockdown — forward-compat for unborn billing columns (P0-4, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P0 #4 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The audit reported `subscription_status`, `trial_started_at`, `trial_ends_at`, `trial_days_given` as currently client-writable. Verification on 2026-04-25 confirmed these columns **do not exist** anywhere in the schema today. The 2026-04-24 verdict listed them aspirationally; the audit and verifier both read them as present.

---

## Decision

The existing trigger (`profiles_tier_column_lockdown`, migration 20260503100000) correctly covers every billing-sensitive column that exists today (`user_tier`, `stripe_customer_id`). No additional explicit guards are required immediately.

To prevent the original concern from re-emerging silently when these columns are eventually introduced, P0-4 ships:

1. **Forward-compat migration** `supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql` — re-states the trigger function with an explicit `forward_banned text[]` array containing seven future column names (`subscription_status`, `trial_started_at`, `trial_ends_at`, `trial_days_given`, `billing_period_start_at`, `billing_period_end_at`, `paid_through_at`). At runtime, if any of those names appears on the row payload (`to_jsonb(NEW) ? '<name>'`) and a client-side caller attempts to mutate it, the trigger raises `42501`. Service-role writers still bypass via `auth.role()` short-circuit.
2. **Static contract test** `tests/unit/profilesLockdownInventory.test.ts` — scans every SQL migration for `ALTER TABLE … profiles … ADD COLUMN <col>` against a billing-name regex (`subscription_*`, `trial_*`, `billing_*`, `paid_through_*`, `entitlement_*`, `plan_id`). Each match must be paired with either an explicit guard (`new.<col> is distinct from old.<col>`) or a `forward_banned` array entry in the lockdown migrations. Test fails when a future migration adds an unguarded billing column. **2/2 green.**
3. **Audit correction** in `docs/audits/2026-04-25-opus47-codebase-review.md` §2.3 documenting the false-positive and the forward-compat deliverable.

## Rationale

The right response to a phantom finding is to make the future-state contract explicit, not to invent a guard for a column that doesn't exist. The forward-compat migration does that with two layers:

- **Runtime fallback** — the jsonb-projection check catches a future column added without an explicit guard branch (a maintainer who adds `subscription_status` to `profiles` and forgets to extend the trigger). The error message says exactly which column triggered and points at the migration that needs updating.
- **Compile-time fallback** — the static test fails on PR review when a billing-named column is added without being in the lockdown source. CI surfaces this before merge, well before any client can attempt to write the column.

Together they give a high-confidence guarantee that the original concern (a future "permanent trial" exploit via client UPDATE of `trial_ends_at`) is closed-by-construction whenever those columns ship.

## Alternatives considered

- **Add the columns now and lock them down.** Rejected. Stripe and RevenueCat webhooks today derive the entitlement (`user_tier`) from the upstream subscription state without persisting `subscription_status` / `trial_*` separately. Adding columns we don't write is YAGNI; doing so without a write path also makes them stale and misleading. Better to add the columns when (and only when) the writers also ship.
- **Skip the migration entirely; ship only the static test.** Rejected. The runtime fallback adds a second line of defence that costs nothing — a single trigger function rewrite with no schema change. Defence-in-depth is cheap here.
- **Let the audit correction be the only deliverable.** Rejected. Documentation alone gets stale; the forward_banned array literal is in production SQL and shows up in `pg_proc.prosrc` for any DB-level audit tool. The static test makes the contract visible to the next contributor.

## Implementation

- `supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql` — new migration. Re-creates `profiles_tier_column_lockdown` with the existing explicit guards plus a forward_banned array + jsonb runtime fallback. No schema change. Forward-only safe.
- `tests/unit/profilesLockdownInventory.test.ts` — new meta-test. Asserts the forward_banned array contains the audit's listed columns; scans all migrations for billing-named profile columns and pairs them with explicit guards or array entries. **2/2 green.**
- `docs/audits/2026-04-25-opus47-codebase-review.md` §2.3 — updated to flag the original finding as a phantom gap and document the forward-compat deliverable.

## Platforms affected

- **Supabase:** new migration `20260503102000_profiles_lockdown_forward_compat.sql` to apply. Forward-only safe; no data change.
- **Web / Mobile:** none. The runtime guard is invisible until a client tries to mutate a forward-banned column, at which point the existing 42501 handling already used by the original lockdown applies.

## Verification

- `tests/unit/profilesLockdownInventory.test.ts` — 2/2 green.
- Sibling tests for the prior lockdown unaffected.
- Migration applies cleanly via `supabase db push --linked` (Grace runs at end-of-band).

## Related artefacts

- [P0 punch list](../audits/2026-04-25-opus47-codebase-review.md#7-prioritized-punch-list)
- [Initial profiles tier-column lockdown](../audits/2026-04-24-full-sweep.md) (T2)
- [supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql](../../supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql)
- [supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql](../../supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql)

## Revisit when

- A migration adds `subscription_status`, `trial_*`, `billing_*`, `paid_through_*`, `entitlement_*`, or `plan_id` to `profiles`. The static test will fail; the maintainer must add an explicit guard branch and remove the column from `forward_banned`.
- The Stripe or RevenueCat webhook starts persisting trial state on `profiles` directly (today they only set `user_tier`).
- An attacker is observed attempting client-side billing-column writes in the wild — the runtime exception will surface via Sentry; investigate the path that allowed the attempt.
