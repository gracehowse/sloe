# 2026-04-20 — Incorporation jurisdiction (PENDING advisor input)

**Status:** open — blocked on qualified cross-border tax advice + Cayman immigration check.
**Owner:** Grace.
**Related:**
- [docs/planning/ip-followups-2026-04-19.md](../planning/ip-followups-2026-04-19.md) — entity incorporation is P0 there.
- [docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md](2026-04-19-consumer-vat-posture-uk-eu.md) — UK/EU consumer VAT applies regardless of entity choice.

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

### 2. Cross-border tax advisor — 60-90 minute paid consult

Scope (to book **after** #1 returns):
- Given the immigration answers, pick ONE primary jurisdiction and one backup.
- Model company-level + personal-level tax at each lifecycle stage: formation, steady-state operations, profit extraction, scaling (first hire in UK/US/EU), exit/wind-up.
- Name the specific filings (UK CT600, US Form 5472, IE CT1, etc.) that come with each option.
- UK Statutory Residence Test — confirm whether sole-directing a UK Ltd from Cayman pulls her into UK tax residence under current rules, and the workday limits she'd need to respect.
- National Insurance exposure on any director salary paid by a UK Ltd for duties performed in Cayman.
- US Form 5472 / pro-forma 1120 annual filing if Delaware LLC — penalty exposure and the ongoing compliance cost in realistic money (not just "~$25k penalty" rhetoric).

**Budget estimate:** GBP 400–800 for the consult (one advisor, one meeting). Ask the advisor to produce a short written memo so its claims are attributable.

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
| 1 | Book Cayman immigration counsel call — scope in this doc, § "Cayman immigration counsel" | Grace | Low (free via sponsor HR, else ~USD 200) | 1–3 business days |
| 2 | Resolve trademark direction (TM-1 in IP followups) so the entity isn't formed on a name about to change | Grace + trademark counsel | Already scoped | Concurrent with #1 |
| 3 | Book cross-border tax advisor call — scope in this doc, § "Cross-border tax advisor" | Grace | GBP 400–800 | 3–5 business days after #1 |
| 4 | Incorporate in chosen jurisdiction | Grace + formation provider | Varies | Same week as #3 output |
| 5 | Onboard Stripe | Grace | Free (Stripe fees on transactions) | Same week as #4 |
| 6 | Product-legal review of checkout/ToS/privacy/about to reflect new entity | Grace + product-legal-reviewer | Internal | 1–2 days after #5 |

Update this file with the advisor's recommendation and the resulting decision when #3 returns. At that point this file's `Status:` flips from `open` to `resolved` and a sibling file captures the actual decision.
