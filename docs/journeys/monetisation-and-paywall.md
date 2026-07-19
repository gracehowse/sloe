# User Journey: Monetisation / Paywall Loop

**Audience:** Product / Engineering / Design

**One-line purpose:** trace the full path from "a user hits a real feature
gate" to "that user is a reconciled, entitled Pro subscriber who can find
their receipt and cancel without a fight" — across both billing rails.

## Scope

**In scope:** the end-to-end loop — trigger (a server-enforced tier gate) →
in-context paywall sheet → full paywall/checkout (web Stripe, mobile
RevenueCat IAP) → provider webhook → `profiles.user_tier` write → the
entitlement-reconcile cron safety net → success/receipt → manage/cancel. Also
in scope: the promo-code/`lifetime_pro` comp path and the referral-credit
boundary, because both are alternate ways a user becomes "entitled" outside
the two paid rails and this doc is where a reader needs to see how they
relate.

**Out of scope (linked, not duplicated):**
- **The exhaustive list of every server-enforced tier gate** (which route,
  which migration, which error code) → [`docs/product/tier-gates.md`](../product/tier-gates.md)
  is the canonical register. This doc names each gate once, in plain
  language, and links out — it does not re-list routes or migrations.
- **Stripe/RevenueCat API contract detail** — webhook payload shapes,
  `subscription_data` params, the `SubscriptionCard`/`useSubscriptionStatus`
  data contract → [`docs/product/subscriptions-stripe-and-iap.md`](../product/subscriptions-stripe-and-iap.md).
- **Referral mechanics** — invite-link generation, the `referral_credits`
  ledger, `redeem_referral_code` → [`docs/product/referrals.md`](../product/referrals.md).
  This doc only covers the entitlement boundary (referral credits are not a
  subscription).
- **AI logging pipeline internals** (voice/photo capture, transcription,
  `verifyIngredients`) → [`food-tracking.md`](./food-tracking.md) "Voice
  log" / "Photo log". This doc only covers the paywall gate those flows hit.
- **Meal-plan generation, recipe saves, cookbook import UX** →
  [`meal-planning.md`](./meal-planning.md), [`import-cookbook.md`](./import-cookbook.md).
  This doc only covers what happens when those flows hit their tier cap.

## Loops this doc belongs to

This is the canonical home of the **Monetisation / Paywall Loop**:

1. **Trigger** — a server-enforced gate rejects a write or request.
2. **In-context paywall sheet/dialog** — explains the specific gated
   feature, in place, with a CTA to the full paywall.
3. **Full paywall/pricing** — web Stripe Checkout or mobile RevenueCat IAP.
4. **Webhook reconciliation** — the provider webhook is the only writer of
   `profiles.user_tier`.
5. **Entitlement-reconcile cron** — backstops missed Stripe events only.
6. **Success/receipt** — trust-copy confirmation, same SSOT both platforms.
7. **Manage/cancel** — Stripe Customer Portal or RevenueCat Customer
   Center, both fronted by an export-first interstitial.

**Cross-loop links:**
- **Onboarding → First Log** — mobile onboarding forces the annual,
  trial-eligible SKU and can route straight to `/paywall?from=onboarding`
  before the user ever reaches Today (see
  [`onboarding-to-first-log.md`](./onboarding-to-first-log.md)). This is
  the single highest-volume entry into this loop.
- **AI-Assisted Logging & Trust Loop** — voice/photo taster exhaustion on
  Today is the second-highest-volume entry (see [`food-tracking.md`](./food-tracking.md)).
- **Settings & Control Loop** — manage/cancel (Step 7 below) is a branch of
  the settings loop, not a separate screen family.

## Overview

A user hits a real feature boundary (not a marketing wall — a database or
API rejection), sees a factual, in-context explanation of exactly what's
gated, and can either dismiss it and keep using the free product, or convert
through the platform-appropriate checkout rail. Once they pay, a
provider-owned webhook — never the client — writes the single tier column
every surface reads (`profiles.user_tier`), so a purchase on one platform is
usable on the other. A safety-net cron catches drift on the web rail; mobile
has no equivalent yet — see the open risk described in Step 5.

