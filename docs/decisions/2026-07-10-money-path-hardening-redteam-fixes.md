# Money-path hardening — red-team fixes (ENG-1487 / ENG-1490)

- **Date:** 2026-07-10
- **Area:** Payments / AI spend / entitlement integrity
- **Status:** Decided + shipped (code); one migration staged for Grace
- **Linear:** ENG-1487 (HIGH), ENG-1490 (medium batch) — from the 2026-07-10 money-path red-team

## Summary

The 2026-07-10 adversarial money-path sweep confirmed a cluster of live
defects. This change fixes the highest-value / lowest-risk subset:

1. **The £50/day AI spend cap didn't actually bound spend (ENG-1487, HIGH).**
2. **Stripe `checkout.session.completed` granted Pro without a status check (ENG-1490 #1).**
3. **`redeem_promo_code`'s `max_uses` cap was race-able (ENG-1490 #4).**

The remaining ENG-1490 findings (webhook event-ordering guard, farmable
trial, per-(user,IP) photo-log quota) and the fleet-DoS half of ENG-1487
stay tracked in their tickets — they need schema / cross-cutting changes
that warrant their own PRs.

## Decisions

### 1. AI spend accounting is now exact in both directions

`reserveBudget` never sees the prompt, so it reserved a blind
`maxOutputTokens * 4` input ceiling; and `commitBudget` only refunded
*over*-reservation, no-op'ing the case where real input exceeded the
guess. So the daily counter tracked reservations, not real cost, and the
circuit breaker tripped late or never. Two changes make the cap truthful:

- **`commitBudget` settles the counter to actual cost in both directions**
  — refund when under-reserved, **charge the overage when over-reserved**.
  The counter now reflects true spend after every call, so the next call's
  cap check sees reality.
- **Text callers pass a real input estimate** (`estimateInputTokens`,
  ~4 chars/token) so the *reservation* is accurate up front too — an
  over-budget large prompt is denied before the call, not discovered
  after. Vision calls keep the default ceiling (the image dominates and
  isn't char-derivable).

Rejected: a hard per-route input-length cap with a new `ai_input_too_large`
error code. It would ripple through ~20 client error-copy maps for little
extra safety — accurate reservation + exact settlement + the model's own
context-window limit already bound per-call spend. A hard cap remains an
optional future defense-in-depth (noted on ENG-1487).

### 2. Stripe checkout grants gate on subscription status

Both the `customer.subscription.*` path and the
`checkout.session.completed` path now route through one shared
`tierDecisionForSubscription(sub)` helper (status → grant / free / skip).
The checkout branch previously granted from price IDs alone, so an
`incomplete`/`unpaid` checkout would hand out Pro before payment cleared.
Sharing one decision function also removes the divergence risk between the
two paths. `trialing` still entitles (trials grant access immediately);
`incomplete` does not.

### 3. Promo `max_uses` cap is race-safe

`redeem_promo_code` read the promo row without a lock and incremented
`uses_count` later, so concurrent redemptions at READ COMMITTED all passed
a stale `uses_count < max_uses` gate. Adding `FOR UPDATE` to that SELECT
serializes redeemers of the same code; Postgres re-evaluates the waiter's
`WHERE` after the holder commits, so once the cap is reached the waiter
correctly gets "not found". Staged as migration
`20260710120000_eng1490_redeem_promo_for_update.sql` — **Grace runs
`supabase db push --linked`** (never MCP-applied, per the repo rule).

## Failure modes pressure-tested

- **commitBudget over-charge:** only ever settles to *actual* cost; the
  common case (actual < reserved) still refunds unchanged. A double-commit
  is still a no-op (grant marked settled). Pinned by a new test.
- **Checkout gate over-suppression:** `trialing`/`active`/`past_due` still
  grant (pinned); only genuinely non-entitling statuses are withheld. The
  customer-id persist is still best-effort and independent of the grant.
- **Promo lock contention:** the lock is per-code, so different codes never
  contend; uncapped promos (`max_uses is null`) are behaviourally
  unchanged.

## Confidence

8/10. All three fixes are unit/integration-tested and touch narrow,
well-understood paths. The AI-spend fix is enforced in prod today, so it
takes effect immediately on deploy — but it only ever makes the counter
*more* accurate (it can't wrongly deny a call that reserve-time didn't
already deny). What would lower confidence: if a real workload routinely
has actual input far above the char estimate (unlikely — the estimate errs
high on natural language), it would reserve slightly conservatively, which
is the safe direction.

## Verification

- `npm run test` — `aiBudget.test.ts` (34), `aiProviderInputEstimate.test.ts`,
  `stripeWebhookProcessBranches.test.ts` incl. the new incomplete/trialing
  checkout gates; full Stripe webhook + provider suites re-run green.
- `npm run typecheck` — clean (exit 0). `eslint` — clean.
- The promo migration is SQL-only and staged; verify on a branch DB before
  the prod push.

## Cross-platform parity

Server-only. The AI budget + Stripe webhook + promo RPC are shared backends
for web and mobile; no client changes. Entitlement/spend correctness
applies uniformly to both surfaces.
