# Decision log: UK/EU 14-day statutory cancellation framing (2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — path (a) shipped without counsel; path (b) deferred to counsel review
**Owner:** `legal-reviewer` (recommendation), `executor` + `monetisation-architect` (implementation)

Closes item E from the [2026-04-25 paywall dark-pattern audit](./2026-04-25-paywall-dark-pattern-audit.md).

---

## Decision

**Ship path (a): surface the 14-day statutory right alongside the existing 7-day goodwill policy.** Region-aware on web via the existing `detectRegion(headers)` helper. Same string family across all three billing surfaces.

**Reject path (b): explicit waiver collection at checkout.** It is the legally cleaner option *if executed perfectly*, but the waiver flow must be (i) express, (ii) acknowledged (consumer must positively confirm they lose the right), and (iii) recorded on the durable medium / order confirmation email. A bare button-label change ("Subscribe & waive my 14-day right") almost certainly fails the "express consent + acknowledgement" test under Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (SI 2013/3134) reg. 37(1)(a)–(b). A checkbox in front of Subscribe would work but adds friction at the worst possible moment, and CMA enforcement on subscription dark patterns has been active since 2024. **Path (b) is counsel-grade work.**

---

## Why path (a) is shippable today

- N=1 tester. Financial exposure of honouring the 14-day right is zero today; near-zero through low-thousand-customer scale.
- We are advertising rights the consumer already has by law. Zero new exposure.
- The 7-day goodwill policy still differentiates (faster, lower-friction email path).
- Conservative posture pre-incorporation: do not extinguish statutory rights when we don't have to.

---

## Copy to ship

### `apps/mobile/app/paywall.tsx` (~540, all regions — mobile can't reliably pre-detect store region)

```
Auto-renews until cancelled in Settings → Apple ID → Subscriptions
(or Google Play). Refunds are handled by Apple / Google.

UK & EU customers: you have a statutory 14-day right to cancel
distance contracts. Beyond that, we offer a 7-day goodwill refund —
email support@suppr.club.
```

### `app/pricing/PricingTiersGrid.tsx` BillingDisclosure (~346, region-aware)

**UK / EU branch:**

```
Auto-renews monthly/annually until cancelled. Cancel anytime in
Account → Billing; cancellation takes effect at period end.

Your 14-day right to cancel: under UK Consumer Contracts Regulations
2013 / EU Directive 2011/83 you may cancel within 14 days of
purchase for a full refund. Beyond that we offer a 7-day goodwill
refund — email support@suppr.club.

Prices include VAT.
```

**Rest of world branch:**

```
Auto-renews monthly/annually until cancelled. Cancel anytime in
Account → Billing; cancellation takes effect at period end.
7-day goodwill refund policy — email support@suppr.club.
```

### `src/app/components/suppr/upgrade-paywall-dialog.tsx` (T24 CMA-shape extension)

```
You'll be charged {price} {today/on {trial-end-date}}, then
{price}/{period} until cancelled. Cancel anytime in Account → Billing.
{UK/EU only:} 14-day statutory right to cancel applies. {All regions:}
7-day goodwill refund — support@suppr.club.
```

---

## Region detection

**Web:** use `detectRegion(headers)` (already wired for VAT). Same surface that decides VAT-inclusive pricing decides cancellation-rights language. Showing UK/EU language to a US visitor wrongly implies UK statutory rights — that's the actively harmful direction.

**Mobile:** **don't** region-detect. Paywall renders before purchase region is known and Apple/Google handle store-region anyway. Show the combined disclosure to everyone — it's accurate for UK/EU and informational-only for others.

**Trade-off accepted:** a UK visitor on a US VPN sees the wrong disclosure on web. Same failure mode as VAT.

---

## Domain note

Copy above uses `support@suppr.club` as the support email. **Final email follows the [domain canonicalisation decision](./2026-04-25-domain-and-suppr-club-rename.md) — replace at sweep time.** If T17 has shipped before this PR, use `support@supprclub.com`; otherwise place a `// DOMAIN: replace post-T17` marker so the codebase grep stays clean.

---

## What still needs counsel

