# Mobile degraded-paywall disclosure — defer the price to the App Store (2026-07-09)

**Status:** decided · **Scope:** iOS paywall (`apps/mobile/app/paywall.tsx`) ·
**Tickets:** ENG-1381 · **Supersedes for mobile:** the mobile carve-out in
`docs/decisions/2026-04-19-renewal-disclosure-rewrite.md` (which was scoped to web
and explicitly deferred the mobile paywall to store-side rules).

## Context

ENG-1381 shipped a flag-gated fallback paywall (`paywall_fallback_when_unavailable`,
default-OFF) for the degraded `subscriptionsUnavailable` state — when RevenueCat
offerings fail to resolve (App Store Sandbox, App Store review, IAP-degraded
regions, and the real `paywallReadiness` failure reasons). In that state there is
no live, currency-correct price, so the first cut filled the plan selector and the
UK CMA auto-renewal disclosure from `FALLBACK_PRICES` (a single hardcoded GBP
figure sourced from `PRICING_TIERS`), with an "indicative price" caveat.

Two independent reviews (legal + monetisation, 2026-07-09) flagged this as a
**block**: a specific price inside a CMA-style renewal disclosure that is not the
amount the user will actually be charged is a misleading-price action under CPUTR /
the DMCCA 2024 regime the CMA is actively enforcing. The dominant failure mode is
**currency/VAT mismatch** — a euro-zone or US user shown a GBP figure has been
shown the wrong price, and no caveat cures that. Price-drift (SSOT vs live App
Store price) is a second, smaller vector.

## Decision

In the degraded (`fallbackWhenUnavailable`) state the CMA renewal disclosure
**states the renewal cadence, auto-renew-until-cancelled, cancel path, VAT
inclusion, and refund policy, but does NOT print a specific price.** It defers the
exact amount to the App Store, which shows the localised, VAT-inclusive price
before purchase:

> Pro renews automatically each {year|month} until cancelled. The exact price in
> your currency is confirmed on the App Store before you subscribe. Cancel anytime
> in Settings > Apple ID > Subscriptions. Prices include any applicable VAT. 7-day
> refund policy: support@getsloe.com.

The live (price-resolved) path is unchanged — it still states the resolved
RevenueCat `priceString`.

The point-of-commitment disclosure (Apple's StoreKit sheet) remains intact and
correct; Suppr's in-app block is supplementary and now honest about deferring the
amount.

## Rejected

- **Keep the indicative price with a caveat** (the shipped-then-reverted cut). A
  caveat softens the impression of certainty but does not cure a wrong number —
  especially the currency-mismatch case. Rejected.
- **Show an indicative "from" price gated to GBP storefronts only** (legal's
  Option B). Buys nothing over deferral in a state where the user can't purchase
  in-app anyway, and still requires a storefront/currency gate the fallback lacks.
  Rejected.

## Resolved (2026-07-10, ENG-1381)

- **Subtitle honesty.** The header sub-headline no longer promises a shown price
  in the degraded state. The `fallbackWhenUnavailable` branch now reads
  *"Cancel anytime. Your exact price confirms in the App Store."* — consistent
  with the deferred-price disclosure above — instead of the old
  *"Price in your currency, taxes included."* (which is dishonest when the exact
  price is deferred). Every non-degraded subtitle branch is unchanged.
- **Plan-card false-precision claims.** The plan rows and the fallback price
  themselves are kept (the disclosure clarifies the exact amount confirms on the
  App Store), but the two *derived* numbers are now suppressed when
  `fallbackWhenUnavailable`: the computed **"Save N%" savings badge** and the
  **per-month breakdown line** both resolve to `null`. A math-backed "Save 37%"
  drawn from an indicative `FALLBACK_PRICES` figure is a stronger, harder-to-
  caveat false claim than the indicative price itself, so both are removed in the
  degraded state.

## Open (before the flag is enabled)

- **Degraded CTA destination.** `Open the App Store` deep-links to Apple's
  *subscriptions manager* (`itms-apps://apps.apple.com/account/subscriptions`),
  not a purchase sheet — so it can't complete a *new* subscribe. The label was
  corrected from the overpromising "Open App Store to subscribe", but whether the
  degraded CTA should instead **retry offerings** is a monetisation + integration
  call to resolve before `paywall_fallback_when_unavailable` is ramped.
