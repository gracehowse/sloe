# Subscriptions: Stripe (web) and IAP (mobile)

**Audience:** Product / Engineering — the billing and entitlement contract behind Suppr's Free/Pro model.

**One-line purpose:** how checkout works on each platform, and — the part that actually matters for correctness — how a purchase on *either* platform becomes the single `profiles.user_tier` value every surface reads, so a subscriber who paid on one platform is Pro everywhere.

## Scope

**In scope:** Stripe Checkout / Customer Portal (web); RevenueCat + App Store IAP (mobile); both webhook-based entitlement-write paths; the reconcile-cron safety net and its Stripe-only scope; the two known limitations on the mobile rail (no reconcile safety net yet, and a trial claim that hasn't been independently verified against the App Store product).

**Out of scope (linked, not duplicated):**
- **The end-to-end user journey** (trigger → in-context paywall sheet → checkout → webhook → receipt → manage/cancel, with the "why built this way" narrative) → [`docs/journeys/monetisation-and-paywall.md`](../journeys/monetisation-and-paywall.md). Read that first for journey shape; this doc is the contract/reference detail it links back to for Steps 3–5.
- **The exhaustive server-enforced tier-gate register** (routes, migrations, error codes) → [`docs/product/tier-gates.md`](./tier-gates.md).
- **Referral credits / promo-code / `lifetime_pro` comp** — alternate, non-purchase ways a user becomes entitled → [`docs/product/referrals.md`](./referrals.md).

Suppr uses **two purchase systems** by design, not by accident: Apple requires In-App Purchase for any digital subscription bought on iOS, and Stripe gives the web product a more flexible, lower-fee checkout everywhere else. Running two rails only works as one product if both stay aligned on **entitlements** in Supabase (`profiles.user_tier`) rather than on a single checkout provider — a subscriber's access has to look identical regardless of which store took their money.

## Web (Next.js)

- **Provider:** Stripe Checkout / Customer Portal (see app pricing and webhook handlers).
- **Truth:** Stripe webhook updates `profiles.user_tier` after payment events. The same `checkout.session.completed` webhook captures `session.customer` onto `profiles.stripe_customer_id` so the billing portal can open without a Stripe API lookup round-trip.
- **Trial:** `app/api/stripe/checkout/route.ts` passes `subscription_data.trial_period_days: 7` + `payment_method_collection: "always"` (card upfront) for **Pro annual only** — monthly is trial-less per pricing v1 (`docs/decisions/2026-04-19-pricing-v1.md`). The trial exists to lower the barrier to committing to a full year up front, matches the mobile IAP annual trial, and is what makes the /pricing "No payment due now — first charge on Day 7" chip truthful rather than aspirational. The webhook grants Pro on `trialing` status; the annual `BillingDisclosure` on /pricing and the upgrade-dialog renewal note both lead with the trial + Day-7 first-charge clause.
- **Billing portal route:** `/account/billing` is a server component (`app/account/billing/page.tsx`) that opens the Stripe Customer Portal for the signed-in user.
  - Unauthenticated → redirects to `/login?redirect=/account/billing`.
  - No `stripe_customer_id` (Free users, or paid users pre-migration) → redirects to `/pricing?ref=billing`.
  - `STRIPE_SECRET_KEY` unset or Stripe API error → renders a static support-email fallback (`support@suppr-club.com`). Never 404, never 5xx.
  - Decision logic lives in the pure `resolveBillingPortalOutcome` helper (`src/lib/stripe/billingPortalDecision.ts`).
  - `return_url` is `/settings` so the user lands back on the subscription card after the portal, where the freshly-updated state renders.
- **Subscription status card:** `src/app/components/settings/SubscriptionCard.tsx` renders the current subscription state inside Settings (only for Pro users) — what a subscriber is paying, when it renews or ends, and how to change or cancel it, without leaving the app or guessing which portal applies to them. The Stripe Customer Portal owns every mutation — this card is **read-only**; it never builds custom billing mutations.
  - **Data:** `GET /api/stripe/subscription-status` (`app/api/stripe/subscription-status/route.ts`) — Bearer-token auth (mirrors the checkout route), looks up `profiles.stripe_customer_id` via the service role, and when present calls `stripe.customers.retrieve(id, { expand: ['subscriptions', 'subscriptions.data.default_payment_method'] })`. Returns a **typed minimal payload only**: `{ ok, subscription | null, managedVia, taxEnabled }`. The subscription summary carries `status, billingPeriod, currentPeriodEnd, trialEnd, cancelAtPeriodEnd, priceAmount, currency, paymentMethodBrand, paymentMethodLast4`. **Never the raw Stripe customer object; never the full card number — only brand + last4.** Never cached (`Cache-Control: no-store`). Errors go to Sentry via `captureRouteError`.
  - **`managedVia`:** `"stripe"` (has customer id) / `"app_store"` (no customer id + Pro tier — paid via RevenueCat/IAP) / `"none"` (Free).
  - **Client hook:** `src/lib/stripe/useSubscriptionStatus.ts` wraps the fetch with loading/error states and derives an explicit `canceling` boolean from `cancelAtPeriodEnd` so the UI cannot confuse canceled-but-active with Free.
  - **States rendered (wording confirmed by legal):** active (renews), trial (charges at trial end), canceled-but-active ("cancelled, access until [date]" — never "renews"), past-due (amber banner linking straight to `/account/billing`, no export-dialog interstitial), IAP (Apple-billing copy, **no web cancel control**), and Free.
  - **Provider-authoritative:** next-charge date, amount, and currency come straight from the Stripe subscription — never hardcoded or guessed. When Stripe omits a field the copy shows a quiet placeholder.
  - **VAT note** is flag-gated via `resolveRenderedVatNote` (`STRIPE_TAX_ENABLED`): `Includes VAT.` only when tax is computing; otherwise `Price excludes any applicable taxes.`. The UK/EU statutory 14-day cancellation line reuses the existing `BillingDisclosure` region branch (via `detectRegion`) — no second region path.
  - **Cancel reachable in-app:** the "Manage or cancel subscription" CTA is the primary, full-width control (equal-or-greater weight than any keep/upgrade affordance) and routes through the existing `CancelExportPromptDialog` → `/account/billing` → Stripe Customer Portal — no retention save-wall on the path.
  - **Render decision** lives in the pure `resolveSubscriptionCardView` helper (`src/lib/stripe/subscriptionCardView.ts`), kept separate from the component so the state-to-copy mapping stays deterministic and easy to check.
  - **Public-launch gate:** the surface ships for the N=1 TestFlight stage. Public-launch counsel sign-off + visual QA are a separate later gate before public launch.
- **Copy:** Pricing page, upgrade modals, and CTA copy should describe **card / web** checkout, not App Store or Google Play — including never implying "manage in the App Store," which only applies on the rare mobile-web, IAP-only path.

## Mobile (Expo)

- **Provider:** RevenueCat → App Store IAP. iOS-only — the Android config in the repo is a vestigial Expo template that has never been built; treat "Google Play" as not-live.
- **Truth: the RevenueCat webhook is the sole server-authoritative writer, not the client.** `profiles.user_tier` is client-write-locked (`supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql`) — the same lockdown that applies on web. After a purchase or restore, the app calls `syncTierToSupabase` (`apps/mobile/lib/purchases.ts`), but that write **is expected to be rejected** with `42501`. It exists for telemetry (`TierSyncOutcome.status === "lockdown_expected"` — so a dropped webhook shows up in analytics as a client-attempted-but-rejected write, rather than silently vanishing) and as a legacy fallback path from before the RevenueCat webhook existed, not as the entitlement source of truth. **Do not read its presence in the codebase as evidence the client can grant its own tier** — it can't, by design, for the same paywall-bypass reason the tier column is locked down at all.
- **Copy:** Paywall and upgrade paths should describe **in-app purchase**, not Stripe — trial and renewal terms in store language, with a link to Terms / Privacy where the flow calls for it.

### RevenueCat webhook → tier reconciliation (mirror of the Stripe webhook, above)

`POST /api/revenuecat/webhook` (`app/api/revenuecat/webhook/route.ts`, business logic in `src/lib/revenuecat/webhookProcess.ts`) is the mobile equivalent of the Stripe webhook: same writer (`updateProfileTierServiceRole`), same `profiles.user_tier` column, same dedup pattern.

- **Auth:** RevenueCat posts a static, dashboard-configured bearer secret in the `Authorization` header (bare or `Bearer `-prefixed — both accepted). Compared against `REVENUECAT_WEBHOOK_AUTH` with a **constant-time comparison**; mismatch → 401 + a Sentry warning (a leaked or guessed bearer needs to be visible, not lost in server logs).
- **Freshness check:** events carry `event_timestamp_ms`; anything older than **26 hours** is rejected (400 `event_too_old` + Sentry). 26h rather than 24h because RevenueCat's own retry window runs up to 24h in exponential backoff — the check has to outlive RC's legitimate retries, or it would reject events RC is still validly delivering.
- **Idempotency:** every event is inserted into `revenuecat_events` keyed on `event_id` before any tier write — sister table to `stripe_webhook_events`, same dedup pattern. A `23505` (duplicate key) short-circuits to `skipped_duplicate`. RC delivers at-least-once, so this is required, not defensive.
- **Event → tier mapping:**

  | RevenueCat event type | Effect |
  |---|---|
  | `INITIAL_PURCHASE` / `RENEWAL` / `PRODUCT_CHANGE` / `UNCANCELLATION` / `NON_RENEWING_PURCHASE` / `TEMPORARY_ENTITLEMENT_GRANT` | Tier resolved from `entitlement_ids` on the payload, written via the service-role writer. Also fires a server-side `subscription_purchased` (initial) / `subscription_renewed` (renewal) analytics event here, not client-side — a backgrounded or closed mobile app must not be the thing standing between a real purchase and the revenue event landing in PostHog. |
  | `CANCELLATION` / `BILLING_ISSUE` | No-op. Auto-renew-off and an active billing grace period both mean the entitlement is still live — cancelling doesn't strip access until the paid period actually ends. |
  | `EXPIRATION` / `SUBSCRIPTION_PAUSED` / `REFUND` | Tier → `free`. A refund revokes immediately — no paid-through grace window survives a refund. |
  | `TRANSFER` | Entitlement re-pointed between profiles: the destination `app_user_id` in `transferred_to` gains the tier, the origin in `transferred_from` drops to `free`. Falls back to a no-op rather than guessing on a partial/unresolvable payload. |
  | `SUBSCRIPTION_EXTENDED` / any unrecognised type | Persisted for forensic replay (full payload lives in `revenuecat_events.payload`); no tier action — an extension doesn't change the current entitlement, and a following `RENEWAL` re-asserts it anyway. |
  | Any event for an anonymous RC `app_user_id` (doesn't map to a Supabase uuid) | Persisted for audit, not acted on (`skipped_anonymous`). |

- **Bridging the propagation gap:** the buying device doesn't wait on the webhook blind. After `purchasePackage` resolves, the paywall calls `pollUntilEntitled` (up to 10s, polling RevenueCat's own `CustomerInfo` directly — not Supabase) so the success screen can render as soon as Apple + RC agree the purchase is real, without needing the webhook round-trip to have already landed. The webhook is still what makes the entitlement durable and visible on *other* devices/platforms; polling only smooths the buyer's own device.
- **Setup / env:** `REVENUECAT_WEBHOOK_AUTH` + `SUPABASE_SERVICE_ROLE_KEY` (Vercel). RC dashboard → Project Settings → Integrations → Webhooks → URL `https://<host>/api/revenuecat/webhook`, Authorization = the same secret as `REVENUECAT_WEBHOOK_AUTH`. RC's "Send test event" button should return 200. (`REVENUECAT_WEBHOOK_AUTH` isn't yet listed alongside the Stripe keys in `docs/environment.md` — worth adding there too.)

