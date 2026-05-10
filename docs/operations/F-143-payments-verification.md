# F-143 — Trial / payments verification

**Status:** code-side telemetry shipped 2026-05-10. Operational verification still required (steps below).

## Why this exists

The 2026-05-10 TestFlight brief reported "None of the trial / payments stuff is hooked up". The diagnosis (`repo-auditor` 2026-05-10):

- Mobile UI is wired correctly through to `purchasePackage` (RC SDK).
- Apple charges the user.
- Mobile-side `syncTierToSupabase` attempts to write `profiles.user_tier` directly.
- The 2026-05-03 lockdown migration `profiles_tier_column_lockdown.sql` rejects that write (PG 42501) **by design** — `profiles.user_tier` is now server-write-only.
- The replacement authoritative path is the RevenueCat webhook at `app/api/revenuecat/webhook/route.ts`, which uses `SUPABASE_SERVICE_ROLE_KEY` to write the tier.
- **If the webhook isn't configured / firing, the user pays Apple but their `profiles.user_tier` stays `free` forever** — backend Pro-feature gates then block them despite a valid RC entitlement.

The previous code path silently swallowed the lockdown error in DEV-only `console.warn`, so production failures were invisible.

## What shipped in code (F-143)

- `syncTierToSupabase` now returns a `TierSyncOutcome` instead of `void` so callers can branch on `wrote | no_change | lockdown_expected | unexpected_error`.
- The paywall's purchase + restore flows fire a new `revenuecat_tier_sync_attempted` PostHog event with `{ status, from, to, error_code }` on every attempt.
- `lockdown_expected` is the post-2026-05-03 normal — every successful Pro purchase should fire one.
- `unexpected_error` indicates a non-lockdown PG / network error — investigate.

## What Grace must verify in dashboards (the actual fix)

1. **Vercel env vars (Production)** — confirm all of these are set:
   - `REVENUECAT_WEBHOOK_AUTH`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_PRO_ANNUAL`

2. **RevenueCat dashboard** → Project Settings → Integrations → Webhook:
   - URL: `https://suppr-club.com/api/revenuecat/webhook`
   - Authorization secret matches `REVENUECAT_WEBHOOK_AUTH` in Vercel env
   - Send a test event from the RC dashboard; expect 200 OK

3. **Stripe dashboard** → Developers → Webhooks:
   - Endpoint: `https://suppr-club.com/api/stripe/webhook`
   - Listening to: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`
   - Signing secret matches `STRIPE_WEBHOOK_SECRET` in Vercel

4. **Verification trigger** — make one TestFlight Pro purchase. In PostHog:
   - `revenuecat_tier_sync_attempted` event fires with `status: lockdown_expected` (expected)
   - Within ~30s, `profiles.user_tier` for the user should flip to `pro` (server-side webhook write)
   - If `user_tier` stays `free` after 5 minutes, the webhook isn't firing — re-check steps 1–3.

## Follow-up code work (parked)

- **Polling fallback:** after a successful purchase + `lockdown_expected`, poll `profiles.user_tier` for ~30s; if it doesn't update, surface a "Your purchase is processing — contact support if Pro features don't appear within a minute" message. Not shipped because it adds load on Supabase + masks the real operational issue. Telemetry is the better signal.
- **Mobile disabled-state copy** for Apple sign-in when the entitlement isn't provisioned — deferred from F-141 (web parity).

## References

- `apps/mobile/lib/purchases.ts` — `syncTierToSupabase` + `TierSyncOutcome`
- `apps/mobile/app/paywall.tsx` — purchase + restore call sites with telemetry
- `app/api/revenuecat/webhook/route.ts` — server-side tier write
- `supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql` — the lockdown
- `docs/decisions/2026-04-19-billing-architecture-pattern-a.md` — the architectural decision
