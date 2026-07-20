# Currency display guard — per-currency pricing SSOT fields + EUR-SKU boot assertion (ENG-1442)

- **Date:** 2026-07-20
- **Area:** Pricing / Stripe checkout / billing safety
- **Status:** Decided + shipped
- **Linear:** ENG-1442 (Medium, `risk/billing`) — from the 2026-07-05 deep audit, money-path stage, findings MP-10 (monetisation-architect) / LEGAL-009 (legal-reviewer)

## Summary

A latent shown-£/charged-€ mismatch would activate the day EUR Stripe
Price env vars are set, with no other code change: the checkout route
already resolves a EUR-denominated Stripe Price the instant
`STRIPE_PRICE_PRO_MONTHLY_EUR` / `STRIPE_PRICE_PRO_ANNUAL_EUR` are
populated, but `/pricing` renders the hardcoded GBP strings in
`PRICING_TIERS` unconditionally — there was no code path that could
render anything else. A EU visitor would see "£7.99" and be charged
whatever amount lives on the EUR Stripe Price object.

This fix does two things, matching the audit's verbatim recommendation:

1. **Per-currency display fields in the pricing SSOT** — `PricingTier`
   (`src/lib/landing/pricingTiers.ts`) gains an optional
   `displayByCurrency: Partial<Record<"GBP" | "EUR", CurrencyPriceDisplay>>`
   field, plus `resolveTierDisplay(tier, currency)` (fallback-to-GBP
   resolver) and `isEurPricingDisplayReady()` (readiness predicate).
2. **A boot-time assertion that refuses to accept EUR SKU env vars
   while the display layer can't render EUR** —
   `checkEurSkuDisplayReadiness()` / `assertEurSkuDisplayReadiness()`
   (`src/lib/stripe/eurSkuDisplayGuard.ts`), wired into both
   `scripts/verify-production-env.ts` (CI/deploy gate) and
   `src/instrumentation.ts` (the actual Next.js process-startup hook).

## What this fix does NOT do

- **Does not launch EUR pricing.** `displayByCurrency.EUR` is left
  unset on every tier. Populating it with real numbers is a pricing
  decision (what should Pro cost in €?), not a mechanical GBP→EUR FX
  conversion, and this fix doesn't make that call. No ticket exists yet
  for the actual EUR launch — it's a deliberate future decision, not a
  silent gap (this doc + the SSOT doc-block are the record of that).
- **Does not change `resolveProStripePriceId`'s runtime behaviour.**
  Its existing GBP-fallback resolution logic (tested in
  `tests/unit/resolveProStripePrice.test.ts`) is untouched. The fix
  prevents the invalid environment (EUR SKU env set + EUR display not
  ready) from ever reaching a running process — it does not change what
  that function does once inside a valid one.
- **Does not touch any live Stripe configuration.** No Price objects,
  webhooks, or dashboard settings were created or modified. EUR SKU env
  vars remain unset everywhere today, same as before this change.

## Mechanism (traced end to end, confirmed against the running code)

1. `app/pricing/page.tsx` calls `detectRegion(headers())`
   (`src/lib/region/detectRegion.ts`) → EU visitors get
   `{ currency: "EUR", displayAmountsInGbp: true }`.
2. `PricingTiersGrid` (`app/pricing/PricingTiersGrid.tsx`) renders
   `tier.price` / `tier.annualPrice` — the flat GBP strings — regardless
   of `regionCurrency`. It also passes `regionCurrency` straight through
   to `CheckoutButton`.
3. `CheckoutButton.tsx` forwards `currency: "EUR"` in the POST body to
   `/api/stripe/checkout`.
4. `app/api/stripe/checkout/route.ts` calls
   `resolveProStripePriceId({ period, currency: "EUR" })`
   (`src/lib/stripe/resolveProStripePrice.ts`), which returns the
   `STRIPE_PRICE_PRO_{MONTHLY,ANNUAL}_EUR` Price id whenever that env
   var is set — no check against what the visitor was just shown.
5. `app/pricing/page.tsx` even removes its "EU pricing coming soon —
   current prices in GBP" `regionNote` the instant
   `isEurStripePricingConfigured()` flips true (it's conditioned on
   `!isEurStripePricingConfigured()`), so the moment the env var is set,
   the explanatory note also disappears — zero on-screen signal that
   anything changed.

Step 2 was the actual gap: nothing in the display path was currency-aware,
so there was no way for it to do anything other than show GBP even once
step 4 started charging EUR. This fix adds the missing data shape (step 1
above), but deliberately stops short of wiring it into step 2's render —
that's a separate, larger change (touch every price-rendering call site:
`PricingTiersGrid`, `PricingHeroCta`, `upgrade-paywall-dialog.tsx`, the
mobile paywall) gated on having a real EUR price to show. Shipping the
SSOT shape without the render wiring, with no live EUR data, is safe:
`/pricing` behaves identically to before this change.

