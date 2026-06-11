# Gate-0 database security — tier-lockdown INSERT guard, RLS view lockdown, promo comp path

- **Date:** 2026-06-11
- **Area:** Security · Data integrity · Entitlement integrity · Monetisation
- **Status:** **Applied + live-verified (2026-06-11).** Migrations `20260611120000`–`120200` pushed to production; `scripts/verify-gate0-db.mts` — 5/5 checks pass (exploit dead, view locked, promo RPC callable).
- **Severity:** P0 (ENG-1035) + P1 (ENG-1036, ENG-1043) — Gate-0 launch blockers per `docs/ux/reviews/2026-06-11-launch-readiness-audit.md` §10/§11/§16.
- **Branch:** `claude/skia-ring-2026-06-10`
- **Owner of apply step:** Grace (the migration-apply rule forbids MCP `apply_migration` and Claude running `supabase db push`).

## Summary

Three database-security fixes from the 2026-06-11 launch-readiness audit, all on
the `profiles.user_tier` entitlement surface or the recipe RLS surface. They are
the free-cohort launch gate (per `docs/ux/research/2026-06-11-launch-monetisation-sequencing.md`:
the 2026-07-01 free launch is gated by entitlement integrity + the comp path, not
billing).

| Issue | Audit | Migration | What it does |
|---|---|---|---|
| **ENG-1035** | P0-1 | `20260611120000_profiles_insert_lockdown_eng1035.sql` | BEFORE INSERT trigger closing the DELETE-then-INSERT tier-escalation bypass. |
| **ENG-1036** | P1-1 | `20260611120100_recipes_implausible_macros_rls_lockdown_eng1036.sql` | `security_invoker=true` + REVOKE anon/authenticated SELECT on the public-readable SECURITY DEFINER recipe view. |
| **ENG-1043** | P1-8 | `20260611120200_redeem_promo_lifetime_pro_eng1043.sql` | Makes `redeem_promo_code` survive the lockdown triggers (transaction-local GUC bypass) + adds the `lifetime_pro` founding-cohort tier (never downgraded). |

Plus the app-side `lifetime_pro` resolver threading (so the comp gates as Pro on
web AND mobile and is never downgraded by a webhook).

---

## 1. ENG-1035 / P0-1 — tier escalation via profile DELETE+INSERT

**The bug.** `profiles_tier_column_lockdown` is attached `BEFORE UPDATE` only.
`profiles_insert_own` has no column guard (`WITH CHECK auth.uid() = id`) and
`profiles_delete_own` lets a user delete their own row. So any authenticated user
could, from the client anon key:

```sql
DELETE FROM profiles WHERE id = auth.uid();
INSERT INTO profiles (id, user_tier) VALUES (auth.uid(), 'pro');
```

— granting themselves Pro for free, or associating an arbitrary
`stripe_customer_id` (re-opening the Customer-Portal hijack vector). With the
planned free founding cohort layered on, the same hole lets anyone forge
`lifetime_pro` — minting the scarce founder benefit, not just dodging £7.99/mo.
That is why this is the **#1 free-launch gate**.

**The fix.** A dedicated BEFORE INSERT trigger (`profiles_tier_column_insert_lockdown`).
The key subtlety: the UPDATE function cannot be reused for INSERT, because on
INSERT `OLD` is NULL, so every `NEW.col IS DISTINCT FROM OLD.col` check fires for
any non-null value — including the `'free'` default that brand-new signups rely
on (`docs/decisions/2026-05-25-onboarding-tier-lockdown-write-failure.md:57`:
"the BEFORE-UPDATE trigger does not fire on INSERT" — that is exactly what lets a
default-row signup succeed). So the INSERT guard compares against the **allowed
defaults** (`user_tier = 'free'`, `stripe_customer_id` null), not against OLD. It
runs the same forward-compat jsonb loop, and bypasses for `service_role`.

**AC (verify live after apply):** a non-service-role INSERT setting
`user_tier != 'free'` or a non-null `stripe_customer_id` → `42501`; brand-new
signups (defaults) still succeed; promo/webhook service-role writers unaffected.

## 2. ENG-1036 / P1-1 — public-readable SECURITY DEFINER recipe view