**Why the loop is built this way, not simpler:** the alternative — client
writes its own tier after a client-observed "purchase succeeded" signal —
is exactly the paywall-bypass bug class the codebase has already found and
fixed three times on the *feature-gate* side (saves cap, publish gate,
meal-plan day cap). The same logic applies to the *entitlement-write* side:
if the client could set its own tier, a replayed or forged "purchase
succeeded" event would grant free Pro. Locking the tier column to
server-trusted writers (webhook signature verification + service-role
writes) closes that class entirely, at the cost of a real propagation gap
between "Apple/Stripe took the money" and "Supabase agrees you're Pro" —
which is why Step 4 and the mobile `pollUntilEntitled` exist.

## Step 1 — Trigger: a server-enforced gate rejects the action

**Why this step exists:** client-side locks (grey chips, disabled buttons)
are UX, not enforcement. Every real monetisation boundary in the product has
a database or API rejection behind it — otherwise it's a paywall bypass
waiting to be found (three already have been: saves cap, publish gate,
meal-plan day cap). **The canonical, complete register of every one of
these gates — with route, migration, and exact error contract — is
[`docs/product/tier-gates.md`](../product/tier-gates.md). This doc does not
re-derive that table; it names each gate once so the loop reads end to end:**

| Gate | What the free/base user hits | Enforcement layer |
|---|---|---|
| Voice logging | Pro-only — any non-Pro request is rejected outright | API, `voice-log` route |
| Photo logging | A real free taster (5 analyses per rolling 7 days), then rejected | API, `photo-log` route, rate-limit bucket |
| Multi-day meal plan | Free is capped at 1 day; Pro up to 7 | Database RPC (`save_meal_plan`) |
| Recipe saves | Free is capped at 10 saved recipes | Database RLS |
| Publish a recipe | Paid-only | Database RLS |
| Cookbook import (PDF/image parse) | Paid-only | API route |
| Recipe import from image | Paid-only | API route |

See `tier-gates.md` for exact routes, migrations, and error codes (42501 /
RLS for the database layer, 403 `upgrade_required` for the API layer) — do
not copy those details into product/UX docs, including this one; link
instead so the two can't drift.

**What the user does:** taps/uses the gated feature normally, with no prior
warning that it's gated (no dark-pattern countdown, no "N left" nagging
before the real limit — the photo-log taster line is the one exception,
and it's honest: "X free logs remaining this week").

**What happens next:** the rejection surfaces the in-context paywall sheet
(Step 2), never a raw error toast.

## Step 2 — In-context paywall sheet/dialog

**Why this step exists:** shoving the user to a commercial-intent full
screen on the very first tap of a feature they haven't tried is worse
conversion and worse trust than explaining, in place, exactly what's gated
and why.

**What the user does:** sees a bottom sheet (mobile, `AiPaywallSheet`) or
dialog (web, `ai-paywall-dialog.tsx`) naming the specific feature —
"Voice logging is a Pro feature" or "You've used all 5 of your free photo
logs this week" — with a primary CTA to the full paywall and a "Not now"
dismiss that returns them to logging with nothing else disrupted.

**What happens next:** primary CTA → full paywall/pricing, carrying
`?from=voice_log` / `?from=photo_log` (or the gate-specific equivalent —
`recipe_import`, `meal_planner`, `body_composition`, `settings`, `onboarding`,
`import_photo`, `trial_end`) so the destination surface can attribute the
conversion funnel back to the exact trigger. Dismiss → back to whatever the
user was doing; no re-nag on the same tap.

**Web/mobile parity:** identical — shared `FEATURE_COPY`, identical
analytics payloads (`ai_paywall_sheet_viewed` / `_dismissed` / `_cta_tapped`).
The sheet is UX; Step 1's server gate is the real enforcement — a sheet bug
never grants a bypass.

## Step 3 — Full paywall / checkout

This is where the two billing rails genuinely diverge, by design (Stripe
is the only web-billing option; Apple requires IAP on iOS). Full contract
detail for both rails lives in
[`docs/product/subscriptions-stripe-and-iap.md`](../product/subscriptions-stripe-and-iap.md)
— this section covers the journey shape only.

