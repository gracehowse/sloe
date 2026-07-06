# Launch sequencing — revenue rails (ENG-1433)

- **Date:** 2026-07-06
- **Area:** Payments / launch timing
- **Status:** Decided — dashboard sprint pending (Grace-only)
- **Linear:** ENG-1433 (parent: ENG-1392, money-path audit 2026-07-05)

## Summary

The 2026-07-05 money-path audit flagged "web Stripe is dark in prod" as one item among ~12 in a launch-blocker cluster. Re-examining it in isolation surfaced a sharper framing: **distribution today is TestFlight-only, and TestFlight purchases run through Apple's sandbox — no real money can clear there.** Web Stripe is not a secondary-platform bug; it is currently the *only* rail on the entire product that can take a real payment. That reframes the launch-sequencing question.

## Decision

Run a same-day dashboard sprint (~90 minutes, Grace-only, no engineering blocking it), then start TikTok/IG content posting as soon as one real end-to-end web purchase is proven — not gated on iOS purchase readiness.

**Today, in this order:**
1. **Enroll Apple Small Business Program** (GROW-53/ENG-3) first. It has the only external multi-week clock in this cluster (effective date tied to Apple's fiscal-period boundary, ~6 weeks out) and is already 5+ weeks past its own due date. Whichever commission rate is active when a subscriber's *first* payment clears is locked for that subscriber's first 12 months — irreversible, and not fixed by enrolling later.
2. **Run the Stripe bundle in checklist order** (`docs/operations/stripe-tax-launch-checklist.md`): dashboard `tax_behavior` on all 4 Price objects → env vars + webhook secret in Vercel → `STRIPE_TAX_ENABLED=true` → redeploy. Order matters — flipping the flag before `tax_behavior` is set 400s every checkout. This one bundle fixes both the dead checkout (`STRIPE_SECRET_KEY` unset → clean 503) and the VAT exposure (Stripe Tax off would mean the first UK/EU sale is VAT-exclusive, against the locked `2026-04-19-consumer-vat-posture-uk-eu.md` decision), since they share one root cause.
3. **Wire both webhook-failure alerts** (Stripe + RevenueCat dashboards, per `docs/operations/alerting.md`) before any real transaction. Neither rail has ever processed a real transaction, so a first-time config error (wrong secret, misdirected endpoint) is exactly the failure class most likely to hit on transaction one — and there is no reconciliation safety net today (see the founder-safety-net.md §4b correction, same date).

**This week, engineering (delegable, does not block content):** run one real web test purchase end-to-end and confirm `profiles.user_tier` flips via webhook; diagnose why the RevenueCat mobile paywall capture showed empty offerings (may be a sandbox-config artifact, may be real — unresolved); file the reconciliation-cron ticket as a fast-follow.

**Content posting starts once the web purchase proof lands** (realistically midweek), subject to a final check that the rest of the `label:launch-blocker` list is clear.

iOS purchase readiness becomes the gate for **App Store release**, not for the start of content posting — TestFlight can't monetise regardless of iOS's own state, so gating content on iOS revenue readiness would be gating on something the current distribution channel can't use anyway.

## Alternatives rejected

- **Hold all content until both rails are proven and SBP is effective (~6 weeks).** The MFP-refugee capture window this launch exists for is already two months old and decaying; the SBP commission delta on a cold-start TikTok account's first few weeks of conversions is small (tens to low hundreds of £) relative to the cost of a 6-week silent window.
- **Post content now, fix payments in parallel.** This isn't a registration formality that can run alongside engineering — it's a live funnel that would eat money and goodwill (a 503 checkout, or a transaction that clears before the Tax flag flips creates real UK/EU VAT liability). The fix is ~90 minutes; there's no version of "in parallel" that beats "first, today."
- **Ship web-only and quietly hide the mobile paywall indefinitely.** iOS is the primary surface; the paywall's empty-offerings state is a config problem to diagnose, not a reason to hide it — hiding it just postpones the diagnosis needed for App Store release anyway.

## Confidence

8/10. What would most change this: evidence that App Store Connect prerequisites (Paid Apps agreement, banking, tax forms) are incomplete — that would make SBP near-moot short-term and argue for an explicit two-stage launch (web-first now, iOS revenue push later); or any open P0 elsewhere on the `launch-blocker` list, which would move the posting date independent of this decision.

## Related work opened from this pass

- `docs/operations/founder-safety-net.md` §4b corrected — it claimed a RevenueCat entitlement self-heal that doesn't exist in code (`profiles.user_tier` is client-write-locked; the only sync path is the webhook).
- GROW-53/ENG-3 (Apple SBP enrollment) reprioritized as today's P0.
- Reconciliation-cron fast-follow filed (no job currently reconciles RevenueCat/Stripe truth against `profiles.user_tier` on a missed webhook).

## Verification

Re-derived from live-repo evidence, not re-verified against actual dashboards (no Stripe/RevenueCat/App Store Connect access from this environment) — see file/line citations in the ENG-1433 Linear comment. Anything requiring a live dashboard read is flagged there as "needs Grace to confirm live," not asserted as fact.

## Cross-platform parity

N/A — this is a sequencing/timing decision, not a code change. The Stripe bundle affects web only; the reconciliation-cron fast-follow will need to cover both Stripe (web) and RevenueCat (mobile) when built.
