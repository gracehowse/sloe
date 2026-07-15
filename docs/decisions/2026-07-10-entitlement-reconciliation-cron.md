# Entitlement reconciliation cron (ENG-1463 / ENG-1437)

- **Date:** 2026-07-10 (revised 2026-07-15 — see "Revision" below)
- **Area:** Payments / entitlement integrity
- **Status:** Decided + built (Stripe half) — RevenueCat half tracked in ENG-1463
- **Linear:** ENG-1463, ENG-1437 (parents: ENG-1433 launch-sequencing, ENG-1392 money-path audit)

## Revision (2026-07-15)

An adversarial review before this shipped found the v1 design (below,
preserved for its still-valid reasoning on correction policy) had two
structural bugs: it was blind to the exact failure it exists to heal
(a customer whose `checkout.session.completed` webhook — the only writer
of `stripe_customer_id` — was the one permanently missed), and it made one
sequential Stripe API call per Stripe-touched profile, which crosses the
GitHub Actions invoker's 120s timeout at a few hundred profiles. Both are
fixed by replacing the per-profile Stripe calls with ONE paginated sweep
of Stripe's own subscription list (`status: "all"`), grouped both by
Stripe customer id (the known-profile path, now free of extra API calls)
and by `metadata.supabase_user_id` (discovers and backfills profiles
Stripe knows about that `stripe_customer_id` doesn't yet). See the
`src/lib/server/entitlementReconcileJob.ts` module doc comment for the
full architecture. This revision also:
- Delegates per-subscription status→tier resolution to the webhook's
  `tierDecisionForSubscription` (shared, not re-encoded) — fixing a
  latent divergence where an entitling subscription on an unrecognised
  price resolved to a downgrade signal here but a no-op on the webhook.
- Adds a TOCTOU guard (re-read immediately before any write) and a
  per-run circuit breaker on auto-applied downgrades.
- Makes a systemic failure (every scanned customer errored) report
  `ok: false` / HTTP 502 instead of a silent green 200.
- Paginates the `profiles` scan (`.range()`, ordered by `id`) — the
  original unpaginated select silently truncated at PostgREST's
  `max_rows` (1000) cap with no signal.

The "Alternatives rejected" section below is superseded where it
conflicts with this revision (the "scan the whole `profiles` table"
rejection no longer applies — the new design never does that, it scans
Stripe's own list instead).

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

- **One customer's write/lookup fails** → isolated per-customer try/catch;
  counted as an error, batch continues. A single deleted customer or a transient
  Stripe error cannot abort the whole run — but if EVERY scanned customer errors
  (a systemic failure, e.g. the write path breaking fleet-wide), the run reports
  `ok: false` / HTTP 502 rather than a false-green 200 (2026-07-15 revision).
- **The Stripe sweep itself fails** → not per-customer isolated (there's one
  sweep per run) — propagates and the route returns 502.
- **The sweep hits its page cap** (`MAX_SWEEP_PAGES`) → `sweepTruncated: true`
  in the summary plus a Sentry error; the run still completes on the coverage
  it got rather than silently reporting complete coverage.
- **Write rejected** (`writeTier` returns false, no throw) → counted as an
  error AND fires its own Sentry alert (2026-07-15 — previously this was only a
  silent counter increment with the run still reporting green).
- **A webhook races the cron** (TOCTOU) → the pre-write re-read catches a
  fresher tier and skips that one write (`staleWriteSkipped`), re-evaluated
  next cycle.
- **Entitling subscription on an unrecognised price** (env var missing/rotated)
  → `indeterminate`, not a downgrade signal — mirrors the webhook's own skip.
  Reported once in aggregate, not per-user, to avoid burying genuine
  cancellation drift under misconfig noise.
- **`RECONCILE_STRIPE_AUTO_DOWNGRADE` enabled during a price misconfiguration**
  → capped by `MAX_AUTO_DOWNGRADES_PER_RUN`; remaining candidates are still
  detected + alerted, just not auto-applied, and the cap being hit fires its
  own Sentry error.
- **Cron secret / service-role drift** → 503 + the existing ENG-1400 GitHub-issue
  alerting fires. Stripe unconfigured → clean skip (see decision 4).
- **Comp user with a lapsed Stripe sub** → `lifetime_pro` floor-protected, never
  downgraded.
- **The checkout webhook that writes `stripe_customer_id` is the one
  permanently missed** → no longer a blind spot (2026-07-15 revision): the
  Stripe-wide sweep discovers the user via `metadata.supabase_user_id` and
  backfills the customer id regardless of what `profiles` currently holds.

## Confidence

8/10 (unchanged from v1 — the 2026-07-15 revision closes the two structural
gaps a review found, at the cost of a materially larger surface to keep
correct). The Stripe reconciliation logic is unit-tested (34 tests: tier
resolution across every subscription status including "incomplete" as
indeterminate, both drift directions, the circuit breaker, TOCTOU, orphan
discovery + backfill, systemic-failure reporting, floor protection, error
isolation, all route gates) and shares its tier-resolution primitives with the
webhook so the two cannot silently diverge. What would most change this: a
production run surfacing that the both-rails (Stripe + App Store on one account)
population is larger than assumed — which would raise the priority of the RC
half so downgrades can be auto-applied safely; or the Stripe-wide sweep's
page volume growing enough (mature-business historical subscription count,
not Suppr user count) to warrant a `created`-date floor or per-status
parallel paging — flagged in the sweep's own code comment, not a silent gap.

## Verification

- `npm run test` — `tests/unit/entitlementReconcileJob.test.ts`, 34 passing.
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