- **Waiver-collection flow** (path b) if/when Suppr wants to extinguish the 14-day right at checkout.
- **Consumer arbitration / dispute venue clauses** in ToS — irrelevant pre-incorporation but blocking before public EU launch.
- **Statutory damages exposure for past sales** — N=1, moot.
- **Refund-mechanism mismatch on mobile** — Apple controls the refund; if a UK customer asserts their 14-day right and Apple declines, who bears the cost? Counsel should confirm Suppr top-up obligation.
- **"Goodwill" framing legality** — overlapping a 7-day goodwill refund on top of a 14-day statutory right is fine; counsel should confirm the labels don't mislead.

---

## Update — 2026-07-17: ENG-1439 re-affirms path (a); ToS wording corrected

ENG-1439 (2026-07-05 deep audit, money-path stage) found the Terms of Service had drifted from this decision: `app/terms/page.tsx`'s "EU consumer withdrawal rights" section claimed, present tense, that "you are asked to expressly consent to performance beginning before the 14-day period ends and to acknowledge that... you lose the right to withdraw" — describing path (b), which was never built. The checkout code was correct (no `consent_collection`/`custom_text` on the Stripe session — path (a) as decided); the ToS text was the bug.

**Ruled by Fable (per Grace's delegation, 2026-07-17):** re-affirm path (a) rather than reverse it. The condition that would justify path (b) — counsel engagement — still hasn't happened three months on, and adding a checkout waiver without that counsel pass would be worse than the ToS bug it "fixes" (real CMA/dark-pattern exposure, no clean extinguishment of the right anyway if the flow doesn't hold up). Fixed the ToS paragraph to accurately describe path (a) instead: no checkout-time waiver, the 14-day right stands for the full period on top of the 7-day goodwill policy, full refund (no proportionate deduction — no express-immediate-performance request was ever collected, so CCR reg 36's deduction carve-out doesn't apply).

**Path (b) stays parked here for whenever counsel is actually engaged** (see "What still needs counsel" above — unchanged). A legal-reviewer pass on 2026-07-17 drafted the exact Stripe config + copy for path (b) in case that day comes, preserved verbatim below rather than re-derived from scratch:

- Region-gate to UK/EU via the existing `detectRegion`/`vatNote` signal (same one `BillingDisclosure` already keys off).
- `consent_collection: { terms_of_service: "required" }` on the Checkout Session — **requires a Terms-of-Service URL configured in the Stripe Dashboard first** (Settings → Public details / Branding); session creation errors without it.
- `custom_text.terms_of_service_acceptance.message`: "I ask Sloe to start my Pro subscription immediately and I agree to the Terms of Service. I understand that once the service has been fully provided I lose my statutory 14-day right to cancel for a refund; Sloe's separate 7-day goodwill refund still applies."
- `custom_text.submit.message`: "Cancel anytime in Account > Billing. Your UK/EU 14-day withdrawal rights apply as set out above."
- Drafted to the "fully provided" digital-*service* standard (CRD Art 16(a)), not the looser digital-*content* "performance has begun" standard (Art 16(m)) — correct for a subscription, unlike the retired ToS wording above.
- Still needs, beyond counsel sign-off: a durable-medium confirmation (webhook persists `session.consent.terms_of_service`; the order-confirmation email/receipt restates the consent + acknowledgement per CCRs reg 16 / CRD Art 8(7)) — the checkbox alone isn't sufficient without that trail.

Tracked as a standing item under the **Pre-launch incorporation + legal** project rather than a dangling Linear ticket.

---

## Related

- [2026-04-25 paywall dark-pattern audit](./2026-04-25-paywall-dark-pattern-audit.md) — closes item E
- [2026-04-19 consumer VAT posture (UK + EU)](./2026-04-19-consumer-vat-posture-uk-eu.md) — same region-detection plumbing
- [2026-04-19 renewal disclosure rewrite](./2026-04-19-renewal-disclosure-rewrite.md) — earlier disclosure work
- [2026-04-25 domain + Suppr Club rename](./2026-04-25-domain-and-suppr-club-rename.md) — owns the support email surface
