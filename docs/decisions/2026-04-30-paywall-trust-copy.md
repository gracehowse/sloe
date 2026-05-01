# Paywall trust copy — counter to user-sentiment pain #1

**Date:** 2026-04-30
**Area:** Paywall + pricing surfaces
**Status:** Resolved
**Owner:** product / monetisation

## Problem

The 2026-04-30 14-app competitor audit (real reviews from Cal AI,
Lifesum, Yazio, Lose It, Recime, Honeydew, etc.) found that **billing
trauma is the #1 most-cited pain across the entire category**. Specific
patterns Suppr can directly counter:

- **Cal AI** — hidden price until end of onboarding, refund difficulty,
  surprise charges (multiple chargeback stories on Trustpilot).
- **Lifesum** — subscription billed via website not iTunes
  (cancellation hell, $50 surprise auto-renews).
- **Yazio** — unauthorised charges, discount-bait
  (offered ₺25, charged ₺299).
- **Lose It** — "24 hours left to buy premium" banners running for
  weeks; auto-renewal at $39.99 immediately after trial.
- **Recime / Honeydew** — post-payment data loss + couldn't cancel.

Suppr already complies with UK CMA disclosure (renewal date, cancel
anytime in account settings, 7-day refund) but the copy was buried in
11px legal-grey small print. The promise wasn't visible.

## Decision

Surface five trust changes across paywall + checkout surfaces:

1. **Trust strip above the price** — three chips (cancel anytime
   in-app, 7-day refund no email needed, price never changes
   mid-trial), rendered ABOVE the tier grid on both web `/pricing`
   and the mobile paywall. Uses `lucide#ShieldCheck` glyph + subtle
   chip styling (small chips, secondary text colour, no jarring
   colours). Copy SSOT: `src/lib/landing/paywallTrust.ts`.

2. **Onboarding does not route to paywall** — verified. The mobile
   onboarding terminal step routes directly to `/(tabs)?firstRun=1`,
   never to `/paywall`. Users land inside the product first; the
   paywall is only encountered when they hit a Pro-gated entry point,
   and the price is visible from screen 1 of that paywall (trust
   strip + tier card render before any user input).
   Guarded by `apps/mobile/tests/unit/onboardingNoPaywallShock.test.ts`.

3. **Receipt / post-purchase confirmation copy** — explicit,
   trust-explicit confirmation surface after a successful purchase.
   - Web: dedicated `/checkout/success` page (Stripe `success_url` was
     `/?checkout=success` which `App.tsx` swallowed silently).
   - Mobile: `Alert.alert("You're in", ...)` containing the four
     trust elements (cancel path, trial-end, refund window, support
     email), shown BEFORE the route change to `/notifications-prompt`.
   - Both compose their message through the SSOT helper
     `buildReceiptTrustCopy` so mobile and web cannot drift.

4. **Manage subscription deep-links** — verified existing surfaces:
   - Mobile Settings → "Manage subscription" row (≤2 taps from Today)
     opens the RevenueCat customer center, falling back to the
     platform's native subscription-management URL.
   - Web `/checkout/success` carries an explicit "Manage subscription"
     CTA pointing at `/account/billing` (which redirects through to
     the Stripe Customer Portal).
   - Web `/pricing` `BillingDisclosure` already linked
     `account settings` to `/account/billing`.

5. **"What's new" surface** — verified already shipped on both
   platforms (`apps/mobile/app/whats-new.tsx`, `app/whats-new/page.tsx`,
   plus `Settings → About → What's new` rows on each surface).
   Source of truth: `src/lib/changelog/entries.ts`.

## What changed (file-level)

- `src/lib/landing/paywallTrust.ts` — new leaf SSOT for the trust
  chip array + `buildReceiptTrustCopy` composer.
- `app/pricing/PaywallTrustStrip.tsx` — new client component.
- `app/pricing/page.tsx` — render the trust strip above the tier grid.
- `app/checkout/success/page.tsx` — new web success surface.
- `app/api/stripe/checkout/route.ts` — `success_url` updated to
  `/checkout/success?session_id=...&period=...&tier=...`.
- `apps/mobile/app/paywall.tsx` — render the trust strip above the
  billing toggle; show the trust-copy Alert on entitled purchase
  success before navigating to `/notifications-prompt`.

## Tests

- `tests/unit/paywallTrust.test.tsx` (11 tests) — SSOT shape +
  `PaywallTrustStrip` rendering + `buildReceiptTrustCopy` composition.
- `tests/unit/checkoutSuccessPage.test.tsx` (7 tests) — receipt copy,
  trust bullets, Manage Subscription CTA, monthly vs annual framing,
  malformed-query fallback.
- `tests/unit/stripeCheckoutRoute.test.ts` — updated to expect the new
  success_url shape; new test asserting the session_id / period / tier
  query params are preserved.
- `apps/mobile/tests/unit/paywallTrustStrip.test.ts` (8 tests) —
  source-level checks that the mobile paywall imports the SSOT,
  renders the strip, and shows the post-purchase Alert.
- `apps/mobile/tests/unit/paywallTrustReceipt.test.ts` (6 tests) —
  functional tests on the SSOT helper composing iOS + Android +
  monthly + annual variants.
- `apps/mobile/tests/unit/onboardingNoPaywallShock.test.ts` (2 tests)
  — guards the onboarding handoff stays Today-first, never paywall.

Total: **34 new tests** across web (18) + mobile (16) protecting
against regression on this differentiation.

## Parity check

- Web `/pricing` and mobile `/paywall` both render the same three
  chips in the same order with the same labels.
- The post-purchase trust copy (web `/checkout/success` and mobile
  Alert) compose through the same `buildReceiptTrustCopy` SSOT.
- Both surfaces deep-link to a real subscription-management path
  (Stripe portal on web, App Store / Play Store on mobile).

No intentional divergence on this surface.