## Known limitations

Two gaps sit on the mobile rail today. Neither is silently accepted — both are deliberate, documented trade-offs for the current TestFlight/sandbox stage, and both need a real decision before mobile purchases go live for paying users.

### The reconcile cron only covers Stripe

The `entitlement-reconcile` cron described under the Stripe webhook section above (`POST /api/cron/entitlement-reconcile`, every 6h) exists because `profiles.user_tier` is a denormalised mirror that nothing self-heals if a webhook is dropped. That safety net covers Stripe only — the RevenueCat/mobile half doesn't exist yet (see `docs/decisions/2026-07-10-entitlement-reconciliation-cron.md` for the design and rationale).

Concretely: if a RevenueCat webhook for a real purchase is ever permanently missed — a delivery failure outside RC's 24-hour retry window, a `REVENUECAT_WEBHOOK_AUTH` rotation gone wrong, an RC-side outage — there is no background process that will notice or correct it. The mobile purchaser stays stranded on the wrong tier until someone finds and fixes it by hand in Supabase, unlike the Stripe rail, where the same failure mode self-corrects on the next six-hourly sweep.

This is acceptable while TestFlight purchases clear through Apple's sandbox and no real money has moved through the RevenueCat rail yet (`docs/decisions/2026-07-06-launch-sequencing-revenue-rails.md`). It stops being acceptable the moment mobile purchases go live for real users — either the RevenueCat half of the cron ships before public mobile launch, or accepting the gap for a defined window becomes a deliberate call rather than an assumed one.

