# Entitlement reconciliation cron (ENG-1463 / ENG-1437)

- **Date:** 2026-07-10
- **Area:** Payments / entitlement integrity
- **Status:** Decided + built (Stripe half) — RevenueCat half tracked in ENG-1463
- **Linear:** ENG-1463, ENG-1437 (parents: ENG-1433 launch-sequencing, ENG-1392 money-path audit)

## Summary

`profiles.user_tier` is a denormalised mirror of the payment processors'
entitlement truth. Its only writers are the Stripe and RevenueCat webhooks
(through `updateProfileTierServiceRole`); the column is client-write-locked
(42501) by the tier-lockdown migration, so nothing self-heals client-side.
Before this change there was **no automated recovery** if a webhook was
permanently missed or failed — a paying customer could be stranded on the
wrong tier until someone corrected it by hand in Supabase. A first-transaction
config error is the single most likely launch failure (neither rail has ever
processed a real transaction), so this gap sat directly on the launch-risk
critical path.

This adds `POST /api/cron/entitlement-reconcile` (GitHub-Actions-scheduled,
every 6h) which compares the payment processor's canonical state against
`profiles.user_tier` and reconciles drift server-side, firing a Sentry alert
on every correction (a correction means a webhook was missed — worth knowing
even after auto-fix).

## Decision

### 1. Reconcile against processor *current state*, not event replay

The job lists each customer's current Stripe subscriptions and resolves the
tier they *should* hold, rather than replaying missed webhook events. State
comparison is robust to a webhook lost arbitrarily long ago; event replay only
catches events still inside Stripe's 30-day events-API retention. The
price→tier mapping is shared with the webhook (`tierFromStripePriceIds`) and
the entitling-status set mirrors the webhook's `applyTierForSubscription`, so
the cron resolves tier the same way the missed webhook would have — the only
legitimate difference is that the cron considers *all* of a customer's
subscriptions (highest entitling tier wins) rather than one event's object.

### 2. Asymmetric correction policy — auto-grant, alert-on-downgrade

The two drift directions do not carry equal risk:

- **Upgrade drift** (processor says entitled, `user_tier` lower) → **auto-corrected.**
  Granting a tier a customer has demonstrably paid for is always safe, and this
  is the direction that strands a *paying* customer (the motivating failure).
- **Downgrade drift** (processor says not entitled, `user_tier` higher) →
  **detected + Sentry-alerted, but not written by default.** A user with a
  canceled Stripe subscription can be a legitimate App Store (RevenueCat)
  subscriber; auto-downgrading them would lock a paying customer out of Pro —
  the worst possible failure. Without RevenueCat truth we cannot rule that out,
  so we surface downgrade candidates for review instead of acting blind.
  `RECONCILE_STRIPE_AUTO_DOWNGRADE=true` opts in to auto-applying downgrades
  (appropriate once RC reconciliation exists to rule out the cross-rail case,
  or if the product stays web-only).

`lifetime_pro` is never touched — belt-and-braces with
`updateProfileTierServiceRole`'s own floor-protection.

### 3. Scope: Stripe now, RevenueCat as a tracked follow-up (ENG-1463)

The Stripe half is complete and live-capable. The RevenueCat half needs an
outbound RC REST secret key that is not yet provisioned, so it is **not built**
— tracked in ENG-1463, not silently stubbed. This is not a launch gap:
TestFlight purchases clear through Apple's sandbox, so no real money flows on
the RC rail yet (`docs/decisions/2026-07-06-launch-sequencing-revenue-rails.md`),
which means the paying-customer-stranded risk currently lives entirely on the
Stripe rail — the one this cron reconciles.

### 4. Clean skip (not 503) when the Stripe rail is unconfigured

Unlike the other crons, a missing `STRIPE_SECRET_KEY` returns a 200 `skipped`,
not a 503. The Stripe rail is dark by design until Grace runs the go-live
bundle (ENG-1433); a 503 would trip `scheduled-crons.yml`'s failure-alerting
(ENG-1400) and open a GitHub issue every 6h until then. A missing cron secret
or service-role key *is* still a 503 — those are real misconfigurations that
should always page.

## Alternatives rejected

- **Event-replay reconciliation** (list Stripe events since a cursor, replay the
  un-processed ones through `processStripeWebhookEvent`). Rejected as the
  *primary* mechanism: it only catches events inside Stripe's 30-day retention,
  so a webhook lost longer ago than that — exactly the "permanently missed"
  case the ticket names — would never be recovered. State comparison has no such
  blind spot. (Replay remains the right *manual* tool for a known recent gap and
  stays documented in the webhook-replay runbook.)
- **Auto-apply downgrades too.** Rejected for v1: with no RevenueCat truth,
  downgrading a canceled-Stripe user who is actually an active App Store
  subscriber locks out a paying customer. The revenue leak from *not*
  downgrading a genuinely-lapsed user (over-serving product) is far less harmful
  than wrongly revoking Pro from someone who is paying. Alert-and-hold is the
  correct default until RC truth is available.
- **Scan the whole `profiles` table.** Rejected: bounding to
  `stripe_customer_id IS NOT NULL` covers exactly the set whose tier can drift
  from Stripe truth, at a fraction of the Stripe API cost.

## Failure modes pressure-tested

- **One customer's Stripe call fails** → isolated per-customer try/catch;
  counted as an error, batch continues. A single deleted customer or a transient
  Stripe 500 cannot abort the whole run.
- **Write rejected** (`updateProfileTierServiceRole` returns false) → counted as
  an error, not a grant; no silent success.
- **Cron secret / service-role drift** → 503 + the existing ENG-1400 GitHub-issue
  alerting fires. Stripe unconfigured → clean skip (see decision 4).
- **Comp user with a lapsed Stripe sub** → `lifetime_pro` floor-protected, never
  downgraded.

## Confidence

8/10. The Stripe reconciliation logic is unit-tested (21 tests: tier resolution
across every subscription status, both drift directions, floor protection, error
isolation, all route gates) and shares its tier-resolution primitives with the
webhook so the two cannot silently diverge. What would most change this: a
production run surfacing that the both-rails (Stripe + App Store on one account)
population is larger than assumed — which would raise the priority of the RC
half so downgrades can be auto-applied safely.

## Verification

- `npm run test` — `tests/unit/entitlementReconcileJob.test.ts`, 21 passing.
- `npm run typecheck` — clean (exit 0).
- Not exercised against a live Stripe account from this environment (no Stripe
  keys here); the job is dependency-injected on the Stripe/Supabase clients and
  tested through fakes. First live run should be a manual `workflow_dispatch`
  (`entitlement-reconcile` target) once the Stripe go-live bundle is configured,
  watching the summary log + Sentry.

## Cross-platform parity

N/A for UI — this is a server-only background job. Entitlement *parity* is the
point: it keeps `profiles.user_tier` (the single tier source both web and mobile
read) correct regardless of which rail a subscription came through. The RC rail's
own reconciliation (ENG-1463) is required before mobile/App Store entitlements
get the same automated safety net the Stripe/web rail now has.
