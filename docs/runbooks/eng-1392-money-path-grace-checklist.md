# ENG-1392 — Money path Grace checklist

Code path is solid (webhook/entitlement/disclosure). Leftovers are **Grace at keyboard** — children stay **Blocked + Deferred** until these are done. Parent ENG-1392 closes when all three are Done.

## ENG-1433 — Stripe env + Tax (or honest iOS-only CTA)

**Goal:** Production Stripe can take web checkout with tax, **or** web honestly says iOS-only / redirects.

1. Vercel / hosting: confirm live `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, publishable key, price IDs match the products you sell.
2. Stripe Dashboard → **Tax**: enable Stripe Tax for the regions you sell into, or document “tax not collected yet” and ship an honest CTA instead of a broken checkout.
3. Smoke: open web paywall → Checkout → complete a **test-mode** purchase → entitlement flips in app.
4. If web billing is intentionally deferred: change CTA copy to iOS App Store only and leave Stripe dark — do not leave a broken “Subscribe” that 404s.

## ENG-1434 — Enrol Apple Small Business Program (SBP)

1. App Store Connect → Agreements / Business → **Apple Small Business Program** enrolment.
2. Confirm eligibility (≤$1M prior year) and submit.
3. Note effective date for 15% commission; no code change required once Apple approves.

## ENG-1435 — Stripe / RevenueCat webhook failure notifications

1. **Stripe** Dashboard → Developers → Webhooks → endpoint for Suppr → enable failure emails / Slack (or Datadog) on delivery failures.
2. **RevenueCat** Dashboard → Integrations / webhooks → alert on consecutive failures.
3. Optional: PostHog / Sentry alert if your app already logs `webhook_*` errors — wire notification channel Grace monitors daily.

## Done when

- [ ] ENG-1433: live tax-aware Stripe **or** honest iOS-only surface
- [ ] ENG-1434: SBP enrolled (or documented ineligible)
- [ ] ENG-1435: failure alerts reachable in a dashboard Grace actually opens

Then mark children Done and close **ENG-1392**.

Source: leftovers triage plan 2026-07-22; audit `docs/audits/2026-07-05-deep-audits/audit4-money-path/`.
