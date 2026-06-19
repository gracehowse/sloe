# TrueMed HSA/FSA payments — US-only web candidate (ENG-991)

**Date:** 2026-06-19  
**Status:** Deferred / approved to scope after paid Stripe GA  
**Area:** Monetisation / billing / legal  
**Linear:** ENG-991

## Decision

**Do not build TrueMed before launch or before Suppr has a live paid Stripe rail.** Keep TrueMed as a **post-paid-GA, US-only, web-only monetisation candidate**.

When the dependencies below are live, the approved next step is a small integration spike with TrueMed sandbox credentials — not a full launch — to confirm merchant eligibility, subscription handling, and receipt/LMN copy against Suppr's actual Stripe account.

## Why this came up

The 2026-06-08 MyFitnessPal teardown found that MFP uses TrueMed for HSA/FSA payments via routes shaped like `POST /api/stripe/truemed/payment-session` and `GET .../stripe/truemed/payment-token`, and called it a US-market wedge because users may pay for a health app with pre-tax dollars (`docs/research/2026-06-08-mfp-teardown.md`). The competitor summary also flags TrueMed HSA/FSA payments as a monetisation-architect follow-up (`docs/research/2026-06-08-competitor-teardown-summary.md`).

## Research findings

### Eligibility and LMN posture

TrueMed's current merchant guidance says HSA/FSA acceptance depends on merchant classification/compliance path, processor setup, and a checkout flow that can support dual-purpose products requiring documentation such as a Letter of Medical Necessity (LMN). It also recommends contingent language such as "may be eligible" rather than guarantees, and says an independent licensed practitioner review is part of the LMN path for qualifying customers. Source checked 2026-06-19: <https://www.truemed.com/blog/how-do-i-set-up-hsa-payments-on-my-website>.

For Suppr, a nutrition-coaching subscription is **not safe to represent as automatically HSA/FSA-eligible**. The plausible compliant path is: qualified US customer + diagnosed/documented condition + independent clinician determines whether an LMN is appropriate + plan administrator ultimately accepts/rejects. That means product copy must avoid "covered", "approved", "guaranteed", or broad "wellness" claims.

### Stripe interplay

TrueMed publicly advertises a custom API that can integrate with Stripe/headless checkouts, includes sandbox/webhooks, and supports subscriptions/refunds/cancellations flowing through existing systems; it also states TrueMed is merchant of record for every transaction in that API pattern. Source checked 2026-06-19: <https://www.truemed.com/partners/custom-api>.

Stripe's partner directory describes TrueMed as integrating directly into a merchant's Stripe checkout while managing HSA/FSA compliance workflows, LMNs, and eligibility determinations. Source checked 2026-06-19: <https://stripe.partners/directory/truemed>.

Suppr's current web checkout is a single Stripe Checkout route at `app/api/stripe/checkout/route.ts`, authenticated per user, rate-limited, and currently Pro-only. That makes the future file target plausible, but it is premature until ENG-33/paid Stripe setup is actually live.

### Region and platform gating

TrueMed is a **US HSA/FSA** opportunity. UK/EU users should not see it. Suppr's current `detectRegion()` helper only distinguishes UK, EU, and default/other currency, with no first-class `countryCode` or `isUS` field (`src/lib/region/detectRegion.ts`). A real implementation needs a stricter US gate than today's default-region branch, because default currently includes unknown countries as well as the US.

Mobile parity is intentionally impossible for this payment rail: iOS subscriptions must use Apple IAP / RevenueCat, not a TrueMed-hosted or Stripe web checkout path. This creates a deliberate **web-only** divergence that must be documented in pricing/paywall copy and tests when built.

### Legal / merchant posture

Legal approval is **not yet granted**. The legal-reviewer posture is: TrueMed can be a promising compliance wrapper, but Suppr still needs confirmation of:

