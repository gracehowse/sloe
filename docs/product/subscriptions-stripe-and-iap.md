# Subscriptions: Stripe (web) and IAP (mobile)

Suppr uses **two purchase systems** by design; they must stay aligned on **entitlements** in Supabase (`profiles.user_tier`), not on a single checkout provider.

## Web (Next.js)

- **Provider:** Stripe Checkout / Customer Portal (see app pricing and webhook handlers).
- **Truth:** Stripe webhook updates `profiles.user_tier` after payment events. The same `checkout.session.completed` webhook captures `session.customer` onto `profiles.stripe_customer_id` so the billing portal can open without a Stripe API lookup round-trip (round 3, 2026-04-19).
- **Trial (ENG-1285, 2026-07-01):** `app/api/stripe/checkout/route.ts` passes `subscription_data.trial_period_days: 7` + `payment_method_collection: "always"` (card upfront) for **Pro annual only** — monthly is trial-less per pricing v1 (`docs/decisions/2026-04-19-pricing-v1.md`). This matches the mobile IAP annual trial and makes the /pricing "No payment due now — first charge on Day 7" chip truthful. The webhook grants Pro on `trialing` status; the annual `BillingDisclosure` on /pricing and the upgrade-dialog renewal note both lead with the trial + Day-7 first-charge clause. Pinned by `tests/unit/stripeCheckoutRoute.test.ts` (params) and `tests/unit/landingParity.test.tsx` / `tests/unit/upgradePaywallDialog.test.tsx` (copy).
- **Billing portal route:** `/account/billing` is a server component (`app/account/billing/page.tsx`) that opens the Stripe Customer Portal for the signed-in user.
  - Unauthenticated → redirects to `/login?redirect=/account/billing`.
  - No `stripe_customer_id` (Free users, or paid users pre-migration) → redirects to `/pricing?ref=billing`.
  - `STRIPE_SECRET_KEY` unset or Stripe API error → renders a static support-email fallback (`support@suppr-club.com`). Never 404, never 5xx.
  - Decision logic is unit tested via the pure `resolveBillingPortalOutcome` helper in `src/lib/stripe/billingPortalDecision.ts` — see `tests/unit/accountBilling.test.tsx`.
  - `return_url` is `/settings` (ENG-748 #11) so the user lands back on the subscription card after the portal, where the freshly-updated state renders.
- **Subscription status card (ENG-748 #11):** `src/app/components/settings/SubscriptionCard.tsx` renders the current subscription state inside Settings (only for Pro users). The Stripe Customer Portal owns every mutation — this card is **read-only**; it never builds custom billing mutations.
  - **Data:** `GET /api/stripe/subscription-status` (`app/api/stripe/subscription-status/route.ts`) — Bearer-token auth (mirrors the checkout route), looks up `profiles.stripe_customer_id` via the service role, and when present calls `stripe.customers.retrieve(id, { expand: ['subscriptions', 'subscriptions.data.default_payment_method'] })`. Returns a **typed minimal payload only**: `{ ok, subscription | null, managedVia, taxEnabled }`. The subscription summary carries `status, billingPeriod, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, priceAmount, currency, paymentMethodBrand, paymentMethodLast4`. **Never the raw Stripe customer object; never the full card number — only brand + last4.** Never cached (`Cache-Control: no-store`). Errors go to Sentry via `captureRouteError`.
  - **`managedVia`:** `"stripe"` (has customer id) / `"app_store"` (no customer id + Pro tier — paid via RevenueCat/IAP) / `"none"` (Free).
  - **Client hook:** `src/lib/stripe/useSubscriptionStatus.ts` wraps the fetch with loading/error states and derives an explicit `canceling` boolean from `cancelAtPeriodEnd` so the UI cannot confuse canceled-but-active with Free.
  - **States rendered (legal-reviewer verbatim copy):** active (renews), trial (charges at trial end), canceled-but-active ("cancelled, access until [date]" — never "renews"), past-due (amber banner linking straight to `/account/billing`, no export-dialog interstitial), IAP (Apple-billing copy, **no web cancel control**), and Free.
  - **Provider-authoritative:** next-charge date, amount, and currency come straight from the Stripe subscription — never hardcoded or guessed. When Stripe omits a field the copy shows a quiet placeholder.
  - **VAT note** is flag-gated via `resolveRenderedVatNote` (`STRIPE_TAX_ENABLED`): `Includes VAT.` only when tax is computing; otherwise `Price excludes any applicable taxes.`. The UK/EU statutory 14-day cancellation line reuses the existing `BillingDisclosure` region branch (via `detectRegion`) — no second region path.
  - **Cancel reachable in-app:** the "Manage or cancel subscription" CTA is the primary, full-width control (equal-or-greater weight than any keep/upgrade affordance) and routes through the existing `CancelExportPromptDialog` → `/account/billing` → Stripe Customer Portal — no retention save-wall on the path.
  - **Render decision is the pure `resolveSubscriptionCardView` helper** in `src/lib/stripe/subscriptionCardView.ts`, unit-tested (`tests/unit/subscriptionCardView.test.ts`); the route payload shape and the component wiring are pinned by `tests/unit/stripeSubscriptionStatusRoute.test.ts` and `tests/unit/subscriptionCard.test.tsx`.
  - **Public-launch gate:** the surface ships for the N=1 TestFlight stage. Public-launch counsel sign-off + visual QA are a separate later gate before public launch.
- **Copy:** Pricing page and upgrade modals should describe **card / web** checkout, not App Store or Google Play.

## Mobile (Expo)

- **Provider:** RevenueCat → App Store / Google Play IAP.
- **Truth:** After purchase or restore, the app calls `syncTierToSupabase` so `profiles.user_tier` matches RevenueCat entitlements (`base`, `pro`).
- **Copy:** Paywall and upgrade paths should describe **in-app purchase**, not Stripe.

## User expectations

- A user might subscribe on **web** and use **mobile** (or the reverse). Tier must resolve from **Supabase** for API limits and shared features, with clients refreshing tier after login and after purchase/restore.
- Support flows should ask *where they subscribed* before deep-linking to the wrong billing portal.

## Product / engineering checklist

- [ ] Web upgrade CTAs never imply “manage in App Store” unless the user is on mobile web with an IAP-only path (usually N/A).
- [x] IAP subscribers (`managedVia: "app_store"`) never see a web/Stripe cancel control — the SubscriptionCard shows the Apple-billing copy instead (legal P0 MV-1/MV-2).
- [ ] Mobile paywall explains trial / renewal in store terms; link to Terms / Privacy as needed.
- [ ] Env: RevenueCat API keys and Stripe keys are both documented in `docs/environment.md` and app config (`EXPO_PUBLIC_*` for mobile).

## Cross-platform parity note (ENG-748 #11)

The web SubscriptionCard is **web-only and has no mobile parity by design.** Mobile billing is IAP (RevenueCat / App Store); Apple's own Settings → Apple ID → Subscriptions UI is the mobile subscription-management surface, and Apple policy forbids us building an in-app cancel for an App Store subscription. The web card's IAP branch (the Apple-billing copy) exists precisely to route web visitors who *paid on mobile* to that Apple-managed surface. This is a documented intentional divergence, not drift.
