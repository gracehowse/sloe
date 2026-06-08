# HSA/FSA via TrueMed — evaluation + go/no-go (ENG-991)

- **Date:** 2026-06-08 · **Area:** Monetisation / Billing / US · **Status:** Open (tentative — pending vendor relationship + legal-reviewer)
- **Linear:** ENG-991 · **Owner:** Grace (vendor + legal); monetisation-architect (eval)
- **Source:** MFP teardown (`docs/research/2026-06-08-mfp-teardown.md`) — TrueMed confirmed in MFP's checkout (BFF `…/truemed/payment-session` + `/partner/truemed`).

## Verdict: **post-launch lever, NOT a pre-launch blocker.**
Genuine, trust-positive feature (real pre-tax discount, not a dark pattern) — but the dependency chain is too long for 2026-07-01 and the launch-scale US dollar impact is small. Apply for the merchant account now (calendar time); build it ~4–6 weeks post-launch behind a US-only flag.

## What TrueMed is
A US payments layer alongside Stripe that lets users pay for eligible health products with pre-tax **HSA/FSA** dollars. At checkout a "Pay with HSA/FSA" CTA launches TrueMed's hosted flow (authenticate HSA/FSA card → short health questionnaire → a TrueMed-network provider issues a **Letter of Medical Necessity (LMN)** → charge proceeds). Merchant receives funds via Stripe as normal. It's an add-on payment method, not a billing stack.

## Eligibility — the honest part
- General wellness/nutrition apps are **not** HSA/FSA-eligible in the abstract (IRS §213(d)).
- TrueMed works because the **LMN makes a specific *user* eligible** for a specific purchase based on a documented condition (obesity, T2 diabetes, hypertension dietary management, celiac, ED recovery). The **product does not become "HSA/FSA-eligible" globally.**
- **Marketing must say "eligible users may pay with HSA/FSA" — never "this app is HSA/FSA-eligible."** The latter is a health claim + false-advertising/FTC risk. TrueMed's flow enforces the gating; our `/pricing` copy must not overstate.
- Confidence: high the LMN model is sound for qualifying users; medium whether TrueMed routinely approves a recipe/nutrition app vs a clearly-clinical one (MFP gets it on scale + clinical base; Suppr untested at N=1).

## Dependencies / blockers (before ANY code)
1. **TrueMed merchant account** — invite/partnership, not self-serve. **Grace applies** (truemed.com merchant programme). Business-dev step.
2. **Active Stripe merchant on an incorporated entity** — TrueMed checks Stripe status; **Delaware LLC formation (Stripe Atlas) is a prerequisite** (`docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`).
3. **legal-reviewer sign-off (mandatory)** on three surfaces — not a quick confirm:
   - `/pricing` CTA copy (FTC health-claim language)
   - Privacy policy (TrueMed's questionnaire collects **health data** → CCPA + WA My Health My Data Act disclosure)
   - Renewal disclosure (auto-renew edge case when first payment was HSA/FSA-routed; extends `docs/decisions/2026-04-19-renewal-disclosure-rewrite.md`)
4. **US-only** — HSA/FSA are US tax instruments; gate via `detectRegion()`. No conflict with UK/EU VAT posture.

## Upside vs cost
- **Upside:** ~22% effective discount via pre-tax dollars (a real, honest saving); reported ~15–25% checkout-conversion lift for eligible+aware users; parity with MFP (its absence is a visible gap for MFP refugees); TrueMed marketplace as a secondary channel.
- **Cost:** ~2–3 days eng (two BFF routes + a `/pricing` secondary CTA + tier-write reconciliation); TrueMed fee ~2–3% on top of Stripe; ongoing health-claim copy discipline; low-probability IRS-guidance-narrowing risk (TrueMed bears LMN risk, our brand bears the surface).

## Cross-platform
**Web-Stripe-only.** iOS billing is Apple IAP (RevenueCat); Apple bars alternative payment rails in-app. Not a gap — a platform constraint.

## Sequencing
- **Now:** Grace applies to TrueMed (parallel calendar time) + confirm Suppr's category is in their eligible list.
- **Post-launch (~4–6 wks):** legal-reviewer on the three surfaces → build the two routes + the CTA → ship behind a US-only flag → measure CTA click, TrueMed-vs-Stripe completion, conversion lift (flag-ramped holdout), chargebacks (guardrail: review if questionnaire drop-off >60%).
- **Do not** market HSA/FSA anywhere until live + legal-reviewed (expectation-setting risk).

## Grace's action items (not engineering)
1. Apply to TrueMed merchant programme (now). 2. Close Delaware LLC formation (prereq). 3. Route to legal-reviewer on TrueMed approval. 4. No "HSA/FSA" in any copy until legal-reviewed.

## Pending Notion mirror
Decisions log row — "HSA/FSA via TrueMed evaluation (ENG-991)", 2026-06-08, Monetisation/Billing, Open (tentative), summary "Post-launch US lever, not pre-launch blocker; needs TrueMed account + legal sign-off + entity formation", blob `docs/decisions/2026-06-08-hsa-fsa-truemed-eval.md`.
