# Consumer VAT Posture — UK and EU (non-established digital-service supplier)

**Date:** 2026-04-19

**Decision:** Suppr must collect and remit VAT on B2C digital-service sales to UK and EU consumers regardless of its Cayman incorporation, and must display those prices VAT-inclusive on UK/EU consumer surfaces.

**Status:** Active

**Agents involved:** legal-reviewer, monetisation-architect, executor (round 4 in flight)

**Related:**
- `project_tax_jurisdiction.md` in memory (merchant-side; updated to point here)
- `docs/decisions/2026-04-19-pricing-v1.md` (prices this decision constrains)
- `docs/decisions/2026-04-19-renewal-disclosure-rewrite.md` (disclosure copy this decision drove)

---

## Rationale

Cayman incorporation eliminates Suppr's own VAT liability on income under Cayman law. It does not affect the obligation to collect VAT from consumers in jurisdictions where digital services are taxed at the point of sale. The two questions are legally independent. The prior memory note conflated them, creating a risk that the legal posture would be understood as "we owe nothing" when the correct answer is "we owe nothing on our income but we owe collection on consumer sales."

### UK

HMRC treats non-established taxable persons (NETPs) differently from UK-established businesses. A UK-established business only registers once it passes the £90k annual threshold. A NETP — which Suppr is, being Cayman-based with no UK fixed establishment — must register from the first £1 of B2C digital sales to UK consumers. There is no de minimis. Suppr is on the hook as the supplier; there is no reverse-charge mechanism for B2C sales. This is independent of Cayman status.

Additionally, the UK Price Marking Order and the Consumer Protection from Unfair Trading Regulations (CPRs) require that prices shown to UK B2C customers be VAT-inclusive. Showing "£3.99 — excludes applicable taxes" to a UK consumer is both misleading under consumer law and masks an unregistered VAT liability.

### EU

The non-Union OSS (One Stop Shop) scheme applies to non-EU businesses selling B2C digital services to EU consumers. The obligation is triggered from the first euro of sales — there is no threshold for non-EU suppliers (the €10,000 threshold that was referenced in earlier notes applies only to EU-established businesses using Union OSS for cross-border EU sales). IOSS is for goods imports, not subscriptions — not relevant here.

### US

A separate and patchwork regime. Economic nexus thresholds (typically $100k revenue or 200 transactions per state per year) apply before registration is required. For IAP revenue, Apple and Google collect and remit US sales tax on Suppr's behalf. For web Stripe subscriptions, Stripe Tax with correct configuration handles collection once thresholds are crossed. "Excludes applicable taxes" is acceptable on a USD/US-addressed surface provided Stripe Tax is enabled.

---

## What changed on 2026-04-19

1. **Disclosure copy on `/pricing` and mobile paywall:** "Price excludes any applicable taxes" replaced with "Price includes any applicable VAT." (Legal-reviewer round-6, 2026-04-19, dropped "shown" so web matches the mobile-paywall wording — the two platforms were drifting on a single word.)

2. **Stripe Tax mode:** Must be set to tax-inclusive so that the displayed £3.99 is the amount the user pays, with VAT back-calculated by Stripe. Monetisation-architect auditing in parallel.
   - **Code-side landed (round 5):** `app/api/stripe/checkout/route.ts` passes `automatic_tax: { enabled: true }` and `billing_address_collection: "auto"` to `stripe.checkout.sessions.create`. `customer_update: { address: "auto" }` is intentionally omitted — this route mints a fresh Customer via `client_reference_id`, and Stripe rejects `customer_update` without an existing `customer` id.
   - **Feature-flagged (round 6, 2026-04-19):** the Stripe Tax wiring AND the `/pricing` tax-clause copy both read `process.env.STRIPE_TAX_ENABLED === "true"`. Default is `false` — code ships truthful (`"Price excludes any applicable taxes."` and no `automatic_tax` passed to Checkout) while the dashboard flip is still pending. Release-gate required this flag so the code ship could decouple from the dashboard work. Pinned by `tests/unit/stripeCheckoutRoute.test.ts` (both flag states) and `tests/unit/landingParity.test.tsx`.
   - **Mobile paywall disclosure is flag-independent** — mobile payments go through Apple IAP, which always displays VAT-inclusive prices on UK/EU storefronts per App Store policy. The mobile `"Price includes any applicable VAT"` line stays truthful regardless of `STRIPE_TAX_ENABLED`.
   - **Remaining dashboard actions (owner: Grace):** activate Stripe Tax in the Stripe dashboard, set `tax_behavior` on each Price (`STRIPE_PRICE_BASE_MONTHLY`, `STRIPE_PRICE_BASE_ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`), then flip `STRIPE_TAX_ENABLED=true` in the prod env. Copy and API behaviour switch in lockstep.

3. **Registration workstreams opened (owner: Grace):**
   - UK VAT registration as a non-established taxable person (HMRC)
   - Non-Union OSS registration for EU digital sales
   These are outside-counsel/accountant tasks. They cannot be closed by the engineering team.

4. **Default-safe behaviour until registration lands:** Tax-inclusive display on all UK/EU-facing surfaces, Stripe Tax enabled in inclusive mode, Suppr self-accounts for the VAT liability internally.

---

## Alternatives considered

- **"Cayman means we owe nothing"** — rejected. This correctly describes the merchant-income-tax position but misapplies it to consumer-facing VAT. The two obligations are independent.

- **Keep "excludes applicable taxes" copy with a footnote** — rejected. Under the UK Price Marking Order the obligation is to show the VAT-inclusive price, not to disclose the exclusive price with a note. A footnote does not cure the violation.

- **Switch to a Merchant of Record (Paddle) to offload VAT** — not adopted at this time. Would shift the consumer-VAT obligation to the MoR and simplify compliance, but introduces a new dependency, a revenue share, and a checkout-flow migration. Remains the right call if the registration workstream proves too burdensome. If this path is taken, this decision is superseded and `project_tax_jurisdiction.md` must also be updated.

- **Delay addressing until post-launch** — rejected. The disclosure copy was already live on `/pricing` in the misleading form. Correcting it before public launch is low-cost and high-risk-reduction.

---

## Platforms

Both (web `/pricing` page and mobile paywall both affected by disclosure copy; Stripe Tax is web-only; IAP tax is handled by Apple/Google).

---

## Revisit on

- Outside counsel rules differently on place-of-supply for a Cayman-based entity selling digital services to UK/EU consumers (would need to supersede this entry with their analysis).
- Suppr migrates to a Merchant of Record — at that point the consumer-VAT obligation shifts to the MoR and the "we must collect" posture no longer applies to Suppr directly.
- UK or EU legislature changes the NETP threshold or introduces a de minimis for small non-established suppliers.
- Stripe Tax changes its handling of tax-inclusive pricing in a way that breaks the back-calculation assumption.
