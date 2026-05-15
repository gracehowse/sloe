# Stripe webhook — replay runbook

**Owner:** Grace
**Status:** Blocker 2 of [2026-05-14 production-readiness audit](../decisions/2026-05-14-production-readiness-audit-verdict.md) — Phase 1 deadline **2026-06-01**
**Last updated:** 2026-05-14

The Stripe webhook **code** has shipped (`app/api/stripe/webhook/route.ts`, persisted dedupe in `stripe_webhook_events` per T23). What was missing was a runbook for **what to do when production webhook deliveries fail** — Stripe is the bigger revenue risk of the two billing webhooks (RC has its own runbook; this is its sister). The 2026-05-14 audit flagged the gap; this file closes it.

Companion files:
- Sister runbook: [`docs/operations/revenuecat-webhook-runbook.md`](./revenuecat-webhook-runbook.md) — mirror this file's structure.
- Replay script: [`scripts/replay-stripe-event.mjs`](../../scripts/replay-stripe-event.mjs) — used in § Forensic replay below.
- Webhook delivery-failure alarm: [`docs/operations/alerting.md`](./alerting.md) Alarm 4 — what fires when the issues this runbook addresses happen.

---

## What this webhook does

Stripe POSTs every billing event to `POST /api/stripe/webhook` on the production host. The handler (see [`app/api/stripe/webhook/route.ts`](../../app/api/stripe/webhook/route.ts) and [`src/lib/stripe/webhookProcess.ts`](../../src/lib/stripe/webhookProcess.ts)):

1. Verifies `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` using Stripe SDK's `webhooks.constructEvent` (HMAC SHA-256, replay-protected by Stripe).
2. INSERTs the event into `public.stripe_webhook_events` keyed on `event_id` for persisted deduplication (`23505` duplicate-key = already-handled, short-circuit to 200).
3. Dispatches by `event.type`:

| Event type | Handler behaviour |
|---|---|
| `checkout.session.completed` | Resolve `userId` from `client_reference_id` or `metadata.supabase_user_id`. Persist `stripe_customer_id` to `profiles`. Retrieve the linked subscription, resolve tier from price IDs (`tierFromStripePriceIds`), write `profiles.user_tier` via service role. |
| `customer.subscription.created` | Same path as `customer.subscription.updated` — `applyTierForSubscription`. |
| `customer.subscription.updated` | Read `sub.status` + price IDs. `active` / `trialing` / `paused` → set tier from price. `past_due` → set tier from price (keep entitlement during dunning). `canceled` / `unpaid` / `incomplete_expired` → set `'free'`. |
| `customer.subscription.deleted` | Write `'free'` for the resolved user. |
| _other types_ | Default branch — no-op (event NOT persisted to any other table; the dedupe row in `stripe_webhook_events` is the only trace). |

**Important — what is and is NOT stored.** The `stripe_webhook_events` table stores ONLY `event_id` + `received_at`. The Stripe event payload is **not** stored — Stripe's dashboard remains canonical for forensic detail. This is by design (audit trail lives at Stripe; we only need dedupe locally).

---

## Setup steps

### 1. Configure the production webhook endpoint in Stripe

