# Stripe Tax launch checklist — jurisdiction-aware VAT

**Owner:** Grace (Stripe dashboard + Vercel env work).
**Authority:** [ENG-33](https://linear.app/suppr/issue/ENG-33/) +
[docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md](../decisions/2026-04-19-consumer-vat-posture-uk-eu.md).
**Status as of 2026-05-13:** code wiring complete + honest fallback
copy shipped; Stripe dashboard config + Vercel flag pending.

The /api/stripe/checkout route already flag-gates `automatic_tax` on
`STRIPE_TAX_ENABLED`, the /pricing surface flag-gates the inclusive-
VAT note (via `resolveRenderedVatNote`), and the Stripe Checkout
copy stays in lockstep with the route's tax behaviour. What still
has to happen — and only Grace can do it — is the dashboard +
environment flip across three surfaces. Work top-to-bottom; each
step depends on the one above.

> **Legal posture:** the 2026-04-19 consumer-VAT memo concluded that
> non-established supplier rules apply on UK/EU consumer sales
> regardless of merchant domicile (Cayman, Delaware, etc.). Prices
> on UK/EU surfaces must therefore be VAT-inclusive *once the
> dashboard supports it*. Until then, the /pricing page now falls
> back to the honest "Price excludes any applicable taxes"
> disclosure on UK/EU surfaces — Stripe is not computing VAT, so
> the inclusive claim was misleading. This is interim, not the
> final posture; the goal of this runbook is to retire the
> interim state.

---

## 1. Stripe dashboard — activate Tax + set Price tax_behavior

**Stripe Tax** must be activated for the merchant account, and each
Pro Price object must have `tax_behavior=inclusive` set for UK/EU
SKUs (and `tax_behavior=exclusive` for any US SKU when those land).

**Action (Stripe dashboard → Settings → Tax):**

1. Activate Stripe Tax for the merchant account. Confirm UK + EU
   registrations are wired (Stripe Tax handles registration via
   its dashboard wizard; the consumer-VAT memo names the
   workstream as "owner: Grace").
2. For **UK / EU**, set the tax-collection mode to **Inclusive**.
   Stripe will then compute VAT *from* the displayed price.
3. For **US**, set the tax-collection mode to **Automatic**. Stripe
   computes sales tax by destination at checkout.

**Action (Stripe dashboard → Products → Pro):**

4. Open each Pro Price object (monthly + annual + any future SKU).
5. Set `tax_behavior` per-Price:
   - UK / EU SKUs → `inclusive`.
   - US SKUs → `exclusive` (Stripe Tax will add tax at checkout).
6. Verify by hitting `/v1/prices/<id>` via the Stripe CLI — the
   response should include `tax_behavior: "inclusive"` or
   `"exclusive"` (not `"unspecified"`).

**Verify:** create a test Checkout session via the CLI with
`automatic_tax[enabled]=true`. Stripe should compute a VAT line
on UK addresses and a sales-tax line on US addresses without
erroring on `tax_behavior_required`.

---

## 2. Vercel — flip STRIPE_TAX_ENABLED=true

Once dashboard work is complete, flip the env flag in **all three**
Vercel environments (Production, Preview, Development) so the
codepaths align:

- `/api/stripe/checkout/route.ts` starts passing `automatic_tax:
  { enabled: true }` and `billing_address_collection: "auto"` to
  Stripe Checkout (`apps/web/app/api/stripe/checkout/route.ts:108`).
- `/pricing/page.tsx` starts passing `regionVatNote: "Prices include
  VAT"` to UK/EU visitors (via `resolveRenderedVatNote`).
- BillingDisclosure picks up the inclusive-VAT clause.

**Action (Vercel dashboard → Project → Settings → Environment Variables):**

1. `STRIPE_TAX_ENABLED` → `true` (Production).
2. `STRIPE_TAX_ENABLED` → `true` (Preview).
3. `STRIPE_TAX_ENABLED` → `true` (Development) — keeps local-vs-CI
   in lockstep so the disclosure copy tests don't drift.
4. Redeploy the Production environment so the new env var bakes
   into the build (Vercel env-var changes do not auto-redeploy).

---

## 3. Smoke test — verify the honest path

After §1 and §2 complete:

1. Open `/pricing` from a UK IP. Expect:
   - Tax clause reads "Prices include VAT." (not "Price excludes
     any applicable taxes.")
   - 14-day statutory cancellation note renders.
2. Open `/pricing` from a US IP (use a VPN or `curl -H "CF-IPCountry: US"`).
   Expect:
   - Tax clause reads "Price excludes any applicable taxes."
     (still — US sales tax adds at checkout; the inclusive note is
     UK/EU only.)
3. Start checkout. Stripe should display the VAT or sales-tax line
   under the price *without erroring*.
4. Confirm the receipt PDF emailed by Stripe carries the VAT/tax
   line.

---

## Failure modes mapped to flag + dashboard state

| `STRIPE_TAX_ENABLED` | Stripe dashboard tax_behavior | UK/EU `/pricing` copy             | Checkout behaviour              |
| -------------------- | ----------------------------- | --------------------------------- | ------------------------------- |
| `false` (today)      | Anything                      | "Price excludes any applicable taxes." (honest) | sticker price; no VAT line       |
| `true`               | `unspecified` on any Price    | "Prices include VAT" (UK/EU)      | **Stripe Checkout 400 error**   |
| `true`               | `inclusive` (UK/EU) + `exclusive` (US) | "Prices include VAT" (UK/EU) | VAT or sales-tax line on receipt |

**Never** flip `STRIPE_TAX_ENABLED=true` until **every** Pro Price
object has an explicit `tax_behavior` set — otherwise Stripe rejects
the Checkout session and every UK/EU sign-up sees a broken funnel.

---

## Linked

- Decision: [2026-04-19 consumer VAT posture — UK and EU](../decisions/2026-04-19-consumer-vat-posture-uk-eu.md)
- Decision: [2026-04-25 UK/EU statutory cancellation](../decisions/2026-04-25-uk-eu-statutory-cancellation.md)
- Code: [`app/api/stripe/checkout/route.ts:108`](../../app/api/stripe/checkout/route.ts), [`src/lib/region/detectRegion.ts`](../../src/lib/region/detectRegion.ts), [`app/pricing/PricingTiersGrid.tsx`](../../app/pricing/PricingTiersGrid.tsx)