### The mobile trial claim isn't independently verified against the App Store product

The mobile paywall's 7-day-trial copy ("no payment due now, first charge on Day 7") is driven by a client-side constant, not by anything RevenueCat or StoreKit confirms about the specific product being purchased:

```ts
// apps/mobile/app/paywall.tsx:467
const trialApplies = billing === "annual"; // 7-day trial only on Pro annual
```

This assumes the Pro-annual SKU's introductory offer is configured correctly in App Store Connect. The code never inspects the real RevenueCat/StoreKit package object (`pkg.product.introPrice` / `discounts`) to confirm that offer is actually attached to the product about to be bought — it infers "annual → trial" purely from which billing-period toggle is selected in the UI.

This is a materially different risk from web. On web, Stripe is the authority: `subscription_data.trial_period_days: 7` is passed to Stripe itself, so the trial is enforced by the payment processor, not merely described by copy. On mobile, if the App Store Connect SKU doesn't actually carry that 7-day introductory offer, Apple charges on day 0 while the paywall tells the user "no payment due now" — a false claim, and a real trust and legal exposure, not a cosmetic bug.

This shipped to TestFlight without that cross-check ever having been done. The presence of the trial copy in the codebase is not evidence that the store product is configured to match it — the two have never been verified against each other. Resolving this needs someone to confirm the actual App Store Connect product configuration against the copy, ideally paired with an engineering fix that reads `pkg.product.introPrice`/`discounts` and only renders trial copy when the store product genuinely carries one.