1. Open the [Stripe dashboard](https://dashboard.stripe.com/) → **Developers → Webhooks**.
2. Click **+ Add endpoint**.
3. Fields:
   - **Endpoint URL:** `https://suppr.app/api/stripe/webhook` (or current production host — check `vercel.json` for alias).
   - **API version:** match what `Stripe` SDK in `package.json` expects (let Stripe default to "Your account's default" unless you've pinned an explicit version in the SDK).
   - **Events to send — minimum:**
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
4. After save, click **Reveal signing secret** and copy the value (`whsec_...`).

### 2. Set the matching secret in Vercel

1. Vercel dashboard → Suppr project → **Settings → Environment Variables**.
2. Add or update `STRIPE_WEBHOOK_SECRET` = the `whsec_...` from Stripe. Set for **Production**.
3. Confirm `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are both already present in **Production**. The route returns 503 if any are missing.
4. Redeploy production (Vercel → Deployments → latest → ⋯ → **Redeploy**) so the new env var is loaded.

### 3. Enable Stripe's webhook delivery-failure notification

1. Stripe dashboard → **Developers → Webhooks → [the Suppr endpoint] → Notifications**.
2. Confirm "Notify me when webhook events fail" is enabled and routed to `gracehowse@outlook.com`.
3. See [`docs/operations/alerting.md`](./alerting.md) Alarm 4 for the full test procedure.

---

## Send a test event (Stripe CLI)

The Stripe CLI is the canonical local-trigger tool.

```sh
# One-time: install + login
brew install stripe/stripe-cli/stripe
stripe login

# Trigger a test event to the live endpoint (signs with the live secret):
stripe trigger checkout.session.completed
```

`stripe trigger` sends a synthetic event with a fake customer / fake subscription. The handler will:
- INSERT into `stripe_webhook_events` (dedupe row).
- Try to resolve a `userId` from `client_reference_id` / `metadata.supabase_user_id` — both empty in synthetic events → handler short-circuits with no tier write. **That's correct.** Synthetic events should not mutate tiers.

If you need to test the tier-write path end-to-end, use a sandbox subscription on a real test account — see the RC runbook's "Trigger a real-user event" pattern.

---

## Verify event landed in Supabase

```sql
select event_id, received_at
from public.stripe_webhook_events
order by received_at desc
limit 5;
```

The test event should appear with `received_at` matching the test send time. The table only stores `event_id` + `received_at` — for full payload, cross-reference Stripe dashboard → Developers → Events → search by `event_id`.

To inspect the resulting tier write:

```sql
-- For real-user events with a resolvable userId:
select id, email, user_tier, stripe_customer_id
from public.profiles
where stripe_customer_id is not null
order by updated_at desc
limit 10;
```

---

## Replay — when production webhooks fail

**Trigger:** Stripe delivery-failure alarm fires (per [`docs/operations/alerting.md`](./alerting.md) Alarm 4). Symptoms: Stripe dashboard → Webhooks → endpoint shows red 5xx or "Failed" rows; Sentry has a `stripe_webhook_handler` error spike; user reports Pro tier didn't activate after payment.

### Identify failed events

1. Stripe dashboard → **Developers → Webhooks → [Suppr endpoint] → Recent deliveries**.
2. Filter by **Status: Failed**. This lists every event Stripe tried to deliver where the endpoint returned non-2xx or timed out.
3. Note the event IDs (`evt_1Nq...`) and types (`checkout.session.completed`, etc.). Cross-reference Sentry to understand the failure class.

### Per-event replay (Stripe dashboard)

For one or two failed events:

1. Click the failed delivery row.
2. **Resend** button (top right of the event detail panel).
3. Stripe will re-POST the same event. The handler is **idempotent** (dedupe row in `stripe_webhook_events` short-circuits on duplicate `event_id`).

**Idempotency guarantee:** see [`src/lib/stripe/webhookProcess.ts:101-119`](../../src/lib/stripe/webhookProcess.ts) — the `isAlreadyProcessed` INSERT-then-process pattern returns early on `23505` duplicate-key, so repeated replays are safe by construction.

### Bulk replay (Stripe CLI)

For a window of failed events:

```sh
# List failed events for the endpoint over the last 24h:
stripe events list --limit 100 \
  --created "gt:$(date -v-1d +%s)" \
  --types "checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted" \
  --format json \
  | jq -r '.data[] | select(.pending_webhooks > 0) | .id' \
  > /tmp/failed-events.txt

# Inspect:
wc -l /tmp/failed-events.txt
head /tmp/failed-events.txt

# Replay each. Stripe's `events resend` re-delivers to all subscribed endpoints:
while read -r evt; do
  echo "Resending $evt..."
  stripe events resend "$evt"
  sleep 0.5  # gentle rate-limit guard
done < /tmp/failed-events.txt
```

**Note:** `stripe events resend` re-fires the event through Stripe's webhook delivery layer, including the signature header. The endpoint sees the replayed event as a normal delivery and the dedupe row short-circuits if already processed.

---

## Forensic replay — events that arrived but processed incorrectly

A subtler failure: the webhook returned 200 (Stripe sees success) but the handler set the wrong tier, missed a write, or hit a bug that's since been fixed. The Stripe dashboard considers these "delivered" and won't offer Resend — but we still need to re-run them through the fixed handler.

### Identify suspect events

The local `stripe_webhook_events` table does not store `processed_at` or `error` — it stores only `event_id` + `received_at`. So the local query for "events that arrived but failed" is **cross-referenced**:

```sql
-- All Stripe events we received in a suspect window:
select event_id, received_at
from public.stripe_webhook_events
where received_at >= '<window-start>'
  and received_at < '<window-end>'
order by received_at;
```

Then in Sentry, filter for `stripe_webhook_handler` errors in the same window — those are the events that hit 200 (dedupe row inserted) but threw later in the handler. Each Sentry breadcrumb should carry the `event.id`.

**Pre-Phase-1 follow-up:** add `processed_at` and `error` columns to `stripe_webhook_events` so the SQL alone is sufficient. Tracked at the bottom of this file.

### Manual replay via script

For the events identified above, use the local replay script:

```sh
# One event:
node scripts/replay-stripe-event.mjs --event-id evt_1Nq...

# Bulk:
while read -r evt; do
  node scripts/replay-stripe-event.mjs --event-id "$evt"
done < /tmp/forensic-events.txt
```

The script:
1. Looks up the event via the Stripe API (using `STRIPE_SECRET_KEY`) — Stripe is canonical for the payload, the local table only stores dedupe markers.
2. Constructs a valid HMAC signature using `STRIPE_WEBHOOK_SECRET`.
3. POSTs to the local webhook handler (default `http://localhost:3000/api/stripe/webhook`; override with `--endpoint`).

**Before bulk replay:** if the bug was in the dedupe layer itself (extremely rare), you may need to DELETE the dedupe rows first so the handler re-runs:
```sql
delete from public.stripe_webhook_events
where event_id = ANY(ARRAY['evt_...','evt_...']);
```
Then run the script.

**Default assumption: don't delete dedupe rows.** The handler's dispatch is idempotent for tier writes (it's `SET tier = X`, not `+= 1`), so re-running with dedupe rows present is a no-op. The script will receive a 200 from the handler in that case (short-circuit on dedupe) — that's the expected, safe path.

---

## When to escalate

**Escalate immediately (P0)** when:

- Stripe Live mode is failing **during a viral spike** — revenue-affecting, hours-of-money at risk. Page Grace.
- Failure rate > 5% over a 15-minute window — entitlement leak risk; users paying but not getting Pro.
- The handler is throwing on a known event type (`checkout.session.completed`, the four subscription events) — every minute lost is a paid user stuck on Free.

**P1 (next day):**

- Single failed event, customer-reported, no spike — replay via dashboard Resend, monitor.
- Stripe dashboard shows occasional 504s during a deploy — Vercel cold-start; if persistent, debug, otherwise accept (Stripe retries up to 72h with backoff).

**P2 (this week):**

- Forensic events surfaced by Sentry — replay via the script, root-cause the handler bug.

---

## Failure modes & runbook

| Symptom | Cause | Fix |
|---|---|---|
| Stripe dashboard shows 503 `stripe_webhook_not_configured` | `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` missing in Vercel | Re-add env vars; redeploy |
| Stripe dashboard shows 503 `supabase_service_role_missing` | `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel | Add env var; redeploy |
| Stripe dashboard shows 400 `invalid_signature` | Secret mismatch between Stripe dashboard and Vercel | Re-copy `whsec_...` from Stripe → Vercel; redeploy |
| Stripe dashboard shows 400 `missing_signature` | Reverse proxy stripping headers (shouldn't happen on Vercel) | Open Vercel function logs; confirm the request is hitting the route at all |
| 500 `handler_failed` | Something inside `processStripeWebhookEvent` threw | Open Sentry → search `stripe_webhook_handler`; resolve underlying bug; redeploy; replay failed events per § Bulk replay |
| Event delivered 200 but `profiles.user_tier` didn't change | (a) `client_reference_id` / `metadata.supabase_user_id` missing on the session, or (b) price ID not mapped in `tierFromStripePriceIds`, or (c) event type not in dispatch table | (a) verify the checkout-session creator (`app/checkout/...`) sets `client_reference_id` or `metadata.supabase_user_id`; (b) add the price ID to `tierFromStripePriceIds`; (c) check the event type is one of the four in § What this webhook does |
| Same event arrives twice (per Stripe at-least-once) | Normal Stripe behaviour | Idempotent — dedupe row in `stripe_webhook_events` short-circuits the second delivery |
| `stripe_webhook_events` table doesn't exist | Migration `20260503100700_stripe_webhook_events.sql` not applied | Run `supabase db push --linked` per `CLAUDE.md` (NOT MCP `apply_migration`) |
| `profiles.stripe_customer_id` not populated after first paid session | Handler logs `failed to persist stripe_customer_id` warning | Best-effort write; check Supabase logs for the underlying error; resolve and re-run via script |

---

## Security notes

- Signature verification uses Stripe's `webhooks.constructEvent` (HMAC SHA-256). Replay protection: Stripe includes a timestamp in the signature; events older than 5 minutes are rejected by the SDK by default.
- The webhook route is `runtime = "nodejs"` and `dynamic = "force-dynamic"` — no caching, no edge runtime (Stripe SDK requires Node).
- The dedupe table (`stripe_webhook_events`) has RLS enabled with **no policies** — only service-role writes / reads it. Clients cannot probe whether a given event was processed (minor info-leak prevention).
- The service-role writes are scoped to `profiles.user_tier` and `profiles.stripe_customer_id`. Other columns are write-locked by trigger (T2 `profiles_lockdown`).
- Rotation: generate a new signing secret in Stripe dashboard → paste into Vercel → redeploy. There's a brief window where in-flight events 400 — Stripe retries with backoff, no data loss.

---

## Pre-Phase-1 follow-ups

Open and tracked separately, not blockers for this runbook:

- [ ] Add `processed_at timestamptz` and `error text` columns to `stripe_webhook_events` so forensic replay queries don't need Sentry cross-reference. Mirror the schema in `revenuecat_events` if RC adds them too (uniform across both webhooks).
- [ ] Cron retention: prune `stripe_webhook_events` rows older than 7 days (Stripe retries cap at 72h, so 7 days is conservative). Index exists; cron does not.
- [ ] Add the four Stripe event types as named constants in `src/lib/stripe/webhookProcess.ts` so the dispatch table can't silently drop a typo'd type.
- [ ] Replay-script: add `--dry-run` flag that prints the reconstructed payload + signature without POSTing.

---

## When to re-visit

- Stripe adds new event types we want to act on (e.g. `customer.subscription.trial_will_end`, refunds) — extend the dispatch table + add a row to § What this webhook does.
- We migrate to Stripe SCA / 3DS challenges that require `payment_intent.succeeded` handling separately from checkout completion — needs careful dedupe interaction.
- Phase 2 ships Stripe Tax in inclusive mode — invoice events will start carrying tax breakdowns; if we want to denormalise tax to local tables for reporting, extend the handler.

## Related

- Code: [`app/api/stripe/webhook/route.ts`](../../app/api/stripe/webhook/route.ts)
- Process logic: [`src/lib/stripe/webhookProcess.ts`](../../src/lib/stripe/webhookProcess.ts)
- Persistence: [`supabase/migrations/20260503100700_stripe_webhook_events.sql`](../../supabase/migrations/20260503100700_stripe_webhook_events.sql)
- Sister webhook (RevenueCat): [`docs/operations/revenuecat-webhook-runbook.md`](./revenuecat-webhook-runbook.md)
- Replay script: [`scripts/replay-stripe-event.mjs`](../../scripts/replay-stripe-event.mjs)
- Delivery-failure alarm: [`docs/operations/alerting.md`](./alerting.md) Alarm 4
- DR runbook (single-table corruption scenario): [`docs/runbooks/disaster-recovery.md`](../runbooks/disaster-recovery.md) § S1