**The bug (verified live for this fix).** `public.recipes_implausible_macros`
(a diagnostic view, created via Dashboard DDL — not in any tracked migration) is
SECURITY DEFINER (advisor lint 0010 = ERROR), so it reads `recipes` with the
owner's privileges, bypassing `recipes_select_published_or_own` RLS, and SELECT is
granted to `anon` + `authenticated`. A request with the publishable/anon key
returns **HTTP 200** (0 rows today only because nothing currently trips the
implausibility predicate). One import-parsed draft with implausible macros —
routine — makes that private, unpublished draft world-readable.

**The fix.** `ALTER VIEW … SET (security_invoker = true)` (RLS now applies as the
querying role) **and** `REVOKE SELECT FROM anon, authenticated`. Either alone
closes the hole; we do both (defence in depth + clears the 0010 lint). No app code
SELECTs the view (grep across `src/`, `app/`, `apps/mobile/` returns only the
generated `database.types.ts`), so it stays as a maintenance-only diagnostic.
`security_invoker` flips the execution context without redefining the view body
(whose exact text lives only in the live catalog) — a minimal, robust change.

**AC (verify live after apply):** anon SELECT on the view → 0 rows / forbidden;
re-run the Supabase security advisor → lint 0010 cleared for this relation.

## 3. ENG-1043 / P1-8 — promo comp path + `lifetime_pro`

**The bug (audit conf 5).** `redeem_promo_code` is SECURITY DEFINER and does
`INSERT … ON CONFLICT (id) DO UPDATE SET user_tier`. For any user who already has
a profile (everyone post-signup), the ON CONFLICT path runs an UPDATE that fires
the BEFORE UPDATE lockdown trigger. That trigger bypasses only when
`auth.role() = 'service_role'` — but `auth.role()` is JWT-derived and stays
`'authenticated'` inside a SECURITY DEFINER function (the function never does
`set local role`). So **every comp redemption against an existing profile would
fail with 42501**, breaking the founding-cohort mechanism (and Grace's
`SUPPR_TEST_PREMIUM` path).

**The fix.** A deterministic authorised-writer bypass that does not depend on how
`auth.role()` resolves: `redeem_promo_code` calls
`set_config('app.tier_writer', 'on', true)` (transaction-local, auto-clears at
commit/rollback) immediately before the profile write, and **both** lockdown
trigger functions are re-stated to treat that GUC as an authorised writer. A plain
client cannot exploit it — only `redeem_promo_code` (a SECURITY DEFINER function
the client cannot edit) sets the GUC within the same write transaction.

**`lifetime_pro` (monetisation doc §1, conf 8).** The recommended free-cohort
mechanism is a durable `lifetime_pro` comp via this same RPC. This change makes
the *mechanism* correct and safe:

- `public.tier_rank` ranks `lifetime_pro` (3) > `pro` (2) > `base` (1) > `free` (0).
- `redeem_promo_code` never downgrades a higher held tier (a `lifetime_pro`/`pro`
  holder re-redeeming a lower code keeps their stronger tier — the DB-side floor).
