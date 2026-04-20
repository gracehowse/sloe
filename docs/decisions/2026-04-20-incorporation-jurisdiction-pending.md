# 2026-04-20 — Incorporation jurisdiction (PENDING advisor input)

**Status:** open — current-preferred path is **Delaware LLC formed via Stripe Atlas**, contingent on two gating advisor checks still outstanding (see § Next actions).
**Owner:** Grace.
**Related:**
- [docs/planning/ip-followups-2026-04-19.md](../planning/ip-followups-2026-04-19.md) — entity incorporation is P0 there.
- [docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md](2026-04-19-consumer-vat-posture-uk-eu.md) — UK/EU consumer VAT applies regardless of entity choice.

## Current-preferred path (2026-04-20)

**Delaware single-member LLC, formed via Stripe Atlas.**

Rationale (Grace's read after framing conversation):
- Pass-through tax treatment. With no US ties / no ECI, US federal tax at the entity level is potentially 0% — this is the load-bearing assumption that the cross-border CPA must confirm against her facts.
- Stripe Atlas is purpose-built for non-US founders forming US LLCs (EIN via Form SS-4 for non-residents, Mercury bank onboarding with international KYC, template Orrick/Cooley operating agreement). Integrated Stripe onboarding removes one step.
- Clerky was considered and rejected: Clerky is primarily C-Corp-focused, optimised for VC-backed US founders raising fundraising rounds, and does not provide legal advice itself (it's document automation, same as Atlas). Its value-add (SAFE generation, cap-table software, 83(b) e-filing) doesn't apply to Grace's stage or structure.
- UK Ltd was the alternative considered. Dropped from the narrow because the UK tax rate (19–25%) at the entity level beats the Delaware LLC's "0% if no ECI" only if Grace wants the compliance simplicity — and the Delaware Form 5472 filing burden is bounded and well-understood (USD 400–800/yr CPA).

**This path is NOT final.** It is a working direction so subsequent checks (immigration, CPA) ask the right questions. If those checks return bad news, the path flips back to UK Ltd or we revisit.

Neither Atlas nor Clerky provides legal advice. Legal / tax questions are handled by the separate advisor workstreams below.

## Why this file exists (and what it ISN'T)

This is a decision-state tracker — what's been considered, what's blocked, who needs to be hired next. It is **not** a legal memo. The product-legal-reviewer agent correctly declined to draft a tax/immigration memo because that's outside its competence and a pre-advisor document with cited legal claims written by the wrong specialist becomes a liability, not an asset. A qualified advisor must own the jurisdiction decision.

## The forcing function

Stripe does not support Cayman Islands as a merchant jurisdiction. Suppr cannot onboard Stripe from Grace's current residence. An incorporation in a supported country is a hard prerequisite for billing, which is a hard prerequisite for revenue.

## Grace's relevant facts (self-reported)

- UK citizen.
- **Not** UK tax resident.
- Lives in Cayman Islands.
- Immigration status: **dependant** on her husband's Cayman work permit. Not an independent work-permit holder.
- No US ties (no residence, no visa history, no US assets).
- Company structure goal: 100% share ownership, sole director.
- Business: consumer SaaS (Suppr — recipe + nutrition platform). Stripe-billed subscriptions. Customers globally, weighted UK + EU + US.

## Options that surfaced during initial framing

Not ranked. Advisor to pick.

1. **UK Ltd** — Companies House, fast/cheap. UK tax resident by incorporation. First-class Stripe support.
2. **Delaware LLC** (incl. via Stripe Atlas) — pass-through entity. Stripe Atlas packages formation.
3. **Ireland Ltd** — EEA entity; 12.5% corp tax; directorship rules for non-EEA directors need checking.
4. Others mentioned in passing but not considered: Singapore Pte Ltd, Estonia e-Residency.

**None of these options has been evaluated by a qualified advisor.** Do not act on rank-ordering or impressions from the prior chat thread.

## Gating check before the tax advisor conversation

**Cayman immigration: can a dependant-of-work-permit-holder legally own 100% / direct / derive income from a foreign-incorporated company while resident in Cayman?**

Common understanding is that dependants generally cannot *work for local Cayman businesses* without their own permit, but ownership of and passive income from a non-Cayman company is usually fine. **Usually is not a basis for a company formation.** Confirm explicitly with Cayman immigration counsel (or her husband's sponsor's HR / immigration contact) before anything else happens, because:

- If the answer is **no** or **yes-with-caveats**, every jurisdiction option changes — e.g. she may need to structure her involvement as non-director, or delay incorporation until she obtains her own permit.
- If the answer is **yes**, the tax advisor can be instructed to solve for "Cayman-resident sole director, UK/US/IE entity" without wasting time on structures immigration would block.

## Open advisor workstreams

### 1. Cayman immigration counsel — 30-minute call

Scope:
- Can a dependant-status spouse own 100% of a foreign-incorporated company?
- Can she serve as sole director of a foreign-incorporated company while in Cayman on dependant status?
- Can she receive income (salary, dividend, management fee, distribution) from that foreign company into a personal Cayman bank account?
- Does any of the above jeopardise her husband's work permit?

**Do this first.** Output: a plain-English yes/no + caveats that the tax advisor will key off.

### 2. US cross-border CPA — 60-minute paid consult (Delaware LLC path specifically)

Scope (to book **after** #1 returns):
- Confirm that Grace's fact pattern (UK citizen, Cayman-resident, no US ties, consumer-SaaS on Stripe, no US employees / offices / inventory) supports the "no ECI → no US federal income tax at the LLC level" assumption. This is the single most load-bearing claim for the Delaware LLC path.
- Scope the annual Form 5472 + pro-forma Form 1120 filing and quote the ongoing service fee. Target compliance cost is USD 400–800/yr. If a prospective CPA quotes materially higher, get a second opinion before committing.
- Map the thresholds that would trigger US nexus / ECI as Suppr scales: first US contractor, infrastructure hosted in a specific US state (e.g. Supabase / Vercel regions), US office, US inventory. Need to know what to watch for, not to avoid growth.
- Confirm no UK or Cayman tax side-effects from owning a Delaware LLC as a Cayman resident.

**Search terms:** "Stripe Atlas non-resident CPA", "single-member LLC Form 5472 non-US owner". Vendors that serve this niche: James Baker CPA, 1040 Abroad, Greenback, and several solo CPAs with specialist practices. Short-list 2–3 before booking.

**Budget estimate:** USD 300–600 for the consult. Ask for a brief written follow-up so the advice is attributable.

### 2b. UK chartered tax advisor — only if the Delaware path gets blocked

If immigration or the CPA returns blockers that knock out Delaware, fall back to a UK chartered tax advisor (CTA-qualified, offshore-founder experience) to re-evaluate UK Ltd. Brief at that point covers UK Statutory Residence Test day-count thresholds, NIC exposure on director duties performed in Cayman, effective tax on dividends to Cayman, and work-permit side-effects for the husband. Budget GBP 400–800. Skip for now.

### 3. Stripe onboarding — blocked until advisor output

Will not onboard Stripe from Cayman. Entity must exist in a supported jurisdiction first. Stripe Atlas (Delaware) and UK Ltd (Companies House) are both same-week formations once the direction is confirmed.

## Dependencies on other open workstreams

- **Trademark (TM-1)** in `docs/planning/ip-followups-2026-04-19.md` — memory flags "Suppr / Suppr Club HIGH" trademark risk with a live "Supper Club!" App Store competitor and phonetic-equivalence problem. If a rebrand becomes forced, do not pay formation fees on the current name twice. Either:
  - Resolve trademark direction **before** incorporation (preferred), OR
  - Accept that the entity's name can be changed post-incorporation cheaply in most jurisdictions (true but distracting) and incorporate anyway.
- **Consumer VAT posture** (`docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md`) — UK + EU B2C VAT applies to Suppr's sales **regardless** of entity jurisdiction. Do not let the advisor mistakenly treat VAT as a jurisdiction-choice variable. It isn't.

## What the product-legal-reviewer can help with once entity is chosen

- Stripe checkout + billing-disclosure copy (merchant-of-record line, VAT-inclusive pricing, renewal terms, cancellation flow) — per UK/EU consumer law.
- Terms and Privacy update: controller name, registered office, governing law clause.
- Trust-surface copy: About page, footer, receipt emails, company identifier consistency.

These are queued, not pending advisor input — trigger them the day the entity is chosen.

## Next actions (in order)

| # | Action | Owner | Cost | Expected time |
|---|--------|-------|------|---------------|
| 1 | Book Cayman immigration counsel call — scope in this doc, § "Cayman immigration counsel". Ask specifically about dependant-status ownership + direction of a US LLC + receipt of distributions into personal Cayman bank | Grace | Low (free via sponsor HR, else ~USD 200) | 1–3 business days |
| 2 | Resolve trademark direction (TM-1 in TODO.md) so the entity isn't formed on a name about to change | Grace + trademark counsel | Already scoped | Concurrent with #1 |
| 3 | Book US cross-border CPA call — scope in this doc, § "US cross-border CPA". Confirm no-ECI assumption + quote 5472 service fee | Grace | USD 300–600 | 3–5 business days after #1 |
| 4 | Form Delaware LLC via Stripe Atlas (USD 500 one-off). EIN arrives in 1–3 weeks for non-US founder; Mercury bank opens in parallel | Grace + Stripe Atlas | USD 500 + Mercury fees | 5–15 business days after #3 |
| 5 | Onboard Stripe against the new Atlas LLC | Grace | Free (Stripe fees on transactions) | 1–2 days after #4 |
| 6 | Product-legal review of checkout/ToS/privacy/about to reflect new entity (merchant-of-record line, UK/EU VAT-inclusive pricing, renewal terms, company identifier consistency) | Grace + product-legal-reviewer | Internal | 1–2 days after #5 |
| 7 | Update `TODO.md` LEGAL-1 — entity name populated across terms/dmca/privacy/landing-footer/licences + vendor DPAs (Stripe, Supabase, RevenueCat, Expo, PostHog, Sentry, OpenAI, Edamam) | Grace | Internal | Concurrent with #6 |

Update this file with the immigration + CPA answers as they come in. When Atlas completes #4 this file's `Status:` flips from `open` to `resolved` and a sibling file at `docs/decisions/2026-MM-DD-incorporation-decided.md` captures the actual decision + resulting entity name + registered office for the audit trail.