### Web: `/pricing` + Stripe Checkout

**What the user does:** lands on the public, server-rendered `/pricing`
page (region-detected currency, value grid, FREE/PRO comparison, trust
strip, monthly↔annual toggle), taps a tier CTA. `CheckoutButton` POSTs
`{tier, period, currency}` with a Bearer token to `/api/stripe/checkout`,
which authenticates, rate-limits (10/min per user), resolves the region
price id, and creates a Stripe subscription Checkout Session. Redirect is
to Stripe-hosted checkout.

**Why annual carries a real trial and monthly doesn't:** the pricing model
deliberately makes monthly a "no trial, churn trap" — Pro annual passes
`subscription_data.trial_period_days: 7` + `payment_method_collection:
"always"` (card collected up front) to Stripe, so the trial is **server-
enforced by Stripe itself**, not asserted by the client. This is what makes
the `/pricing` "No payment due now — first charge on Day 7" chip and the
`/checkout/success` receipt truthful on web. (Contrast with mobile — see
the risk described below.)

**Edge case:** requesting `tier: "base"` is rejected with 400
`invalid_tier` — Pro is the only sellable tier server-side (there is no
paid "Base" product; "base" only exists as an internal tier-rank value).

**What happens next:** Stripe-hosted checkout completes → redirect to
`/checkout/success` (Step 6) or `/?checkout=cancel` on abandon (no partial
entitlement, no dangling session).

### Mobile: `/paywall` + RevenueCat IAP

**What the user does:** lands on the full-screen `/paywall` (RevenueCat
offerings loaded, packages classified by tier×period, hero + value grid +
FREE/PRO comparison + plan selector + trust strip + UK CMA auto-renew
disclosure + promo expander + restore). Already-Pro users are redirected
before the screen ever renders (so `paywall_viewed` never double-fires for
an existing subscriber). Prices are always the RevenueCat `priceString`
from the user's actual Apple storefront — GBP literals only exist as an
offline fallback, never as rendered truth.