- App resolvers normalise `lifetime_pro` → Pro entitlement everywhere and treat it
  as a never-downgrade floor (so a later Stripe/RC webhook can't clobber it):
  - **Web:** `normaliseTier` in `src/types/recipe.ts`, applied at the three
    `setProfileTier` sites in `AppDataContext.tsx`; `getUserTier` in
    `serverAnonClient.ts` normalises `lifetime_pro` → `pro`.
  - **Mobile:** `tierRank`/`resolveNextTier` (`lifetime_pro` floor) +
    `bestPromoTierFromRedemptions` in `purchases.ts`; `normalizeUserTier` in
    `usePromoCode.ts`; `normaliseCachedTier` in `cachedUserTier.ts`; the tier read
    in `recipes.ts`.

**NOT done here (Grace's call):** seeding the `FOUNDING100` promo_codes row is an
operational/data action, not a schema change. The monetisation doc is explicitly
"FOR GRACE'S CALL, nothing applied." This change only makes the mechanism correct
so the row can be seeded when she decides.

**AC (verify live after apply):** an existing user redeeming a valid code reaches
`lifetime_pro` (or `pro`) without 42501; a webhook writing `pro`/`free` never
downgrades a `lifetime_pro` profile.

---

## Migration-apply runbook (Grace runs this)

These migrations were applied via `supabase db push --linked` on 2026-06-11
(human-reviewed; CLAUDE.md forbids unattended auto-push). Re-verify any time with:

```bash
node --import tsx scripts/verify-gate0-db.mts
```

```bash
# 1. From repo root, with the project linked:
supabase db push --linked

# 2. Re-run the Supabase security advisor and confirm:
#    - lint 0010 (security_definer_view) is cleared for recipes_implausible_macros
```

### Live verification A — ENG-1035 exploit is refused

Run as a NON-service-role (anon/authenticated) session — e.g. in the SQL editor's
"run as authenticated" mode or via `/rest/v1` with a user JWT. Use a throwaway
test user, NOT Grace's primary profile.

```sql
-- Escalation attempt (should FAIL with 42501):
delete from profiles where id = auth.uid();
insert into profiles (id, user_tier) values (auth.uid(), 'pro');
--> ERROR 42501: profiles.user_tier may only be inserted as 'free' from the client …

-- stripe_customer_id pre-association (should FAIL with 42501):
insert into profiles (id, stripe_customer_id) values (auth.uid(), 'cus_attacker');
--> ERROR 42501: profiles.stripe_customer_id is not client-writable …

-- Default signup (should SUCCEED):
insert into profiles (id) values (auth.uid());
--> OK (user_tier fills to 'free' via column DEFAULT)
```

### Live verification B — ENG-1036 view is locked

```bash
# With the publishable/anon key (should be forbidden, NOT HTTP 200):
curl -s -o /dev/null -w "%{http_code}\n" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/recipes_implausible_macros?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
# Expect: 401/403/404, NOT 200 with a JSON body.
```

### Live verification C — ENG-1043 comp redemption reaches the tier (no 42501)

Use a throwaway test user with an existing profile row and a test promo code.

```sql
-- As the authenticated test user (existing profile):
select public.redeem_promo_code('TESTCODE');
--> {"ok": true, "tier": "lifetime_pro", "already_redeemed": false}   (no 42501)

-- Confirm the floor: re-redeeming a lower-tier code must NOT downgrade:
select public.redeem_promo_code('SOME_BASE_CODE');
--> tier stays the higher held tier
```

---

## Test coverage

- `tests/unit/profilesInsertLockdown.test.ts` — static contract on the INSERT
  trigger (BEFORE INSERT attachment, `!= 'free'` rejection, stripe_customer_id
  rejection, service_role bypass, forward-compat loop, the GUC bypass present in
  BOTH lockdown functions, `lifetime_pro` rank, redeem stays SECURITY DEFINER).
- `tests/unit/lifetimeProTier.test.ts` — `normaliseTier` (web) maps `lifetime_pro`
  → `pro` so every `userTier === "pro"` gate covers founders.
- `apps/mobile/tests/unit/resolveNextTier.test.ts` — the `lifetime_pro` floor is
  never downgraded by RC `pro`/`free`; upgrades free → lifetime_pro on redemption.
- `apps/mobile/tests/unit/usePromoCode.test.ts` — `normalizeUserTier('lifetime_pro')`
  → `pro`.
- `apps/mobile/tests/unit/cachedUserTier.test.ts` — `lifetime_pro` cache round-trips
  as `pro`; legacy raw value loads as `pro`.

**Live DB tests:** NOT runnable in this environment (no `psql`, no DB password; the
migration-apply rule forbids `db push`). The exploit-rejection and
promo-redemption paths are covered by the manual runbook above, which Grace runs
after apply. Read-only live checks WERE run for this change: the ENG-1036 view is
confirmed reachable via the anon key today (HTTP 200) — the live half of P1-1.

## Cross-platform parity

The `lifetime_pro` resolution is wired identically on web and mobile (same rank
ordering, same Pro-equivalence, same never-downgrade floor). No intentional
divergence. The DB triggers are platform-agnostic (one Postgres surface both rails
reconcile into via `profiles.user_tier`).

## References

- Audit: `docs/ux/reviews/2026-06-11-launch-readiness-audit.md` §10 (P0-1), §11
  (P1-1, P1-8), §16.
- Monetisation sequencing: `docs/ux/research/2026-06-11-launch-monetisation-sequencing.md`
  §1 (lifetime_pro), §4 (ENG-1035 interaction).
- Prior lockdown: `supabase/migrations/20260503100000_*` + `20260503102000_*`;
  `docs/decisions/2026-05-25-onboarding-tier-lockdown-write-failure.md`.
