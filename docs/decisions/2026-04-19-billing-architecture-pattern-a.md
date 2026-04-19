# Billing architecture: Stripe (web) + RevenueCat SDK (iOS) — Pattern A

**Date:** 2026-04-19
**Status:** Accepted
**Supersedes:** Prior thinking that considered migrating web to RevenueCat Web Billing or Paddle.

## Decision

Suppr will run two billing stacks, synced on the backend:

- **Web:** Stripe direct (Checkout + webhook → `profiles.user_tier`).
- **iOS:** Apple IAP via the RevenueCat SDK (`apps/mobile/lib/purchases.ts`) → `syncTierToSupabase` writes the same `profiles.user_tier` column.
- **Android:** not in scope; no Android build yet.

Both paths converge on the same `profiles.user_tier` column, so the rest of the app does not need to know *how* a user became Pro.

## Options considered

| Pattern | What it means | Verdict |
|---|---|---|
| **A. Stripe (web) + RC SDK (iOS)** | Two stacks, backend sync. | **Chosen.** |
| B. RevenueCat Web Billing + RC iOS | Single RC stack across surfaces. Stripe is under the hood on web. | Rejected — RC Web Billing does not support user-entered promo codes as of April 2026 (confirmed with RC community + roadmap). Losing promo codes to gain "unification" is a bad trade. |
| C. Paddle (web, merchant-of-record) + RC iOS | Paddle handles VAT + global tax + promo codes. Mobile unchanged. | Rejected — Suppr's operating entity is in Cayman Islands, so the merchant-of-record VAT advantage does not apply. Still two stacks, without the tax-compliance payoff that justifies the switch. |
| D. Stripe (web) + custom StoreKit 2 on iOS | No RC. Full control. | Rejected — too much engineering for a small team; RC is the category default for a reason. |

## Rationale

1. Pattern A is already built. Web Stripe Checkout works; mobile RC SDK is wired. The real ship-blocker was never "wrong architecture" — it was that the RC offerings weren't provisioned in the RC dashboard, so the mobile paywall showed "Subscriptions unavailable." That's ~2 hours of dashboard work, not a migration.
2. Stripe has everything the web needs: promo codes (`allow_promotion_codes: true`), GBP, Apple Pay, Google Pay, trials, webhook events. Migrating away from a working Stripe setup to gain "unification" in exchange for losing promo codes is a bad trade.
3. The app-level contract (`profiles.user_tier` in Supabase) is what actually matters for feature gating. Both billing stacks write to this column identically — the rest of the code is indifferent.
4. Cayman Islands jurisdiction means no VAT/EU tax auto-collection obligation, so Paddle's merchant-of-record advantage does not apply.
5. Revisit this decision if (a) RC Web Billing ships user-entered promo codes, or (b) Suppr expands beyond Cayman in a way that makes a merchant-of-record model genuinely cheaper than DIY compliance.

## Consequences

- **Two billing surfaces** must be kept in sync at the tier-state contract level: any new tier requires updating both Stripe price IDs (web) and App Store Connect + RC offerings (iOS).
- **Promo codes** remain a web-only feature (Stripe `allow_promotion_codes: true`). iOS promo redemption uses Apple's native offer codes feature if needed later.
- **One column is the truth:** `profiles.user_tier` is the single gate. Every feature check reads from it. Never read Stripe or RC state inline from the app.
- **Refund flow** stays manual via the Stripe dashboard (web) or Apple's refund flow (iOS). No unification planned.

## Related files

- `app/api/stripe/checkout/route.ts` — web checkout session creation.
- `app/api/stripe/webhook/route.ts` — web webhook → tier write.
- `src/lib/stripe/tierFromPrice.ts` — maps Stripe price IDs to tier.
- `src/lib/stripe/updateProfileTier.ts` — the single writer both stacks funnel into.
- `apps/mobile/lib/purchases.ts` — RC SDK client + `syncTierToSupabase`.
- `apps/mobile/app/paywall.tsx` — iOS paywall surface.
- `docs/decisions/2026-04-revenuecat-offerings-empty.md` — the immediate tactical unblocker.
- `docs/decisions/2026-04-19-pricing-v1.md` — the pricing table this architecture sells.
