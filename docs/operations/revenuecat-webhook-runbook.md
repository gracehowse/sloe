# RevenueCat webhook — ops runbook

**Owner:** Grace
**Status:** required before TestFlight cohort expansion
**Last updated:** 2026-04-25 (P0-7 of [Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md))

The webhook **code** shipped on 2026-04-24 (T6, commit `dbdbe27`). The **dashboard wiring + production secret** are still ops actions. Without them, mobile cancellations / refunds / billing-issue holds never reach Supabase, and Pro entitlement leaks (the "Pro forever" bug the webhook was built to close).

---

## What this webhook does

RevenueCat POSTs every billing event (purchase, renewal, cancellation, expiration, billing issue, product change, refund, transfer) to `POST /api/revenuecat/webhook` on the production host. The handler:

1. Verifies the `Authorization` header against `REVENUECAT_WEBHOOK_AUTH` using constant-time compare.
2. INSERTs the event into `public.revenuecat_events` keyed on `event_id` (idempotent — `23505` duplicate-key = already-handled).
3. Resolves `app_user_id` to a Supabase auth uuid; for unmappable RC ids, persists the event but no-ops the tier write.
4. Dispatches by `event_type`:
   - `INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION / NON_RENEWING_PURCHASE / TEMPORARY_ENTITLEMENT_GRANT` → resolves tier from `entitlement_ids` and writes `profiles.user_tier` via service role (bypasses RLS).
   - `CANCELLATION / BILLING_ISSUE` → no-op (auto-renew off, grace period; entitlement still active).
   - `EXPIRATION / SUBSCRIPTION_PAUSED` → writes `user_tier = 'free'`.
   - `TRANSFER / REFUND / SUBSCRIPTION_EXTENDED` → persisted only; v0 doesn't act on these. Forensic replay possible from `revenuecat_events.payload`.

---

## Setup steps

### 1. Generate a webhook secret

Pick something strong. Recommended:

```sh
openssl rand -hex 32
```

Save the value — you'll paste it into both the RC dashboard and Vercel.

### 2. Configure the RC dashboard webhook