1. the final merchant entity/counterparty and country posture,
2. TrueMed's partner terms, data processing terms, telehealth/consumer-health-data posture, and refund/subscription obligations,
3. whether TrueMed's merchant-of-record model aligns with Suppr's Stripe account, tax, subscription, and consumer-law flow,
4. exact user-facing claims for a nutrition-coaching subscription.

Until those are confirmed, this decision is **not** approval to ship HSA/FSA copy or a payment path.

## Dependencies before implementation

Do not implement until all are true:

1. **Paid Stripe rail live:** ENG-33 / Stripe Tax / production checkout operational.
2. **US Stripe prices exist:** USD price IDs or agreed currency handling for US users.
3. **TrueMed commercial/legal review complete:** partner agreement, DPA/privacy posture, merchant-of-record/subscription/refund responsibilities, and approved claim language.
4. **US region detection available:** `detectRegion()` or a replacement returns explicit country/US status, not just default currency.
5. **Web-only parity note accepted:** mobile IAP remains separate, with no TrueMed equivalent.

## Approved implementation shape, if the gate later opens

Build behind a feature flag, for US web users only:

- `app/api/stripe/truemed/payment-session/route.ts` — authenticated, rate-limited route mirroring the existing Stripe checkout security posture.
- `src/lib/region/detectRegion.ts` — add explicit US detection / country metadata with tests.
- `app/pricing/PricingTiersGrid.tsx` and `app/pricing/CheckoutButton.tsx` — alternate secondary CTA such as "Check HSA/FSA eligibility" using contingent copy only.
- Feature flag: e.g. `truemed_hsa_fsa_web_us_v1`, default off.
- Tests:
  - region gate: CTA renders only for explicit US requests;
  - route auth/rate-limit/error handling, modelled on existing Stripe route tests;
  - copy test or fixture asserting no guaranteed-coverage language;
  - parity note documenting no mobile equivalent because App Store IAP owns iOS subscription payments.

## Alternatives considered

| Option                      | Verdict  | Why                                                                                                                                                   |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build now                   | Rejected | Eligibility/legal posture and paid Stripe dependencies are not ready. This would create risky health-payment claims before the merchant setup exists. |
| Drop TrueMed entirely       | Rejected | MFP's use and TrueMed's Stripe/API posture make it a credible US conversion lever once paid web checkout exists.                                      |
| Defer behind explicit gates | Chosen   | Preserves the opportunity while preventing premature health-benefit/payment claims.                                                                   |

## Failure modes to guard against

- **Eligibility overclaim:** copy implies everyone qualifies or that Suppr is automatically covered.
- **Region leakage:** non-US users see HSA/FSA messaging because `defaultRegion()` is treated as US.
- **IAP policy conflict:** mobile paywall links around Apple's purchase rules.
- **Subscription mismatch:** TrueMed subscription lifecycle diverges from Stripe/RevenueCat entitlement state.
- **Refund/support mismatch:** user, TrueMed, Stripe, and Suppr disagree about who owns refunds/cancellations.
- **Privacy posture gap:** LMN / intake / consumer-health-data flows introduce new vendor obligations not reflected in privacy/subprocessor docs.

## Confidence

**7/10.** The product/technical direction is clear enough to defer implementation safely and preserve a scoped future spike. Confidence should rise only after TrueMed shares partner docs/sandbox credentials and legal confirms the entity/merchant posture.

## Notion mirror

Notion MCP was not connected in this session. Mirror this decision to the Decisions log with:

- **Title:** TrueMed HSA/FSA payments — US-only web candidate
- **Date:** 2026-06-19
- **Area:** Monetisation / billing / legal
- **Status:** Deferred / approved to scope after paid Stripe GA
- **Summary:** TrueMed is a credible US HSA/FSA conversion lever, but Suppr should not build until paid Stripe GA, legal/merchant review, explicit US gating, and web-only parity caveats are resolved.
- **Repo path:** `docs/decisions/2026-06-19-truemed-hsa-fsa-us.md`