## User expectations

- A user might subscribe on **web** and use **mobile** (or the reverse). Tier must resolve from **Supabase** for API limits and shared features, with clients refreshing tier after login and after purchase/restore.
- Support flows should ask *where they subscribed* before deep-linking to the wrong billing portal.

## Cross-platform parity note

The web SubscriptionCard is **web-only and has no mobile parity by design.** Mobile billing is IAP (RevenueCat / App Store); Apple's own Settings → Apple ID → Subscriptions UI is the mobile subscription-management surface, and Apple policy forbids building an in-app cancel for an App Store subscription. The web card's IAP branch (the Apple-billing copy) exists precisely to route web visitors who *paid on mobile* to that Apple-managed surface. This is a documented intentional divergence, not drift.

The webhook layer is the mirror-image case: the Stripe and RevenueCat webhooks are **structurally identical** (bearer/signature verification, idempotent dedup table, same service-role writer, same `profiles.user_tier` column) — but they are **not at parity on safety net or trial-verification rigour**. The Stripe rail has an automated drift-recovery cron and a processor-enforced trial; the RevenueCat rail has neither yet. Both gaps are described above under Known limitations, not silently accepted as "mobile is just different."

## Related documents

- [Journey: Monetisation / Paywall Loop](../journeys/monetisation-and-paywall.md) — the end-to-end narrative (trigger → paywall sheet → checkout → webhook → cron → receipt → manage/cancel) that this doc's contract detail sits behind; Steps 3–5 cover the mobile webhook, the cron gap, and the trial risk in journey shape, and link back here for the reference detail.
- [Product: Tier gates — server-side enforcement points](./tier-gates.md) — the gates that trigger a paywall in the first place.
- [Product: Referral rewards](./referrals.md) — the promo-code / `lifetime_pro` / referral-credit paths that grant entitlement without a Stripe or App Store purchase.
- [Decision: Entitlement reconciliation cron](../decisions/2026-07-10-entitlement-reconciliation-cron.md) — full design and rationale for the Stripe-only scope described above.
- [Decision: Launch sequencing — revenue rails](../decisions/2026-07-06-launch-sequencing-revenue-rails.md) — why the RevenueCat-half gap is judged acceptable at the current TestFlight/sandbox stage.