1. Open the [RevenueCat dashboard](https://app.revenuecat.com/projects).
2. Pick the Suppr project → **Project Settings** → **Integrations**.
3. Click **+ Add Integration** → **Webhook**.
4. Fields:
   - **URL:** `https://suppr-club.com/api/revenuecat/webhook` (or whichever production host is current; `vercel.json` defines aliases).
   - **Authorization:** the secret you generated in step 1. RC accepts a bare value OR `Bearer <secret>` — the handler tolerates both.
   - **Event filter:** all events (default). The handler routes by `event_type` and persists everything for forensic replay.
5. Save.

### 3. Set the matching secret in Vercel

1. Open the [Vercel dashboard](https://vercel.com/) → Suppr project → **Settings** → **Environment Variables**.
2. Add `REVENUECAT_WEBHOOK_AUTH` = the same secret. Set for **Production** (and **Preview** if you want preview environments to also accept RC traffic).
3. Confirm `SUPABASE_SERVICE_ROLE_KEY` is already present in **Production** (it is, per current Stripe webhook). The route 503s if either is missing.
4. Redeploy production (Vercel → Deployments → latest production → ⋯ → **Redeploy**) so the new env var is loaded by the running serverless functions.

### 4. Send the RC test event

1. Back in the RC dashboard webhook integration, click **Send Test Event**.
2. Expected: `200 OK` response in the RC delivery log within ~2 seconds.
3. If you see `503 revenuecat_webhook_not_configured` → step 3.4 didn't redeploy; redeploy and retry.
4. If you see `401 unauthorized` → secrets mismatch between dashboard and Vercel. Re-paste from the same source.

### 5. Verify the event landed in Supabase

```sql
select event_id, event_type, app_user_id, user_id, received_at
from public.revenuecat_events
order by received_at desc
limit 5;
```

The test event should appear with `received_at` matching the test send time. `app_user_id` will be RC's test value (e.g. `RCBilling_test_user`); `user_id` will be `null` because the test value isn't a real Supabase uuid. That's the correct shape for a test.

### 6. Trigger a real-user event

On a TestFlight device:

1. Sign in with a real account.
2. Open the paywall → start a Pro subscription (sandbox).
3. Within ~10 seconds, the webhook should receive `INITIAL_PURCHASE` and write `user_tier = 'pro'` to that user's `profiles` row.

Verify:

```sql
select id, email, user_tier
from public.profiles
where email = '<your-test-email>';
```

`user_tier` should be `'pro'`. Then test cancellation in the iOS subscription manager → next webhook event (`EXPIRATION` after the period ends) flips back to `'free'`.

---

## Failure modes & runbook

| Symptom | Cause | Fix |
|---|---|---|
| RC dashboard shows 401s in the delivery log | Secret mismatch | Re-copy from the RC dashboard into `REVENUECAT_WEBHOOK_AUTH` in Vercel; redeploy |
| RC dashboard shows 503 `revenuecat_webhook_not_configured` | Vercel env var not loaded | Re-deploy after setting the env var; check it's set for **Production** specifically |
| RC dashboard shows 503 `supabase_service_role_missing` | Service-role key absent | Confirm `SUPABASE_SERVICE_ROLE_KEY` in Vercel env (already there for Stripe — same value) |
| User cancels but Supabase still shows `user_tier = 'pro'` | Cancellation does NOT immediately downgrade — entitlement runs through the period end | Wait for the `EXPIRATION` event at period end. To verify the wiring, send a `EXPIRATION` test event from the RC dashboard and confirm tier flips to `'free'` |
| `revenuecat_events` row exists but `user_id` is null | RC `app_user_id` didn't parse as a Supabase uuid (anon RC user, or a uuid mismatch) | Confirm mobile app calls `Purchases.logIn(userId)` with the Supabase auth uuid as a string. Check `apps/mobile/lib/purchases.ts` |
| Webhook 200s but tier doesn't change | Event type is in the no-op list (CANCELLATION / BILLING_ISSUE / TRANSFER / REFUND / SUBSCRIPTION_EXTENDED) | Expected behaviour. Check `revenuecat_events.payload` for the reason |
| Same event arrives twice | RC delivers at-least-once | Idempotent — `event_id` PK on `revenuecat_events` returns 23505 on duplicate; handler short-circuits to 200 |
| Sentry alerts on rate of `RevenueCatWebhookProcessError` | Schema drift, network issues, or a new event type the dispatch doesn't handle | Check Sentry breadcrumbs for the event type. Add to handler's dispatch table if needed |

---

## Security notes

- Authorization is a static bearer secret. RC does NOT support HMAC-signed webhooks today (vs. Stripe's signing). Rotation: generate a new secret, paste into RC dashboard, paste into Vercel, redeploy. Brief window where in-flight events 401 — RC retries with backoff.
- The webhook accepts both bare-secret and `Bearer <secret>` headers. This is intentional for RC dashboard compatibility.
- Service-role writes are scoped: only `profiles.user_tier` is mutated. The trigger lockdown (T2) on `profiles.user_tier` rejects all client-side writes; this webhook is the only legitimate writer alongside the Stripe webhook.

---

## When to re-visit

- RevenueCat ships HMAC-signed webhooks → migrate from bearer secret to signature verification (Stripe pattern).
- We start persisting `subscription_status` / `trial_*` columns on `profiles` → extend the lockdown trigger and the webhook handler in lock-step (the forward-compat lockdown migration `20260503102000_profiles_lockdown_forward_compat.sql` will catch missing guards at runtime).
- Refund handling becomes a real product surface (today it's persisted-only). Hook the `REFUND` event into a downstream credit / clawback flow.

## Related

- Code: [`app/api/revenuecat/webhook/route.ts`](../../app/api/revenuecat/webhook/route.ts)
- Process logic: [`src/lib/revenuecat/webhookProcess.ts`](../../src/lib/revenuecat/webhookProcess.ts)
- Persistence: [`supabase/migrations/20260503100800_revenuecat_events.sql`](../../supabase/migrations/20260503100800_revenuecat_events.sql)
- Sister webhook (Stripe): [`src/lib/stripe/webhookProcess.ts`](../../src/lib/stripe/webhookProcess.ts)
- T6 decision context: [2026-04-24 full-sweep ship verdict §Phase 2](../decisions/2026-04-24-full-sweep-ship-verdict.md)
