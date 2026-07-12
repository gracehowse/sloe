# Launch is blocked until a working paid rail is live

**Date:** 2026-07-12 · **Status: Resolved (Grace's call)** · **Area:** Monetisation / launch gating · **Tickets:** ENG-1487, ENG-1490, ENG-1510, ENG-1511, ENG-1541 (+ launch-blocker label)

## Decision

**We do not launch until a user can actually pay and receive the entitlement they paid for.** No soft launch, no "trial-only" beta, no "we'll wire billing after the wedge lands." The paid rail — checkout → payment → entitlement grant → gated feature actually unlocks — must be end-to-end real and verified before the `Launch 2026-07-01` push resumes. Until then every launch-blocker that depends on charging money stays gated OFF.

## Why this is a hard gate now (not "nice to have")

The 2026-07-11/12 ultracode audit surfaced a cluster where the product **promises paid value it cannot yet deliver or bill for**. Shipping that is a trust and (UK/EU) consumer-law problem, not a polish gap:

1. **We were making claims we can't keep.** The honesty cluster (ENG-1508–1512, merged #862) had to strip false/unverifiable trial and pricing copy — fabricated "most consistent week" superlatives, a trial price card that was a dead affordance, GBP price figures that are misleading on non-GBP storefronts. Those were symptoms of a product dressed as monetised before the money worked.
2. **The referral loop promised "30 days of Pro" with no grant path.** `referral_invite_loop_v1` (ENG-1541) publicly promised Pro days for a referral, but **no entitlement-grant path exists** — it needs the purchase rail. Moved to DEFAULT-OFF (merged in the ENG-1539 P1 bundle) rather than ship an unkeepable promise.
3. **The money path had real correctness holes.** Money-path hardening (ENG-1487/1490, merged #851) fixed AI-spend accounting, a checkout gate, and a promo race. Account deletion didn't cancel the Stripe subscription (ENG-1539, merged) — deleted users kept being billed. A rail with these holes is not a rail.

Put together: the app could take a name and a "start free trial" tap, but the loop from *intent to pay* → *charge* → *entitlement* → *feature unlocks* → *and cleanly reverses on cancel/delete* was not proven end-to-end. Launching into that means charging (or promising to charge) for value we can't reliably grant or revoke.

## What "paid rail live" means (exit criteria)

The gate lifts when ALL of these are true and verified against a real transaction (RevenueCat sandbox → production, Stripe test → live):

- A real user can complete checkout on **both** platforms (iOS via RevenueCat/StoreKit; web via Stripe) and the charge lands.
- The purchase **grants the entitlement** and a gated Pro feature actually unlocks for that user, server-verified (not client-trusted).
- **Cancel** and **account-delete** both revoke the entitlement and stop billing (ENG-1539 Stripe-cancel-on-delete is in; verify end-to-end).
- Trial → first-charge on day 7 behaves as the onboarding copy states (Apple 3.1.2 binding + CMA auto-renew disclosure already on the paywall).
- Any feature whose value proposition is "pay to get X" is either behind the live rail or its promise is OFF (referral Pro-days, etc.).

## Consequences

- **`Launch 2026-07-01` slips** until the exit criteria pass. The date on that initiative is now aspirational, not committed. (Do not re-assert the 07-01 date in status updates without the rail.)
- **Promise-without-grant features stay OFF** by flag until their grant path is wired (`referral_invite_loop_v1` is the first; apply the same test to any future "get Pro for …" surface).
- **Honesty copy is the floor, not a phase.** The ENG-1508–1512 truthful-copy posture holds: no surface claims paid value the rail can't currently deliver.
- The audit's non-monetisation launch-blockers (onboarding gate race, nutrition-trust verify writeback, dynamic type, dark-mode fallback art, search ranking, etc.) continue to land independently — they're not blocked on the rail, and they harden the product the paid users will land on.

## Alternatives considered

- **Soft-launch trial-only, wire billing later.** Rejected: the trial's whole point is to convert to a charge; shipping the funnel with a dead end at the charge is the exact "promise we can't keep" problem, at scale, in front of press/referral traffic. It also trains early users that "upgrade" does nothing.
- **Launch with web-Stripe only, iOS trial-only.** Rejected: iOS is the primary surface (TestFlight is where the beta lives); a rail that works on the minority surface isn't the rail.
- **Ship referral loop ON with a manual grant backstop.** Rejected: a human-in-the-loop "we'll credit you 30 days" doesn't scale to a viral push and still fails the "server-verified entitlement" bar.

## Confidence

9/10 that this is the right gate. The one caveat is scope discipline: the risk is not the decision but *scope creep on "rail live"* — keep the exit criteria to the five bullets above; do not let it absorb every monetisation-polish idea, or the gate never lifts.