## Why a boot-time assertion, not just the SSOT field

Adding `displayByCurrency` alone doesn't prevent the bug — it only makes
the *fix* possible once someone does the render wiring. Nothing stops a
future engineer (or Grace, flipping an env var in the Vercel dashboard)
from setting `STRIPE_PRICE_PRO_MONTHLY_EUR` before that wiring lands,
recreating exactly the MP-10/LEGAL-009 scenario. The assertion is the
actual safety rail: it makes that sequencing mistake impossible to ship
silently.

**Two enforcement points, not one, on purpose:**

- `scripts/verify-production-env.ts` is `npm run ci`'s first step and
  the natural CI/deploy gate — catches the misconfiguration before a
  bad build ever reaches Vercel.
- `src/instrumentation.ts` `register()` is the actual Next.js
  once-per-process-start hook. It's the defense-in-depth layer:
  if an env var is added directly in the Vercel dashboard and a
  redeploy happens without `verify-production-env` running (e.g. a
  dashboard-only env change triggering a redeploy), the server still
  refuses to boot and serve traffic in the broken state.

**Why this specific check fails unconditionally (not gated by
`VERIFY_STRICT`/`VERCEL_ENV` like the rest of `verify-production-env.ts`'s
warnings):** every other check in that script is "a feature will be
degraded/unavailable" — acceptable to leave as a soft warning in local
dev or preview. This check is "a paying customer could be shown one
price and charged another" — an active-mischarge risk with real money
and legal exposure (misleading-pricing) attached the moment it fires.
That bar is categorically different, so it gets a categorically stricter
gate: hard-fail everywhere, always.

## Rejected alternatives

- **Silently fall back to GBP at the resolver level instead of
  asserting.** I.e. have `resolveProStripePriceId` refuse to use the
  EUR Price id when display isn't ready, same as its existing
  EUR-env-unset fallback. This keeps checkout *working* (consistent
  £-shown/£-charged) even in the broken-config state, which sounds
  safer at first glance. Rejected: it's silent. Whoever set the EUR env
  var — believing they'd enabled EUR checkout — would see no signal
  that nothing changed; the misconfiguration could sit unnoticed
  indefinitely, right up until someone finishes the display wiring
  later and assumes (wrongly, if the fallback masked an unrelated
  problem) it's fully tested. A loud, deploy-blocking failure forces
  the operator to notice and fix the actual dependency order
  immediately, which is worth the (currently zero, since no EUR env
  var is set anywhere) risk of an unexpected boot crash.
- **Only gate at the CI script, skip `instrumentation.ts`.** Cheaper,
  and `verify-production-env` runs first in `npm run ci`, which should
  catch this before any deploy. Rejected as insufficient defense in
  depth: env vars can be added directly in Vercel's dashboard against
  an already-built deployment without re-running the repo's CI
  pipeline. The instrumentation-hook throw is what actually stops that
  path from serving traffic.
- **Populate `displayByCurrency.EUR` with a computed FX-converted
  value now**, so the field is never empty and the guard is moot.
  Rejected: converting £7.99 by a spot FX rate is not the same thing as
  *pricing* Pro in EUR — currency-adjusted SaaS pricing typically isn't
  a flat FX conversion (rounding to a clean price point, VAT-inclusive
  display requirements, regional willingness-to-pay), and shipping a
  guessed number would be exactly the kind of "prefer real, validated
  functionality over mocked" violation the project rules forbid. The
  right EUR price is Grace's call to make explicitly, not something to
  back into via this bugfix.

## Follow-up (not blocking, not urgent — EUR SKUs are unset everywhere)

When EUR pricing is actually decided:
1. Populate `displayByCurrency.EUR` on the Pro tier in
   `src/lib/landing/pricingTiers.ts` with the real, decided numbers.
2. Wire `PricingTiersGrid` (and any other price-rendering call site —
   `PricingHeroCta`, `upgrade-paywall-dialog.tsx`, the mobile paywall
   if it ever grows currency awareness) to call
   `resolveTierDisplay(tier, currency)` instead of the flat GBP fields.
3. Only then set `STRIPE_PRICE_PRO_MONTHLY_EUR` /
   `STRIPE_PRICE_PRO_ANNUAL_EUR` in any environment — the guard added
   here will refuse to boot until step 1 is done regardless, so this
   ordering is enforced, not just documented.