Purchase flow: `checkout_started` → `purchasePackage` (StoreKit sheet) →
entitlement check → up to 10 seconds of `pollUntilEntitled` (bridges the
gap between "Apple confirmed payment" and "the RevenueCat webhook wrote
Supabase" — see Step 4) → success Alert (Step 6).

**Known risk: the trial claim on mobile is client-asserted, not verified
against the App Store product.**

The mobile paywall decides whether to show trial copy ("7-day free trial,
then auto-renews…") from a **client-side constant**:

```ts
const trialApplies = billing === "annual"; // 7-day trial only on Pro annual
```

(`apps/mobile/app/paywall.tsx:467`)

This assumes the annual SKU's introductory offer is configured correctly in
App Store Connect. It never inspects the actual RevenueCat/StoreKit package
object (`pkg.product.introPrice` / `discounts`) to confirm that offer is
really attached to the product the user is about to buy. If the App Store
Connect annual SKU does not have that 7-day intro offer configured, Apple
charges on day 0 while the paywall's copy — "No payment due now, first
charge on Day 7" — is a false claim. Unlike the web path (Step 3, above),
where Stripe is the authority on whether a trial applies before any charge
happens, mobile has no equivalent server-side confirmation before the
purchase completes.

This is a materially different risk from the web path. The actual App
Store Connect product configuration has not been independently confirmed
to match the trial copy — the code assumes the offer is attached, but
nothing in the purchase flow verifies it against Apple. The presence of
this trial copy in the codebase is not evidence that the store product is
configured to match it; the two have never been cross-checked. This has
shipped to TestFlight without that confirmation.

**What happens next:** purchase confirms → success Alert (Step 6), or the
promo expander (see "Promo-code" below) as an alternate, non-purchase entry
into a Pro-equivalent state.

**Web/mobile parity:** same offer/value SSOT (`PRICING_TIERS`,
`paywallValueProps`, comparison rows, trust chips) — the two paywalls read
identically on price and feature comparison. They diverge, by design, on
billing rail (Stripe vs IAP) and — not by design — on whether the trial
claim is provider-verified.

## Step 4 — Webhook reconciliation: the only writers of `profiles.user_tier`

**Why this step exists:** `profiles.user_tier` must resolve the same way
regardless of which platform a user paid on, so a buy-on-web/use-on-mobile
(or the reverse) user is entitled everywhere. That only works if there is
exactly one trusted writer per rail, and the client is not it — the
column is **write-locked against client writes**
(`supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql`).

**What happens (server-to-server, no user action):**
- **Stripe webhook** (`app/api/stripe/webhook/route.ts`) — signature-
  verified, idempotent (`stripe_webhook_events` dedup table).
  `checkout.session.completed` persists `stripe_customer_id`, then grants
  tier via the shared `tierDecisionForSubscription`, which gates on
  subscription **status**, not price alone (an `incomplete`/`unpaid`
  checkout never grants Pro — this class of bug has already been found and
  closed once before).
- **RevenueCat webhook** (`app/api/revenuecat/webhook/route.ts`) —
  Bearer-secret verified (constant-time compare), freshness-checked
  (rejects events older than 26h), idempotent (`revenuecat_events` dedup
  table). Maps `INITIAL_PURCHASE`/`RENEWAL`/etc → tier from entitlement
  ids; `CANCELLATION`/`BILLING_ISSUE` are no-ops (user stays entitled
  through the paid period); `EXPIRATION`/`PAUSE`/`REFUND` → free;
  `TRANSFER` re-points the entitlement between profiles.

Both converge on the same `updateProfileTierServiceRole` writer and the
same `profiles.user_tier` column. The mobile client's own
`syncTierToSupabase` call after a purchase is **expected to be rejected**
by the lockdown — it exists for telemetry (so a dropped webhook shows up
as a client-attempted-but-rejected write in analytics) and as a legacy
fallback path, not as the entitlement source of truth.

**What happens next:** on the buying device, the client polls or re-reads
tier (mobile's `pollUntilEntitled`, web's next tier-read on focus) so the
UI reflects Pro without a manual refresh. On any *other* device the user is
signed into, tier resolves correctly on next read — no extra step needed.

## Step 5 — Entitlement-reconcile cron: the missed-webhook safety net

**Why this step exists:** `profiles.user_tier` is a denormalised mirror —
nothing self-heals if a webhook is dropped, delayed past retry, or
misconfigured. A reconciliation cron exists specifically to catch that
class of drift automatically instead of waiting for someone to notice a
paying customer stuck on the wrong tier.

**What happens (background, no user action):** `POST
/api/cron/entitlement-reconcile` runs every 6 hours (GitHub Actions),
paginating a Stripe-wide sweep of current subscription state and comparing
it to `profiles.user_tier` via the same `tierDecisionForSubscription` the
webhook uses. **Upgrade drift** (paid but under-entitled) is auto-corrected
— this is the failure mode that strands a paying customer, so it's safe to
fix automatically. **Downgrade drift** is Sentry-alerted but not
auto-applied by default, because a cancelled-on-Stripe user could
legitimately be an active App Store subscriber, and downgrading them would
wrongly lock out someone still paying. `lifetime_pro` is never touched by
either direction.

**This cron covers the Stripe rail only.** The RevenueCat/mobile half is
deferred, and a permanently-dropped RevenueCat webhook has no automated
recovery today — a mobile purchaser stranded on the wrong tier stays
stranded until someone corrects it by hand in Supabase. That's an
acceptable gap while real money hasn't yet flowed on the RevenueCat rail,
but it becomes a genuine launch risk once mobile purchases go live for
paying users.

**What happens next:** a correction (either direction) fires a Sentry alert
regardless of outcome — a correction firing at all means a webhook was
missed, which is itself worth investigating even after the auto-fix lands.

## Step 6 — Success / receipt

**Why this step exists:** Stripe used to redirect silently to
`/?checkout=success`, which the app swallowed with no confirmation screen
at all — the user never saw a cancel path, a trial-end date, or a refund
window. Billing trauma (hidden prices, surprise renewals, refund friction)
was the top-cited pain point across a 14-app competitor scan of
subscription products.

**What the user does:**
- **Web** — lands on `/checkout/success` (server-rendered, no auth
  required — the user is mid-Stripe-redirect). Reads an explicit receipt:
  cancel path first, trial-end/first-charge cadence second ("in 7 days"
  for annual, "with your billing period" for monthly), 7-day refund third,
  support email last as a fallback, never a gate. Two CTAs: **Open Sloe**
  (`/home?view=today`) and **Manage subscription** (`/account/billing`).
- **Mobile** — sees a post-purchase `Alert` (`celebrateEntitledPurchase` in
  `apps/mobile/app/paywall.tsx`) with the same four trust elements.

**Both surfaces render the same `buildReceiptTrustCopy` SSOT**
(`src/lib/landing/paywallTrust.ts`) — this is a deliberate parity contract,
not a coincidence: a wording change to the receipt has to be made once and
both platforms pick it up, so the two can't drift into saying different
things about the same purchase.

**What happens next:** "Manage subscription" → Step 7. Otherwise the user
returns to Today with Pro features unlocked on next read.

## Step 7 — Manage / cancel

**Why this step exists:** cancel must be reachable in-app with no
retention save-wall — that's a legal requirement, and it directly counters
the "cancellation hell" pattern the same competitor scan flagged repeatedly
(subscriptions billed via website not iTunes, buried cancel flows).

**What the user does:**
- **Web** — `/account/billing` (Settings → subscription card → "Manage or
  cancel", or the receipt page's own "Manage subscription" link) opens
  the **Stripe Customer Portal**. First, a `CancelExportPromptDialog`
  offers a JSON/CSV export before the user leaves — export-first, not a
  retention pitch. The portal owns every mutation (cancel, pause, update
  payment method); Suppr never builds custom billing-mutation UI.
- **Mobile** — Settings' "Manage subscription" row (or the Sloe Pro
  banner's "Manage" pill) fires the same pattern: a
  **`CancelExportPromptSheet`** offers export first, then
  `presentCustomerCenter` opens the **RevenueCat Customer Center**
  (native). If the RC UI is unavailable (Expo Go, missing key), it falls
  back to `apps.apple.com/account/subscriptions`.

**Why the platforms diverge here, and why that's not drift:** Apple policy
forbids building an in-app cancel control for an App Store subscription —
RevenueCat Customer Center + Apple's own Settings surface is the sanctioned
path. Web has no such constraint, so it gets the fuller Stripe Portal
experience. What's held constant on purpose across both is the **export-
first interstitial pattern** — neither platform lets a user leave without
being offered their data first.

**Edge case — IAP subscriber on web:** a user who paid on mobile and later
opens web Settings sees the web `SubscriptionCard` render Apple-billing
copy with **no web cancel control at all** (`managedVia: "app_store"`) —
routing them to the Apple-managed surface instead of implying a Stripe
cancel path that doesn't apply to their purchase. This is a legal
requirement, not an oversight.

**What happens next:** cancellation flows back through Step 4 (the
relevant webhook fires `EXPIRATION`/`cancel_at_period_end`, tier resolves
to free at period end — access continues until then, never truncated
immediately) → Step 5's cron backstops the web rail if that webhook is
missed.

## Alternate entitlement paths (not a purchase)

Two paths outside Steps 3–4 can also leave a user in an "entitled-looking"
state. Both are documented, server-owned, and neither one is a Stripe or
App Store subscription — that distinction matters for support, legal, and
anyone reading `profiles.user_tier` and assuming it always means "there is
an active recurring charge."

### Promo-code redemption + `lifetime_pro` comp

**What the user does:** expands "Have a promo code?" on `/pricing`, web
Settings, the mobile paywall, or mobile Settings; submits a code. The
client calls the server-owned `redeem_promo_code` RPC, which rejects
invalid/expired/duplicate codes, then re-reads `profiles.user_tier` for the
verified result.

**Why this matters here:** a redeemed code can grant a durable
`lifetime_pro` founding-cohort comp — a tier that outranks regular `pro`
and is floor-protected against downgrade by both the client's
`resolveNextTier` logic and the server's `updateProfileTierServiceRole`.
This is a real, permanent tier grant with **no Stripe subscription and no
App Store purchase behind it** — a support agent or future engineer must
not assume every Pro/`lifetime_pro` user has a billing record to look up.

This path is growth/referral territory, not core billing — full contract
detail belongs to referrals/growth docs, not this one. See
[`docs/product/referrals.md`](../product/referrals.md) for the adjacent
referral-credit mechanics (same "server-owned grant, not a subscription"
shape, different ledger).

### Referral credits — explicitly NOT a subscription

Referral credits (`referrer_days`/`referee_days`, 30 each, from the
immutable `referral_credits` ledger) extend or grant Pro-equivalent access,
and a reader of *this* doc — the monetisation loop — could reasonably
assume "entitled" always traces back to Steps 3–4. It doesn't. **Referral
credits must never be read as implying a Stripe or App Store subscription
exists.** Any billing/provider-facing surface (the web `SubscriptionCard`'s
`managedVia`, support tooling, future churn/LTV analysis) has to keep
reading Stripe/RevenueCat/tier state truthfully and treat referral-granted
access as its own category. This boundary is stated explicitly in
`referrals.md`'s own "Entitlement Boundary" section — this doc cross-links
it rather than re-stating the ledger mechanics.

## Edge cases

- **Stale-cached-tier desync.** A client holding an old free/Pro tier in
  memory can attempt an action the server now rejects (e.g. a Pro→Free
  downgrade holding a multi-day plan). The server rejection is atomic — an
  existing multi-day plan survives as read-only rather than being
  truncated. See `tier-gates.md`'s meal-plan-day notes.
- **Checkout abandonment.** Web redirects to `/?checkout=cancel` with no
  entitlement written — clean no-op, safe to retry.
- **Quota burn on upstream error (photo-log taster).** The free-taster
  bucket increments before the OpenAI call, so a transient upstream 5xx
  can consume one of the user's 5 weekly free logs without returning a
  result. This is a documented trade-off, not a bug.
- **Multi-account farming (photo-log taster).** Not addressed for the
  current small test population; worth revisiting before a broader
  release, since nothing today stops a user from creating a second
  account to reset their free-taster quota.
- **`tier: "base"` checkout requests.** Rejected 400 `invalid_tier` on
  web — there is no paid "Base" product; "base" only exists as an internal
  tier-rank value, never a sellable Stripe price.

## Open product questions

- **Region-aware pricing is only partially built.** EUR Stripe SKUs exist
  but fall back to a "pricing coming soon — GBP" banner when unconfigured;
  USD is a valid `currency` param type with no price resolver behind it
  yet. Whether "GBP fallback + banner" is the intended launch posture, or
  a gap against the ambition that pricing should be fully region-aware, is
  not yet decided.
- **Period-default divergence.** Web `/pricing` and mobile are both meant
  to default to monthly outside onboarding, per the pricing-posture
  guidance in `.claude/agents/_project-context.md` — but mobile onboarding
  forces the annual, trial-eligible SKU for new signups, which is itself a
  real divergence from that general "defaults to monthly" default. Whether
  the monthly default is actually holding at 100% in production, or
  whether treating it as settled was premature, is an open question worth
  confirming with product before relying on it.

## Related documents

- [Product: Tier gates — server-side enforcement points](../product/tier-gates.md) — the canonical gate register; Step 1 links here instead of re-listing routes/migrations
- [Product: Subscriptions — Stripe (web) and IAP (mobile)](../product/subscriptions-stripe-and-iap.md) — full billing-rail contract detail behind Steps 3, 6, 7, including the RevenueCat webhook's auth/freshness/idempotency mechanics and event-type mapping, the Stripe-only reconcile-cron scope, and the client-asserted-trial risk
- [Product: Referral rewards](../product/referrals.md) — the promo/comp and referral-credit entitlement boundary referenced above
- [Journey: Onboarding → First Log](./onboarding-to-first-log.md) — the highest-volume entry into this loop (forced annual SKU, `?from=onboarding`)
- [Journey: Food tracking](./food-tracking.md) — the AI-Assisted Logging & Trust Loop whose voice/photo gates are the second-highest-volume entry into this loop
